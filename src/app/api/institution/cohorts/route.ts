import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getInstitutionAdminContext } from '@/lib/admin/institutionAdmin'
import { writeAuditEntry } from '@/lib/audit/auditLogger'

/**
 * Cohorts (yearly intakes of a programme).
 * Always scoped to a programme; programme must belong to caller's institution.
 */

const createSchema = z.object({
  programme_id: z.string().uuid(),
  year: z.number().int().min(1900).max(2200),
  label: z.string().trim().max(80).nullable().optional(),
  start_date: z.string().date().nullable().optional(),
  expected_completion: z.string().date().nullable().optional(),
})

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const ctx = await getInstitutionAdminContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const programmeId = new URL(request.url).searchParams.get('programme_id')
  const svc = createServiceClient()

  // Resolve allowed programme ids = those of caller's institution.
  let programmeFilter: string[] | null = null
  if (programmeId) {
    const { data: prog } = await svc
      .from('institution_programmes')
      .select('id')
      .eq('id', programmeId)
      .eq('institution_id', ctx.institutionId)
      .maybeSingle()
    if (!prog) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    programmeFilter = [programmeId]
  } else {
    const { data: progs } = await svc
      .from('institution_programmes')
      .select('id')
      .eq('institution_id', ctx.institutionId)
    programmeFilter = (progs ?? []).map((p) => p.id)
  }

  if (programmeFilter.length === 0) return NextResponse.json({ cohorts: [] })

  const { data, error } = await svc
    .from('institution_cohorts')
    .select(`
      id, programme_id, year, label, start_date, expected_completion, created_at, updated_at,
      programme:institution_programmes(id, name, degree_level)
    `)
    .in('programme_id', programmeFilter)
    .order('year', { ascending: false })
    .order('label', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ cohorts: data ?? [] })
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
  const { data: prog } = await svc
    .from('institution_programmes')
    .select('id, name')
    .eq('id', parsed.data.programme_id)
    .eq('institution_id', ctx.institutionId)
    .maybeSingle()
  if (!prog) return NextResponse.json({ error: 'Programme not in your institution' }, { status: 400 })

  const { data, error } = await svc
    .from('institution_cohorts')
    .insert({
      programme_id: parsed.data.programme_id,
      year: parsed.data.year,
      label: parsed.data.label || null,
      start_date: parsed.data.start_date ?? null,
      expected_completion: parsed.data.expected_completion ?? null,
    })
    .select('id, year, label')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A cohort with that year and label already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  void writeAuditEntry({
    actor_id: ctx.userId,
    action: 'institution.cohort.created',
    resource_type: 'institution_cohort',
    resource_id: data.id,
    institution_id: ctx.institutionId,
    details: {
      summary: `Created ${data.year}${data.label ? ` (${data.label})` : ''} cohort for ${prog.name}`,
      programme_id: prog.id,
    },
  })

  return NextResponse.json({ success: true, cohort: data })
}
