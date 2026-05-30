import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getScope } from '@/lib/admin/scope'
import { writeAuditEntry } from '@/lib/audit/auditLogger'

/**
 * POST /api/department/[id]/assignments
 *
 * Create a supervisor_assignment in this department. Both institution
 * admins and the dept's heads can call this — gated by getScope.
 *
 * Constraints handled:
 *   - The partial UNIQUE index `idx_one_primary_supervisor` enforces a single
 *     active primary per student per workspace; we surface a 409 if violated.
 *   - The CHECK on role accepts 'primary' or 'co_supervisor'.
 */
const createSchema = z.object({
  student_id:    z.string().uuid(),
  supervisor_id: z.string().uuid(),
  role:          z.enum(['primary', 'co_supervisor']).default('primary'),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
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
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }
  const { student_id, supervisor_id, role } = parsed.data

  const svc = createServiceClient()

  // Verify department exists in caller's institution and find its workspace.
  const { data: dept } = await svc
    .from('departments')
    .select('id, name, institution_id')
    .eq('id', id)
    .maybeSingle()
  if (!dept || dept.institution_id !== scope.institutionId) {
    return NextResponse.json({ error: 'Department not found' }, { status: 404 })
  }

  const { data: workspace } = await svc
    .from('workspaces')
    .select('id')
    .eq('institution_id', scope.institutionId)
    .eq('type', 'institutional')
    .maybeSingle()
  if (!workspace) return NextResponse.json({ error: 'No institutional workspace' }, { status: 500 })

  // Sanity: both profiles must be in this institution.
  const { data: profiles } = await svc
    .from('profiles')
    .select('id, institution_id, available_to_supervise, full_name, email')
    .in('id', [student_id, supervisor_id])
  const sup = profiles?.find(p => p.id === supervisor_id)
  const stu = profiles?.find(p => p.id === student_id)
  if (!sup || sup.institution_id !== scope.institutionId) {
    return NextResponse.json({ error: 'Supervisor is not a member of your institution' }, { status: 400 })
  }
  if (!stu || stu.institution_id !== scope.institutionId) {
    return NextResponse.json({ error: 'Student is not a member of your institution' }, { status: 400 })
  }

  const { data: inserted, error: insertErr } = await svc
    .from('supervisor_assignments')
    .insert({
      workspace_id: workspace.id,
      department_id: id,
      supervisor_id,
      student_id,
      assigned_by: scope.userId,
      role,
      status: 'active',
    })
    .select('id')
    .single()

  if (insertErr) {
    if (insertErr.code === '23505') {
      const msg = role === 'primary'
        ? 'This student already has an active primary supervisor. End that assignment first.'
        : 'This supervisor already holds that role for the student.'
      return NextResponse.json({ error: msg }, { status: 409 })
    }
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  void writeAuditEntry({
    actor_id: scope.userId,
    action: 'institution.admin.updated',
    resource_type: 'supervisor_assignment',
    resource_id: inserted.id,
    institution_id: scope.institutionId,
    details: {
      summary: `Assigned ${sup.full_name ?? sup.email} as ${role.replace('_', ' ')} supervisor to ${stu.full_name ?? stu.email} (${dept.name})`,
      department_id: id,
      student_id,
      supervisor_id,
      role,
    },
  })

  return NextResponse.json({ success: true, assignment_id: inserted.id })
}
