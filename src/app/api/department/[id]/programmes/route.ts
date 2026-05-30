import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getScope } from '@/lib/admin/scope'
import { writeAuditEntry } from '@/lib/audit/auditLogger'

/**
 * Programmes scoped to one department. Mirrors the shape of the
 * institution-wide programmes endpoint, but department_id is locked to the
 * URL parameter — heads can't accidentally retag a programme into another
 * department.
 *
 *   GET  — list this department's programmes with enrolled / signed-up counts
 *   POST — create a programme in this department
 *
 * Access: institution admins or heads of THIS department.
 */

const DEGREE_LEVELS = ['bachelor', 'master', 'phd', 'postdoc', 'staff', 'other'] as const

const createSchema = z.object({
  name:            z.string().trim().min(1).max(200),
  short_code:      z.string().trim().max(40).optional().or(z.literal('')),
  degree_level:    z.enum(DEGREE_LEVELS),
  duration_months: z.number().int().positive().max(240).nullable().optional(),
  description:     z.string().trim().max(2000).optional().or(z.literal('')),
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
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const loaded = await loadCtx(supabase, id)
  if ('error' in loaded) return NextResponse.json({ error: loaded.error }, { status: loaded.status })

  const { svc } = loaded

  const { data: programmes, error } = await svc
    .from('institution_programmes')
    .select('id, name, short_code, degree_level, duration_months, description, active, created_at, updated_at')
    .eq('department_id', id)
    .order('active', { ascending: false })
    .order('name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const ids = (programmes ?? []).map(p => p.id as string)
  if (ids.length === 0) {
    return NextResponse.json({ programmes: [] })
  }

  // Enrolled = on roster (non-invalidated); signed-up = roster.status='claimed'.
  const { data: roster } = await svc
    .from('institution_roster_entries')
    .select('programme_id, status')
    .in('programme_id', ids)
    .neq('status', 'invalidated')

  const enrolled = new Map<string, number>()
  const signedUp = new Map<string, number>()
  for (const r of roster ?? []) {
    if (!r.programme_id) continue
    enrolled.set(r.programme_id, (enrolled.get(r.programme_id) ?? 0) + 1)
    if (r.status === 'claimed') {
      signedUp.set(r.programme_id, (signedUp.get(r.programme_id) ?? 0) + 1)
    }
  }

  return NextResponse.json({
    programmes: (programmes ?? []).map(p => ({
      ...p,
      enrolled_count: enrolled.get(p.id as string) ?? 0,
      signed_up_count: signedUp.get(p.id as string) ?? 0,
    })),
  })
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

  const { data: inserted, error: insertErr } = await svc
    .from('institution_programmes')
    .insert({
      institution_id: scope.institutionId,
      department_id: id,
      name: parsed.data.name,
      short_code: parsed.data.short_code || null,
      degree_level: parsed.data.degree_level,
      duration_months: parsed.data.duration_months ?? null,
      description: parsed.data.description || null,
      active: true,
    })
    .select('id, name')
    .single()

  if (insertErr) {
    if (insertErr.code === '23505') {
      return NextResponse.json({ error: 'A programme with that name already exists in this institution' }, { status: 409 })
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
      summary: `Added programme "${inserted.name}" to ${dept.name}`,
      department_id: id,
      programme_id: inserted.id,
    },
  })

  return NextResponse.json({ success: true, programme: inserted })
}
