import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isPlatformAdmin } from '@/lib/admin/platformAdmin'
import { writeAuditEntry } from '@/lib/audit/auditLogger'

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/

const DOMAIN_REGEX = /^[a-z0-9.-]+\.[a-z]{2,}$/

const provisionSchema = z.object({
  institution_name: z.string().trim().min(1).max(300),
  short_name: z.string().trim().max(60).nullable().optional(),
  type: z.enum(['university', 'hospital', 'research_institute', 'ngo', 'government', 'other']).nullable().optional(),
  country: z.string().trim().max(120).nullable().optional(),
  email_domain: z.string().trim().toLowerCase().max(253).regex(DOMAIN_REGEX, 'Invalid domain').nullable().optional(),
  auto_link_domains: z.array(z.string().trim().toLowerCase().max(253).regex(DOMAIN_REGEX, 'Invalid domain')).max(20).optional(),
  admin_email: z.string().trim().toLowerCase().regex(EMAIL_REGEX, 'Invalid email'),
  admin_name: z.string().trim().max(200).nullable().optional(),
  inquiry_id: z.string().uuid().nullable().optional(),
})

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'workspace'
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !isPlatformAdmin(user.id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = provisionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const input = parsed.data
  const svc = createServiceClient()

  // 1. Create institution
  const { data: institution, error: instErr } = await svc
    .from('institutions')
    .insert({
      name: input.institution_name,
      short_name: input.short_name ?? null,
      type: input.type ?? null,
      country: input.country ?? null,
      email_domain: input.email_domain ?? null,
      auto_link_domains: input.auto_link_domains ?? [],
      verification_tier: 'SELF_ATTESTED',
      provisioned_at: new Date().toISOString(),
      provisioned_by: user.id,
    })
    .select('id, name')
    .single()

  if (instErr || !institution) {
    console.error('[ADMIN_INSTITUTIONS] Institution insert failed:', instErr)
    return NextResponse.json({ error: instErr?.message ?? 'Failed to create institution' }, { status: 500 })
  }

  // 2. Create the institutional workspace (with a unique slug)
  const baseSlug = slugify(input.short_name || input.institution_name)
  let slug = baseSlug
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data: clash } = await svc
      .from('workspaces')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()
    if (!clash) break
    slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`
  }

  const { data: workspace, error: wsErr } = await svc
    .from('workspaces')
    .insert({
      type: 'institutional',
      name: input.institution_name,
      slug,
      institution_id: institution.id,
    })
    .select('id')
    .single()

  if (wsErr || !workspace) {
    console.error('[ADMIN_INSTITUTIONS] Workspace insert failed:', wsErr)
    return NextResponse.json({ error: wsErr?.message ?? 'Failed to create workspace' }, { status: 500 })
  }

  // 3. Create the admin invitation
  const token = crypto.randomUUID().replace(/-/g, '')
  const { error: inviteErr } = await svc
    .from('workspace_invitations')
    .insert({
      workspace_id: workspace.id,
      email: input.admin_email,
      role: 'admin',
      token,
      invited_by: user.id,
      status: 'pending',
    })

  if (inviteErr) {
    console.error('[ADMIN_INSTITUTIONS] Invitation insert failed:', inviteErr)
    return NextResponse.json({ error: inviteErr.message }, { status: 500 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://plexus.science'
  const inviteLink = `${appUrl}/invite/${token}`

  // 4. Send the invite email (best-effort — invitation is still recorded if email fails)
  let emailWarning: string | null = null
  if (process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      const greeting = input.admin_name ? `Hi ${escapeHtml(input.admin_name)},` : 'Hi,'
      const emailResp = await resend.emails.send({
        from: 'Plexus <invitations@plexus.science>',
        to: input.admin_email,
        subject: `${input.institution_name} is set up on Plexus — accept your admin invite`,
        html: `
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:40px 24px;color:#111827;">
            <div style="margin-bottom:32px;">
              <span style="font-size:22px;font-weight:700;color:#003D9B;">PLEXUS</span>
            </div>
            <h1 style="font-size:22px;font-weight:700;margin:0 0 12px;">Your institution is ready on Plexus</h1>
            <p style="font-size:15px;color:#374151;margin:0 0 12px;">${greeting}</p>
            <p style="font-size:15px;color:#374151;margin:0 0 16px;">
              We&rsquo;ve provisioned <strong>${escapeHtml(input.institution_name)}</strong> on Plexus and reserved the admin seat for you.
              Accept the invite below to set up your account and start onboarding your team.
            </p>
            <a href="${inviteLink}"
              style="display:inline-block;margin-top:8px;padding:12px 28px;background:#003D9B;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;font-size:15px;">
              Accept admin invite
            </a>
            <p style="margin-top:28px;font-size:12px;color:#9CA3AF;">
              Or paste this link in your browser:<br/>
              <a href="${inviteLink}" style="color:#6B7280;word-break:break-all;">${inviteLink}</a>
            </p>
            <hr style="border:none;border-top:1px solid #E5E7EB;margin:32px 0 20px;" />
            <p style="font-size:11px;color:#9CA3AF;margin:0;">
              Plexus Research Platform &mdash; This invite was sent because your institution signed up for Plexus.
            </p>
          </div>
        `,
      })
      if (emailResp.error) {
        emailWarning = emailResp.error.message
        console.error('[ADMIN_INSTITUTIONS] Resend error:', emailResp.error)
      }
    } catch (err) {
      emailWarning = err instanceof Error ? err.message : String(err)
      console.error('[ADMIN_INSTITUTIONS] Email send threw:', err)
    }
  } else {
    emailWarning = 'RESEND_API_KEY not configured'
  }

  // 5. Mark the originating inquiry as converted, if one was supplied
  if (input.inquiry_id) {
    const { error: inqErr } = await svc
      .from('institution_inquiries')
      .update({
        status: 'converted',
        converted_institution_id: institution.id,
        responded_at: new Date().toISOString(),
        responded_by: user.id,
      })
      .eq('id', input.inquiry_id)
    if (inqErr) {
      console.error('[ADMIN_INSTITUTIONS] Inquiry update failed:', inqErr)
    } else {
      void writeAuditEntry({
        actor_id: user.id,
        action: 'institution.inquiry.converted',
        resource_type: 'institution',
        resource_id: institution.id,
        institution_id: institution.id,
        details: {
          summary: `Converted inquiry ${input.inquiry_id} → ${institution.name}`,
          inquiry_id: input.inquiry_id,
        },
      })
    }
  }

  // 6. Audit: institution provisioned (catch-all for the whole flow)
  void writeAuditEntry({
    actor_id: user.id,
    action: 'institution.provisioned',
    resource_type: 'institution',
    resource_id: institution.id,
    institution_id: institution.id,
    details: {
      summary: `Provisioned institution ${institution.name} with admin ${input.admin_email}`,
      workspace_id: workspace.id,
      admin_email: input.admin_email,
      auto_link_domains: input.auto_link_domains ?? [],
      from_inquiry_id: input.inquiry_id ?? null,
    },
  })

  return NextResponse.json({
    success: true,
    institution_id: institution.id,
    workspace_id: workspace.id,
    invite_link: inviteLink,
    email_warning: emailWarning,
  })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
