import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getInstitutionAdminContext } from '@/lib/admin/institutionAdmin'
import { writeAuditEntry } from '@/lib/audit/auditLogger'

const DEGREE_LEVELS = ['bachelor', 'master', 'phd', 'postdoc', 'staff', 'other'] as const

const patchSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  short_code: z.string().trim().max(40).nullable().optional(),
  degree_level: z.enum(DEGREE_LEVELS).optional(),
  duration_months: z.number().int().positive().max(240).nullable().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  department_id: z.string().uuid().nullable().optional(),
  active: z.boolean().optional(),
})

async function loadProgramme(svc: ReturnType<typeof createServiceClient>, id: string, institutionId: string) {
  const { data } = await svc
    .from('institution_programmes')
    .select('id, institution_id, name, active')
    .eq('id', id)
    .eq('institution_id', institutionId)
    .maybeSingle()
  return data
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const ctx = await getInstitutionAdminContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const svc = createServiceClient()

  const { data: programme, error } = await svc
    .from('institution_programmes')
    .select(`
      id, institution_id, department_id, name, short_code, degree_level,
      duration_months, description, active, created_at, updated_at,
      department:departments(id, name)
    `)
    .eq('id', id)
    .eq('institution_id', ctx.institutionId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!programme) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [{ data: cohorts }, { data: enrollments }] = await Promise.all([
    svc.from('institution_cohorts')
      .select('id, year, label, start_date, expected_completion')
      .eq('programme_id', id)
      .order('year', { ascending: false }),
    svc.from('institution_enrollments')
      .select(`
        id, user_id, cohort_id, department_id, matriculation_number,
        status, enrolled_at, end_date,
        user:profiles!institution_enrollments_user_id_fkey(id, full_name, email, avatar_url, title),
        cohort:institution_cohorts(id, year, label),
        department:departments(id, name)
      `)
      .eq('programme_id', id)
      .order('enrolled_at', { ascending: false }),
  ])

  return NextResponse.json({
    programme,
    cohorts: cohorts ?? [],
    enrollments: enrollments ?? [],
  })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const ctx = await getInstitutionAdminContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const svc = createServiceClient()
  const existing = await loadProgramme(svc, id, ctx.institutionId)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (parsed.data.department_id) {
    const { data: dept } = await svc
      .from('departments')
      .select('id')
      .eq('id', parsed.data.department_id)
      .eq('institution_id', ctx.institutionId)
      .maybeSingle()
    if (!dept) return NextResponse.json({ error: 'Department does not belong to your institution' }, { status: 400 })
  }

  const update: Record<string, unknown> = {}
  for (const k of ['name','short_code','degree_level','duration_months','description','department_id','active'] as const) {
    if (parsed.data[k] !== undefined) update[k] = parsed.data[k]
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No updatable fields supplied' }, { status: 400 })
  }

  const { data, error } = await svc
    .from('institution_programmes')
    .update(update)
    .eq('id', id)
    .select('id, name, active')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A programme with that name already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const wasDeactivation = parsed.data.active === false && existing.active === true
  void writeAuditEntry({
    actor_id: ctx.userId,
    action: wasDeactivation ? 'institution.programme.deactivated' : 'institution.programme.updated',
    resource_type: 'institution_programme',
    resource_id: id,
    institution_id: ctx.institutionId,
    details: {
      summary: wasDeactivation
        ? `Deactivated programme ${existing.name}`
        : `Updated ${Object.keys(update).join(', ')} on ${existing.name}`,
      fields: update,
    },
  })

  return NextResponse.json({ success: true, programme: data })
}

/**
 * DELETE acts as soft-delete (active=false) when the programme has any
 * cohorts or enrollments. Only truly unused programmes are physically removed.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const ctx = await getInstitutionAdminContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const svc = createServiceClient()
  const existing = await loadProgramme(svc, id, ctx.institutionId)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [{ count: cohortCount }, { count: enrolledCount }, { count: rosterCount }] = await Promise.all([
    svc.from('institution_cohorts').select('id', { count: 'exact', head: true }).eq('programme_id', id),
    svc.from('institution_enrollments').select('id', { count: 'exact', head: true }).eq('programme_id', id),
    svc.from('institution_roster_entries').select('id', { count: 'exact', head: true }).eq('programme_id', id),
  ])

  if ((cohortCount ?? 0) > 0 || (enrolledCount ?? 0) > 0 || (rosterCount ?? 0) > 0) {
    // Soft delete — preserves references.
    const { error } = await svc.from('institution_programmes').update({ active: false }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    void writeAuditEntry({
      actor_id: ctx.userId,
      action: 'institution.programme.deactivated',
      resource_type: 'institution_programme',
      resource_id: id,
      institution_id: ctx.institutionId,
      details: {
        summary: `Deactivated programme ${existing.name} (has dependent rows)`,
        cohorts: cohortCount ?? 0,
        enrollments: enrolledCount ?? 0,
        roster_entries: rosterCount ?? 0,
      },
    })
    return NextResponse.json({ success: true, soft: true })
  }

  const { error } = await svc.from('institution_programmes').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  void writeAuditEntry({
    actor_id: ctx.userId,
    action: 'institution.programme.deactivated',
    resource_type: 'institution_programme',
    resource_id: id,
    institution_id: ctx.institutionId,
    details: { summary: `Removed empty programme ${existing.name}` },
  })

  return NextResponse.json({ success: true, soft: false })
}
