import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getScope } from '@/lib/admin/scope'
import { writeAuditEntry } from '@/lib/audit/auditLogger'

/**
 * Roster entries for one department, scoped to its programmes.
 *
 *   GET  — list entries in this dept's programmes (optional filters)
 *   POST — add a single matriculation seat to one of this dept's programmes
 *
 * Bulk CSV upload stays at /api/institution/roster (institution-admin only).
 * Heads add seats one-at-a-time here; admins can do either.
 */

const INTENDED_ROLES = ['researcher', 'student', 'supervisor', 'admin', 'coordinator', 'viewer'] as const

const createSchema = z.object({
  programme_id:         z.string().uuid(),
  cohort_id:            z.string().uuid().nullable().optional(),
  matriculation_number: z.string().trim().min(1).max(100),
  full_name_hint:       z.string().trim().max(200).nullable().optional(),
  email_hint:           z.string().trim().max(254).nullable().optional(),
  intended_role:        z.enum(INTENDED_ROLES).default('student'),
  notes:                z.string().trim().max(2000).nullable().optional(),
})

async function loadCtx(
  supabase: Awaited<ReturnType<typeof createClient>>,
  departmentId: string,
) {
  const scope = await getScope(supabase)
  if (!scope) return { error: 'Forbidden', status: 403 as const }
  if (scope.departmentIds !== 'all' && !scope.departmentIds.includes(departmentId)) {
    return { error: 'Forbidden', status: 403 as const }
  }

  const svc = createServiceClient()
  const { data: dept } = await svc
    .from('departments')
    .select('id, name, institution_id')
    .eq('id', departmentId)
    .maybeSingle()
  if (!dept || dept.institution_id !== scope.institutionId) {
    return { error: 'Department not found', status: 404 as const }
  }

  return { scope, svc, dept }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const loaded = await loadCtx(supabase, id)
  if ('error' in loaded) return NextResponse.json({ error: loaded.error }, { status: loaded.status })

  const { svc } = loaded
  const url = new URL(request.url)
  const status = url.searchParams.get('status')
  const programmeId = url.searchParams.get('programme_id')

  // Resolve programmes belonging to this dept first. Filter the roster fetch
  // by those programme_ids so we never leak entries from sibling depts even
  // if a roster row has a mismatched denormalised department_id.
  const { data: progs } = await svc
    .from('institution_programmes')
    .select('id')
    .eq('department_id', id)
  const progIds = (progs ?? []).map(p => p.id as string)
  if (progIds.length === 0) {
    return NextResponse.json({ entries: [], total: 0 })
  }

  let q = svc
    .from('institution_roster_entries')
    .select(`
      id, matriculation_number, programme_id, cohort_id,
      intended_role, full_name_hint, email_hint, notes, status,
      claimed_by, claimed_at, created_at,
      programme:institution_programmes(id, name, short_code, degree_level),
      cohort:institution_cohorts(id, year, label),
      claimed_user:profiles!institution_roster_entries_claimed_by_fkey(id, full_name, email, avatar_url)
    `, { count: 'exact' })
    .in('programme_id', progIds)
    .order('status', { ascending: true })   // unclaimed before claimed before invalidated
    .order('created_at', { ascending: false })
    .limit(500)

  if (status) q = q.eq('status', status)
  if (programmeId) q = q.eq('programme_id', programmeId)

  const { data, count, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ entries: data ?? [], total: count ?? 0 })
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
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { scope, svc, dept } = loaded

  // Programme must belong to this dept.
  const { data: prog } = await svc
    .from('institution_programmes')
    .select('id, name, department_id')
    .eq('id', parsed.data.programme_id)
    .maybeSingle()
  if (!prog || prog.department_id !== id) {
    return NextResponse.json({ error: 'Programme is not in this department' }, { status: 400 })
  }

  // Cohort (if supplied) must belong to that programme.
  if (parsed.data.cohort_id) {
    const { data: cohort } = await svc
      .from('institution_cohorts')
      .select('id, programme_id')
      .eq('id', parsed.data.cohort_id)
      .maybeSingle()
    if (!cohort || cohort.programme_id !== parsed.data.programme_id) {
      return NextResponse.json({ error: 'Cohort is not in that programme' }, { status: 400 })
    }
  }

  const { data: inserted, error: insertErr } = await svc
    .from('institution_roster_entries')
    .insert({
      institution_id: scope.institutionId,
      department_id: id,
      programme_id: parsed.data.programme_id,
      cohort_id: parsed.data.cohort_id ?? null,
      matriculation_number: parsed.data.matriculation_number,
      full_name_hint: parsed.data.full_name_hint || null,
      email_hint: parsed.data.email_hint || null,
      intended_role: parsed.data.intended_role,
      notes: parsed.data.notes || null,
      status: 'unclaimed',
      uploaded_by: scope.userId,
    })
    .select('id, matriculation_number')
    .single()
  if (insertErr) {
    if (insertErr.code === '23505') {
      return NextResponse.json({ error: 'That matriculation number is already on the roster' }, { status: 409 })
    }
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  void writeAuditEntry({
    actor_id: scope.userId,
    action: 'institution.admin.updated',
    resource_type: 'institution',
    resource_id: scope.institutionId,
    institution_id: scope.institutionId,
    details: {
      summary: `Added roster seat ${inserted.matriculation_number} for ${prog.name} (${dept.name})`,
      department_id: id,
      programme_id: parsed.data.programme_id,
      roster_entry_id: inserted.id,
    },
  })

  return NextResponse.json({ success: true, entry: inserted })
}
