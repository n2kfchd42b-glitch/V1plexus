import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { checkRateLimit } from '@/lib/rateLimit'
import { writeAuditEntry } from '@/lib/audit/auditLogger'
import { linkUserToInstitution } from '@/lib/institutionLinking'

// DELETE: self-service unlink. Runs the unlink_user_from_institution RPC
// (atomic across membership / enrollments / profile) and audits the result.
export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: priorInstitutionId, error } = await svc.rpc('unlink_user_from_institution', {
    p_user_id: user.id,
  })

  if (error) {
    console.error('[INSTITUTION_UNLINK] RPC failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!priorInstitutionId) {
    return NextResponse.json({ error: 'You are not linked to any institution' }, { status: 409 })
  }

  void writeAuditEntry({
    actor_id: user.id,
    action: 'institution.link.unlinked',
    resource_type: 'institution',
    resource_id: priorInstitutionId as string,
    institution_id: priorInstitutionId as string,
    details: {
      summary: 'User unlinked themselves from the institution',
      target_user_id: user.id,
    },
  })

  return NextResponse.json({ success: true })
}

/**
 * Individual user → institution linking (PR B).
 *
 * GET  — current user's linking state: active institution + recent requests.
 * POST — submit a link request to a registered institution. Auto-approves when
 *        the user's email domain matches the institution's auto_link_domains
 *        list. Otherwise the request is queued for an institution
 *        admin/coordinator to action.
 */

const submitSchema = z.object({
  institution_id: z.string().uuid(),
  message: z.string().trim().max(2000).optional().or(z.literal('')),
  matriculation_number: z.string().trim().max(100).optional().or(z.literal('')),
})

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [profileRes, requestRes, enrollmentRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, email, institution_id, public_affiliation_visible, institution:institutions(id, name, short_name, country, type, auto_link_domains, logo_url, slug, verification_tier)')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('institution_link_requests')
      .select('id, institution_id, status, message, auto_approved, decided_at, decline_reason, created_at, institution:institutions(id, name, short_name, country, type)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('institution_enrollments')
      .select(`
        id, institution_id, programme_id, cohort_id, department_id,
        matriculation_number, status, enrolled_at, end_date,
        programme:institution_programmes(id, name, short_code, degree_level),
        cohort:institution_cohorts(id, year, label),
        department:departments(id, name)
      `)
      .eq('user_id', user.id)
      .order('enrolled_at', { ascending: false }),
  ])

  return NextResponse.json({
    profile: profileRes.data ?? null,
    requests: requestRes.data ?? [],
    enrollments: enrollmentRes.data ?? [],
  })
}

export async function POST(request: NextRequest) {
  // Modest rate-limit to deter spam; legitimate users submit one request.
  const rl = await checkRateLimit(request, { limit: 10, windowMs: 60 * 60 * 1000 })
  if (rl) return rl

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = submitSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { institution_id, message, matriculation_number } = parsed.data
  const svc = createServiceClient()

  const { data: institution, error: instErr } = await svc
    .from('institutions')
    .select('id, name, auto_link_domains, provisioned_at, active')
    .eq('id', institution_id)
    .maybeSingle()

  if (instErr || !institution) {
    return NextResponse.json({ error: 'Institution not found' }, { status: 404 })
  }
  if (!institution.provisioned_at || institution.active === false) {
    return NextResponse.json({ error: 'Institution is not accepting link requests' }, { status: 400 })
  }

  const { data: profile, error: profileErr } = await svc
    .from('profiles')
    .select('id, email, institution_id, full_name')
    .eq('id', user.id)
    .maybeSingle()

  if (profileErr || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  if (profile.institution_id && profile.institution_id === institution.id) {
    return NextResponse.json({ error: 'You are already linked to this institution' }, { status: 409 })
  }
  if (profile.institution_id) {
    return NextResponse.json(
      { error: 'You are already linked to a different institution. Unlink first to switch.' },
      { status: 409 },
    )
  }

  const { data: existing } = await svc
    .from('institution_link_requests')
    .select('id')
    .eq('user_id', user.id)
    .eq('institution_id', institution.id)
    .eq('status', 'pending')
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'You already have a pending request to this institution' }, { status: 409 })
  }

  // ── Matriculation roster claim (preferred path when supplied) ────────────
  // If the user provides a matric number, try claim_roster_seat first. On a
  // match it links + enrols atomically; on no-match we fall through to the
  // auto-domain / pending paths below so the user isn't blocked.
  if (matriculation_number && matriculation_number.trim().length > 0) {
    const { data: enrollmentId, error: claimErr } = await svc.rpc('claim_roster_seat', {
      p_user_id: user.id,
      p_institution_id: institution.id,
      p_matriculation_number: matriculation_number.trim(),
      p_decided_by: user.id,
    })

    if (claimErr) {
      // PX001 = matric already claimed (explicit RAISE from claim_roster_seat).
      // 23505 here means a real unique-constraint violation inside the RPC
      // (e.g. user already has an active enrollment in the programme).
      if (claimErr.code === 'PX001') {
        return NextResponse.json({ error: 'That matriculation number has already been claimed' }, { status: 409 })
      }
      if (claimErr.code === '23505') {
        return NextResponse.json({
          error: 'You already have an active enrollment for that programme. Contact your institution admin to switch.',
        }, { status: 409 })
      }
      console.error('[INSTITUTION_LINK] claim_roster_seat failed:', claimErr)
      return NextResponse.json({ error: claimErr.message }, { status: 500 })
    }

    if (enrollmentId) {
      void writeAuditEntry({
        actor_id: user.id,
        action: 'institution.roster.claimed',
        resource_type: 'institution_enrollment',
        resource_id: enrollmentId as string,
        institution_id: institution.id,
        details: {
          summary: `${profile.full_name ?? profile.email} verified via matriculation number → ${institution.name}`,
          matriculation_number: matriculation_number.trim(),
        },
      })
      return NextResponse.json({
        status: 'approved',
        auto_approved: true,
        verified_via: 'matriculation',
        institution_id: institution.id,
        enrollment_id: enrollmentId,
      })
    }

    // No match — fail fast rather than silently routing to the manual queue.
    // The user provided a specific matric; if it doesn't match, the right
    // response is "we couldn't find that" so they can correct it or pick the
    // manual-request path explicitly.
    return NextResponse.json({
      error: 'Matriculation number not found in this institution\'s roster',
      hint: 'Double-check the number, or leave the field blank to submit a manual link request.',
    }, { status: 404 })
  }

  const callerEmail = (profile.email ?? user.email ?? '').toLowerCase()
  const callerDomain = callerEmail.includes('@') ? callerEmail.split('@')[1] : ''
  const allowedDomains = (institution.auto_link_domains ?? [])
    .map((d: string) => d.toLowerCase().trim())
    .filter(Boolean)
  const autoApprove = Boolean(callerDomain) && allowedDomains.includes(callerDomain)

  if (autoApprove) {
    const linked = await linkUserToInstitution({
      svc,
      userId: user.id,
      institutionId: institution.id,
      decidedBy: user.id,
      autoApproved: true,
      message: message?.trim() || null,
    })

    if ('error' in linked) {
      return NextResponse.json({ error: linked.error }, { status: 500 })
    }

    void writeAuditEntry({
      actor_id: user.id,
      action: 'institution.link.auto_approved',
      resource_type: 'institution',
      resource_id: institution.id,
      institution_id: institution.id,
      details: {
        summary: `Auto-linked ${profile.full_name ?? callerEmail} to ${institution.name} via domain ${callerDomain}`,
        request_id: linked.requestId,
        domain: callerDomain,
      },
    })

    return NextResponse.json({
      status: 'approved',
      auto_approved: true,
      institution_id: institution.id,
      request_id: linked.requestId,
    })
  }

  const { data: inserted, error: reqErr } = await svc
    .from('institution_link_requests')
    .insert({
      user_id: user.id,
      institution_id: institution.id,
      status: 'pending',
      message: message?.trim() || null,
    })
    .select('id')
    .single()

  if (reqErr || !inserted) {
    console.error('[INSTITUTION_LINK] Insert failed:', reqErr)
    return NextResponse.json({ error: reqErr?.message ?? 'Could not submit request' }, { status: 500 })
  }

  void writeAuditEntry({
    actor_id: user.id,
    action: 'institution.link.requested',
    resource_type: 'institution',
    resource_id: institution.id,
    institution_id: institution.id,
    details: {
      summary: `Requested link to ${institution.name}`,
      request_id: inserted.id,
    },
  })

  return NextResponse.json({
    status: 'pending',
    auto_approved: false,
    institution_id: institution.id,
    request_id: inserted.id,
  })
}
