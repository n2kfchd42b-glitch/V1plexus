import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getInstitutionAdminContext } from '@/lib/admin/institutionAdmin'
import { writeAuditEntry } from '@/lib/audit/auditLogger'

/**
 * Programmes (degree programmes offered by the institution).
 *
 * GET  — list every programme of the caller's institution (admins see all,
 *        including inactive). Returns enrolled/cohort counts so the list
 *        page renders the full picture without extra round trips.
 * POST — create a new programme.
 */

const DEGREE_LEVELS = ['bachelor', 'master', 'phd', 'postdoc', 'staff', 'other'] as const

const createSchema = z.object({
  name: z.string().trim().min(1).max(200),
  short_code: z.string().trim().max(40).optional().or(z.literal('')),
  degree_level: z.enum(DEGREE_LEVELS),
  duration_months: z.number().int().positive().max(240).nullable().optional(),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  department_id: z.string().uuid().nullable().optional(),
})

export async function GET() {
  const supabase = await createClient()
  const ctx = await getInstitutionAdminContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const svc = createServiceClient()

  const { data: programmes, error } = await svc
    .from('institution_programmes')
    .select(`
      id, institution_id, department_id, name, short_code, degree_level,
      duration_months, description, active, created_at, updated_at,
      department:departments(id, name)
    `)
    .eq('institution_id', ctx.institutionId)
    .order('active', { ascending: false })
    .order('name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Aggregate cohort + enrolled counts per programme in two scoped queries.
  const ids = (programmes ?? []).map((p) => p.id)
  if (ids.length === 0) {
    return NextResponse.json({ programmes: [] })
  }

  // "Enrolled" in Plexus's model = on the roster (the admin has uploaded them
  // as students of this programme). "Signed up" = they've claimed their matric
  // and activated their Plexus account. The two metrics live side by side.
  const [cohortAgg, rosterAgg] = await Promise.all([
    svc.from('institution_cohorts').select('programme_id').in('programme_id', ids),
    svc.from('institution_roster_entries')
      .select('programme_id, status')
      .in('programme_id', ids)
      .neq('status', 'invalidated'),
  ])

  const cohortCounts = new Map<string, number>()
  for (const row of cohortAgg.data ?? []) {
    cohortCounts.set(row.programme_id, (cohortCounts.get(row.programme_id) ?? 0) + 1)
  }
  const enrolledCounts = new Map<string, number>()
  const signedUpCounts = new Map<string, number>()
  for (const row of rosterAgg.data ?? []) {
    if (!row.programme_id) continue
    enrolledCounts.set(row.programme_id, (enrolledCounts.get(row.programme_id) ?? 0) + 1)
    if (row.status === 'claimed') {
      signedUpCounts.set(row.programme_id, (signedUpCounts.get(row.programme_id) ?? 0) + 1)
    }
  }

  return NextResponse.json({
    programmes: (programmes ?? []).map((p) => ({
      ...p,
      cohort_count: cohortCounts.get(p.id) ?? 0,
      enrolled_count: enrolledCounts.get(p.id) ?? 0,
      signed_up_count: signedUpCounts.get(p.id) ?? 0,
    })),
  })
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

  // Verify the department (if supplied) belongs to the caller's institution.
  if (parsed.data.department_id) {
    const { data: dept } = await svc
      .from('departments')
      .select('id')
      .eq('id', parsed.data.department_id)
      .eq('institution_id', ctx.institutionId)
      .maybeSingle()
    if (!dept) {
      return NextResponse.json({ error: 'Department does not belong to your institution' }, { status: 400 })
    }
  }

  const { data, error } = await svc
    .from('institution_programmes')
    .insert({
      institution_id: ctx.institutionId,
      name: parsed.data.name,
      short_code: parsed.data.short_code || null,
      degree_level: parsed.data.degree_level,
      duration_months: parsed.data.duration_months ?? null,
      description: parsed.data.description || null,
      department_id: parsed.data.department_id ?? null,
    })
    .select('id, name')
    .single()

  if (error) {
    // Handle the unique-name conflict gracefully.
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A programme with that name already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  void writeAuditEntry({
    actor_id: ctx.userId,
    action: 'institution.programme.created',
    resource_type: 'institution_programme',
    resource_id: data.id,
    institution_id: ctx.institutionId,
    details: {
      summary: `Created programme ${data.name} (${parsed.data.degree_level})`,
      degree_level: parsed.data.degree_level,
    },
  })

  return NextResponse.json({ success: true, programme: data })
}
