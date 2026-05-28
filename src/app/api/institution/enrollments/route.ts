import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getInstitutionAdminContext } from '@/lib/admin/institutionAdmin'
import { writeAuditEntry } from '@/lib/audit/auditLogger'

/**
 * Enrollments — the "this person belongs to this programme + cohort" row.
 *
 * GET  — admin lists enrollments; optional filters by programme/cohort/user.
 * POST — admin manually enrols a user who's already linked to the institution
 *        (no roster claim involved). The roster-claim flow goes through
 *        claim_roster_seat in claim-matric/route.ts.
 */

const createSchema = z.object({
  user_id: z.string().uuid(),
  programme_id: z.string().uuid().nullable().optional(),
  cohort_id: z.string().uuid().nullable().optional(),
  department_id: z.string().uuid().nullable().optional(),
  matriculation_number: z.string().trim().max(100).nullable().optional(),
})

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const ctx = await getInstitutionAdminContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const params = new URL(request.url).searchParams
  const programmeId = params.get('programme_id')
  const cohortId = params.get('cohort_id')
  const userId = params.get('user_id')
  const status = params.get('status')

  const svc = createServiceClient()
  let q = svc
    .from('institution_enrollments')
    .select(`
      id, user_id, institution_id, programme_id, cohort_id, department_id,
      matriculation_number, roster_entry_id, status, enrolled_at, end_date, created_at, updated_at,
      user:profiles!institution_enrollments_user_id_fkey(id, full_name, email, avatar_url, title),
      programme:institution_programmes(id, name, degree_level, short_code),
      cohort:institution_cohorts(id, year, label),
      department:departments(id, name)
    `, { count: 'exact' })
    .eq('institution_id', ctx.institutionId)
    .order('enrolled_at', { ascending: false })
    .limit(500)

  if (programmeId) q = q.eq('programme_id', programmeId)
  if (cohortId) q = q.eq('cohort_id', cohortId)
  if (userId) q = q.eq('user_id', userId)
  if (status) q = q.eq('status', status)

  const { data, count, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ enrollments: data ?? [], total: count ?? 0 })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const ctx = await getInstitutionAdminContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const svc = createServiceClient()

  // The target user must already be linked to caller's institution.
  const { data: target } = await svc
    .from('profiles')
    .select('id, full_name, email, institution_id')
    .eq('id', parsed.data.user_id)
    .maybeSingle()
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (target.institution_id !== ctx.institutionId) {
    return NextResponse.json({ error: 'User is not linked to your institution' }, { status: 400 })
  }

  // Verify the programme/cohort/department belong to caller's institution.
  if (parsed.data.programme_id) {
    const { data: prog } = await svc
      .from('institution_programmes')
      .select('id')
      .eq('id', parsed.data.programme_id)
      .eq('institution_id', ctx.institutionId)
      .maybeSingle()
    if (!prog) return NextResponse.json({ error: 'Programme not in your institution' }, { status: 400 })
  }
  if (parsed.data.cohort_id) {
    if (!parsed.data.programme_id) {
      return NextResponse.json({ error: 'cohort_id requires programme_id' }, { status: 400 })
    }
    const { data: cohort } = await svc
      .from('institution_cohorts')
      .select('id')
      .eq('id', parsed.data.cohort_id)
      .eq('programme_id', parsed.data.programme_id)
      .maybeSingle()
    if (!cohort) return NextResponse.json({ error: 'Cohort does not belong to that programme' }, { status: 400 })
  }
  if (parsed.data.department_id) {
    const { data: dept } = await svc
      .from('departments')
      .select('id')
      .eq('id', parsed.data.department_id)
      .eq('institution_id', ctx.institutionId)
      .maybeSingle()
    if (!dept) return NextResponse.json({ error: 'Department not in your institution' }, { status: 400 })
  }

  const { data, error } = await svc
    .from('institution_enrollments')
    .insert({
      user_id: parsed.data.user_id,
      institution_id: ctx.institutionId,
      programme_id: parsed.data.programme_id ?? null,
      cohort_id: parsed.data.cohort_id ?? null,
      department_id: parsed.data.department_id ?? null,
      matriculation_number: parsed.data.matriculation_number || null,
      status: 'active',
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'User already has an active enrollment in this programme' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  void writeAuditEntry({
    actor_id: ctx.userId,
    action: 'institution.enrollment.created',
    resource_type: 'institution_enrollment',
    resource_id: data.id,
    institution_id: ctx.institutionId,
    details: {
      summary: `Enrolled ${target.full_name ?? target.email} (admin assignment)`,
      target_user_id: parsed.data.user_id,
      programme_id: parsed.data.programme_id ?? null,
      cohort_id: parsed.data.cohort_id ?? null,
    },
  })

  return NextResponse.json({ success: true, enrollment: data })
}
