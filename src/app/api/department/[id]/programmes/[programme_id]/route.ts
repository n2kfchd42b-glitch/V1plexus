import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getScope } from '@/lib/admin/scope'
import { writeAuditEntry } from '@/lib/audit/auditLogger'

/**
 * PATCH /api/department/[id]/programmes/[programme_id]
 *
 * Edit a programme's fields or toggle its active state. Programme cannot
 * leave the department via this endpoint — department_id is locked to the
 * URL parameter.
 *
 * (No DELETE: existing roster entries reference programmes; archiving via
 * active=false is the supported "remove" path.)
 */

const DEGREE_LEVELS = ['bachelor', 'master', 'phd', 'postdoc', 'staff', 'other'] as const

const patchSchema = z.object({
  name:            z.string().trim().min(1).max(200).optional(),
  short_code:      z.string().trim().max(40).optional().or(z.literal('')),
  degree_level:    z.enum(DEGREE_LEVELS).optional(),
  duration_months: z.number().int().positive().max(240).nullable().optional(),
  description:     z.string().trim().max(2000).optional().or(z.literal('')),
  active:          z.boolean().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; programme_id: string }> },
) {
  const { id, programme_id } = await params
  const supabase = await createClient()
  const scope = await getScope(supabase)
  if (!scope) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (scope.departmentIds !== 'all' && !scope.departmentIds.includes(id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const svc = createServiceClient()

  const { data: programme } = await svc
    .from('institution_programmes')
    .select('id, name, department_id, institution_id')
    .eq('id', programme_id)
    .maybeSingle()
  if (!programme || programme.department_id !== id || programme.institution_id !== scope.institutionId) {
    return NextResponse.json({ error: 'Programme not found' }, { status: 404 })
  }

  const update: Record<string, unknown> = {}
  if (parsed.data.name !== undefined)            update.name = parsed.data.name
  if (parsed.data.short_code !== undefined)      update.short_code = parsed.data.short_code || null
  if (parsed.data.degree_level !== undefined)    update.degree_level = parsed.data.degree_level
  if (parsed.data.duration_months !== undefined) update.duration_months = parsed.data.duration_months
  if (parsed.data.description !== undefined)     update.description = parsed.data.description || null
  if (parsed.data.active !== undefined)          update.active = parsed.data.active
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ success: true, noop: true })
  }

  const { error: updateErr } = await svc
    .from('institution_programmes')
    .update(update)
    .eq('id', programme_id)
  if (updateErr) {
    if (updateErr.code === '23505') {
      return NextResponse.json({ error: 'A programme with that name already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  void writeAuditEntry({
    actor_id: scope.userId,
    action: 'institution.admin.updated',
    resource_type: 'institution',
    resource_id: scope.institutionId,
    institution_id: scope.institutionId,
    details: {
      summary: parsed.data.active === false ? `Archived programme "${programme.name}"` :
               parsed.data.active === true  ? `Reactivated programme "${programme.name}"` :
               `Edited programme "${programme.name}"`,
      department_id: id,
      programme_id,
      changed_fields: Object.keys(update),
    },
  })

  return NextResponse.json({ success: true })
}
