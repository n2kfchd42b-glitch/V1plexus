import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getInstitutionAdminContext } from '@/lib/admin/institutionAdmin'
import { writeAuditEntry } from '@/lib/audit/auditLogger'
import { EMAIL_REGEX, escapeHtml } from '@/lib/utils'

/**
 * Department head management.
 *
 * A "head" is a workspace_memberships row with role='department_head' and
 * department_id pointing at this department. The federated-admin model
 * (see src/lib/admin/scope.ts) reads from this table directly.
 *
 *   GET     — list current heads
 *   POST    — promote an existing institution member (by user_id) OR
 *             invite a non-member by email
 *   DELETE  — demote a head: switch their role back to 'supervisor'
 *             (preserves their workspace access)
 */

const promoteSchema = z.union([
  z.object({
    user_id: z.string().uuid(),
    // Set when the caller wants to attach an existing Plexus user to this
    // institution (they're on Plexus but profile.institution_id is null).
    // Refused if the user is already affiliated with a DIFFERENT institution.
    link_to_institution: z.boolean().optional(),
  }),
  z.object({
    email: z.string().trim().toLowerCase().regex(EMAIL_REGEX, 'Invalid email'),
    message: z.string().trim().max(2000).optional(),
  }),
])

async function loadCtx(
  supabase: Awaited<ReturnType<typeof createClient>>,
  departmentId: string,
) {
  const ctx = await getInstitutionAdminContext(supabase)
  if (!ctx) return { error: 'Forbidden', status: 403 as const }

  const svc = createServiceClient()
  const { data: dept } = await svc
    .from('departments')
    .select('id, name, institution_id')
    .eq('id', departmentId)
    .maybeSingle()
  if (!dept || dept.institution_id !== ctx.institutionId) {
    return { error: 'Department not found', status: 404 as const }
  }

  const { data: workspace } = await svc
    .from('workspaces')
    .select('id, name')
    .eq('institution_id', ctx.institutionId)
    .eq('type', 'institutional')
    .maybeSingle()
  if (!workspace) return { error: 'No institutional workspace', status: 500 as const }

  return { ctx, svc, dept, workspace }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const loaded = await loadCtx(supabase, id)
  if ('error' in loaded) return NextResponse.json({ error: loaded.error }, { status: loaded.status })

  const { svc, workspace } = loaded
  const { data: heads, error } = await svc
    .from('workspace_memberships')
    .select(`
      user_id, joined_at,
      user:profiles!workspace_memberships_user_id_fkey(id, full_name, email, avatar_url, title)
    `)
    .eq('workspace_id', workspace.id)
    .eq('department_id', id)
    .eq('role', 'department_head')
    .eq('status', 'active')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ heads: heads ?? [] })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const loaded = await loadCtx(supabase, id)
  if ('error' in loaded) return NextResponse.json({ error: loaded.error }, { status: loaded.status })

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const parsed = promoteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { ctx, svc, dept, workspace } = loaded

  // Promote an existing member ─────────────────────────────────────────────
  if ('user_id' in parsed.data) {
    const { user_id, link_to_institution } = parsed.data
    const { data: target } = await svc
      .from('profiles')
      .select('id, full_name, email, institution_id')
      .eq('id', user_id)
      .maybeSingle()
    if (!target) {
      return NextResponse.json({ error: 'User not found' }, { status: 400 })
    }

    // Three cases:
    //   - target.institution_id === ctx.institutionId → normal promotion
    //   - target.institution_id === null and link_to_institution → link + promote
    //   - target.institution_id is a different institution → must unlink first
    const isSameInstitution = target.institution_id === ctx.institutionId
    const isUnaffiliated   = target.institution_id === null

    if (!isSameInstitution && !isUnaffiliated) {
      return NextResponse.json({
        error: 'User is affiliated with a different institution. Ask them to unlink first, or send an email invitation.',
      }, { status: 409 })
    }
    if (!isSameInstitution && isUnaffiliated && !link_to_institution) {
      return NextResponse.json({
        error: 'User is on Plexus but not yet in your institution. Pass link_to_institution: true to attach them.',
      }, { status: 409 })
    }

    // Block downgrading an institution admin / owner. Their existing role
    // grants wider scope than department_head, so the upsert would silently
    // strip permissions.
    const { data: existingMembership } = await svc
      .from('workspace_memberships')
      .select('role')
      .eq('workspace_id', workspace.id)
      .eq('user_id', user_id)
      .maybeSingle()
    if (existingMembership?.role === 'admin' || existingMembership?.role === 'owner') {
      return NextResponse.json({
        error: 'That user is already an institution admin and would lose scope if promoted to department head',
      }, { status: 409 })
    }

    // Link to institution if needed (case 2).
    if (isUnaffiliated) {
      const { error: linkErr } = await svc
        .from('profiles')
        .update({ institution_id: ctx.institutionId })
        .eq('id', user_id)
      if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 500 })
    }

    const { error: upsertErr } = await svc
      .from('workspace_memberships')
      .upsert({
        workspace_id: workspace.id,
        user_id,
        role: 'department_head',
        department_id: id,
        status: 'active',
        invited_by: ctx.userId,
      }, { onConflict: 'workspace_id,user_id' })

    if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 })

    void writeAuditEntry({
      actor_id: ctx.userId,
      action: 'institution.admin.updated',
      resource_type: 'institution',
      resource_id: ctx.institutionId,
      institution_id: ctx.institutionId,
      details: {
        summary: isUnaffiliated
          ? `Linked ${target.full_name ?? target.email} to institution and promoted to head of ${dept.name}`
          : `Promoted ${target.full_name ?? target.email} to head of ${dept.name}`,
        department_id: id,
        target_user_id: user_id,
        linked_to_institution: isUnaffiliated,
      },
    })

    return NextResponse.json({ success: true, promoted: { id: user_id }, linked: isUnaffiliated })
  }

  // Invite a non-member by email ───────────────────────────────────────────
  const { email, message } = parsed.data

  const { data: existingInvite } = await svc
    .from('workspace_invitations')
    .select('id')
    .eq('workspace_id', workspace.id)
    .eq('email', email)
    .eq('role', 'department_head')
    .eq('department_id', id)
    .eq('status', 'pending')
    .maybeSingle()
  if (existingInvite) {
    return NextResponse.json({ error: 'An invitation is already pending for this email and department' }, { status: 409 })
  }

  const token = crypto.randomUUID().replace(/-/g, '')
  const { error: insertErr } = await svc
    .from('workspace_invitations')
    .insert({
      workspace_id: workspace.id,
      email,
      role: 'department_head',
      department_id: id,
      supervisor_id: null,
      message: message ?? null,
      token,
      invited_by: ctx.userId,
      status: 'pending',
    })
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://plexus.science'
  const inviteLink = `${appUrl}/invite/${token}`

  let emailWarning: string | null = null
  if (process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      const emailResp = await resend.emails.send({
        from: 'Plexus <invitations@plexus.science>',
        to: email,
        subject: `You've been invited to lead ${dept.name} on Plexus`,
        html: `
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:40px 24px;color:#111827;">
            <div style="margin-bottom:32px;"><span style="font-size:22px;font-weight:700;color:#003D9B;">PLEXUS</span></div>
            <h1 style="font-size:22px;font-weight:700;margin:0 0 12px;">Department head invitation</h1>
            <p style="font-size:15px;color:#374151;margin:0 0 16px;">
              You&rsquo;ve been invited to serve as head of <strong>${escapeHtml(dept.name)}</strong>
              in <strong>${escapeHtml(workspace.name as string)}</strong> on Plexus. As a head you can manage
              supervisors and students in your department, review milestones, and oversee thesis progress.
            </p>
            ${message ? `<div style="margin:16px 0;padding:14px 16px;background:#F0F7FF;border-left:3px solid #003D9B;border-radius:4px;font-size:14px;color:#374151;">${escapeHtml(message)}</div>` : ''}
            <a href="${inviteLink}" style="display:inline-block;margin-top:8px;padding:12px 28px;background:#003D9B;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;font-size:15px;">Accept invitation</a>
            <p style="margin-top:28px;font-size:12px;color:#9CA3AF;">Or paste this link in your browser:<br/><a href="${inviteLink}" style="color:#6B7280;word-break:break-all;">${inviteLink}</a></p>
          </div>
        `,
      })
      if (emailResp.error) emailWarning = emailResp.error.message
    } catch (err) {
      emailWarning = err instanceof Error ? err.message : String(err)
    }
  } else {
    emailWarning = 'RESEND_API_KEY not configured'
  }

  void writeAuditEntry({
    actor_id: ctx.userId,
    action: 'institution.admin.updated',
    resource_type: 'institution',
    resource_id: ctx.institutionId,
    institution_id: ctx.institutionId,
    details: {
      summary: `Invited ${email} as head of ${dept.name}`,
      department_id: id,
      invited_email: email,
    },
  })

  return NextResponse.json({ success: true, invite_link: inviteLink, email_warning: emailWarning })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const userId = new URL(request.url).searchParams.get('user_id')
  if (!userId) return NextResponse.json({ error: 'user_id query param required' }, { status: 400 })

  const supabase = await createClient()
  const loaded = await loadCtx(supabase, id)
  if ('error' in loaded) return NextResponse.json({ error: loaded.error }, { status: loaded.status })

  const { ctx, svc, dept, workspace } = loaded

  // Demote, don't delete — preserve workspace access. Set role back to
  // 'supervisor', which is the natural pool dept heads come from.
  const { data: existing } = await svc
    .from('workspace_memberships')
    .select('user_id, role, department_id')
    .eq('workspace_id', workspace.id)
    .eq('user_id', userId)
    .eq('role', 'department_head')
    .eq('department_id', id)
    .maybeSingle()
  if (!existing) {
    return NextResponse.json({ error: 'That user is not a head of this department' }, { status: 404 })
  }

  const { error: updateErr } = await svc
    .from('workspace_memberships')
    .update({ role: 'supervisor' })
    .eq('workspace_id', workspace.id)
    .eq('user_id', userId)
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  void writeAuditEntry({
    actor_id: ctx.userId,
    action: 'institution.admin.updated',
    resource_type: 'institution',
    resource_id: ctx.institutionId,
    institution_id: ctx.institutionId,
    details: {
      summary: `Removed head of ${dept.name}`,
      department_id: id,
      target_user_id: userId,
    },
  })

  return NextResponse.json({ success: true })
}
