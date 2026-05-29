import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { checkRateLimit } from '@/lib/rateLimit'
import { writeAuditEntry } from '@/lib/audit/auditLogger'

/**
 * Self-service matric claim for users who are already linked to an
 * institution but have no enrollment yet (e.g. they got linked via the
 * email-domain auto-approval, or an admin approved their link request
 * without assigning a programme).
 *
 * Runs `claim_roster_seat` against the user's already-linked institution.
 * On a match, the roster entry is claimed and an enrollment row is created
 * just like the new-link path.
 */

const bodySchema = z.object({
  matriculation_number: z.string().trim().min(1).max(100),
})

export async function POST(request: NextRequest) {
  const rl = checkRateLimit(request, { limit: 10, windowMs: 60 * 60 * 1000 })
  if (rl) return rl

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const svc = createServiceClient()
  const { data: profile } = await svc
    .from('profiles')
    .select('id, institution_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.institution_id) {
    return NextResponse.json(
      { error: 'You are not linked to an institution yet. Link first, then add your matric.' },
      { status: 409 },
    )
  }

  // Don't allow a re-claim when the user already has an active enrollment
  // for this institution — they should edit, not re-claim.
  const { data: existingActive } = await svc
    .from('institution_enrollments')
    .select('id, programme_id, matriculation_number')
    .eq('user_id', user.id)
    .eq('institution_id', profile.institution_id)
    .eq('status', 'active')
    .maybeSingle()

  if (existingActive?.matriculation_number) {
    return NextResponse.json(
      { error: 'You already have a verified enrollment. Ask your admin to change your matric.' },
      { status: 409 },
    )
  }

  const { data: enrollmentId, error } = await svc.rpc('claim_roster_seat', {
    p_user_id: user.id,
    p_institution_id: profile.institution_id,
    p_matriculation_number: parsed.data.matriculation_number,
    p_decided_by: user.id,
  })

  if (error) {
    if (error.code === 'PX001') {
      return NextResponse.json(
        { error: 'That matriculation number has already been claimed by someone else.' },
        { status: 409 },
      )
    }
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'You already have an active enrollment for that programme. Ask your admin to switch.' },
        { status: 409 },
      )
    }
    console.error('[CLAIM_MATRIC] claim_roster_seat failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!enrollmentId) {
    return NextResponse.json(
      { error: 'No roster entry matches that matric number for your institution.' },
      { status: 404 },
    )
  }

  // If the user had a placeholder enrollment (no matric, no programme), the
  // RPC inserted a new one. Mark the old placeholder withdrawn so we don't
  // accumulate duplicates.
  if (existingActive && !existingActive.programme_id) {
    await svc
      .from('institution_enrollments')
      .update({ status: 'withdrawn', end_date: new Date().toISOString().slice(0, 10) })
      .eq('id', existingActive.id)
  }

  void writeAuditEntry({
    actor_id: user.id,
    action: 'institution.roster.claimed',
    resource_type: 'institution_enrollment',
    resource_id: enrollmentId as string,
    institution_id: profile.institution_id,
    details: {
      summary: 'User self-claimed a matriculation number on an existing institution link',
      enrollment_id: enrollmentId,
      via: 'post_link_self_service',
    },
  })

  return NextResponse.json({ success: true, enrollment_id: enrollmentId })
}
