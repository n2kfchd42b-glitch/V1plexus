import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getScope } from '@/lib/admin/scope'
import { writeAuditEntry } from '@/lib/audit/auditLogger'

/**
 * DELETE /api/department/[id]/assignments/[assignment_id]
 *
 * Ends an active supervisor_assignment: sets status='ended', ended_at=now().
 * Doesn't delete the row — we keep the audit trail of who supervised whom.
 *
 * Access: institution admins, or dept heads of the assignment's department.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; assignment_id: string }> },
) {
  const { id, assignment_id } = await params
  const supabase = await createClient()
  const scope = await getScope(supabase)
  if (!scope) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (scope.departmentIds !== 'all' && !scope.departmentIds.includes(id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const svc = createServiceClient()

  const { data: existing } = await svc
    .from('supervisor_assignments')
    .select(`
      id, department_id, status, role, supervisor_id, student_id,
      supervisor:profiles!supervisor_id(full_name, email),
      student:profiles!student_id(full_name, email),
      department:departments(institution_id, name)
    `)
    .eq('id', assignment_id)
    .maybeSingle()

  if (!existing) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
  if (existing.department_id !== id) {
    return NextResponse.json({ error: 'Assignment does not belong to this department' }, { status: 400 })
  }
  const dept = (existing.department as unknown as { institution_id: string; name: string } | null)
  if (!dept || dept.institution_id !== scope.institutionId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (existing.status !== 'active') {
    return NextResponse.json({ error: 'Assignment is not active' }, { status: 409 })
  }

  const { error: updateErr } = await svc
    .from('supervisor_assignments')
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('id', assignment_id)
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  const sup = (existing.supervisor as unknown as { full_name: string | null; email: string } | null)
  const stu = (existing.student as unknown as { full_name: string | null; email: string } | null)
  void writeAuditEntry({
    actor_id: scope.userId,
    action: 'institution.admin.updated',
    resource_type: 'supervisor_assignment',
    resource_id: assignment_id,
    institution_id: scope.institutionId,
    details: {
      summary: `Ended ${existing.role} supervision: ${sup?.full_name ?? sup?.email} → ${stu?.full_name ?? stu?.email} (${dept.name})`,
      department_id: id,
      student_id: existing.student_id,
      supervisor_id: existing.supervisor_id,
      role: existing.role,
    },
  })

  return NextResponse.json({ success: true })
}
