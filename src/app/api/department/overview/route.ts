import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getScope } from '@/lib/admin/scope'

// GET /api/department/overview
// Returns supervisors + their students + milestone stats within the caller's
// scope. Institution admins see every department; department heads see only
// their own; supervisors see only their own assignments.
export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const scope = await getScope(supabase)
  if (!scope) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const svc = createServiceClient()

  // Resolve the department set for this caller.
  let allowedDeptIds: string[]
  if (scope.departmentIds === 'all') {
    const { data: depts } = await svc
      .from('departments')
      .select('id')
      .eq('institution_id', scope.institutionId)
    allowedDeptIds = (depts ?? []).map(d => d.id as string)
  } else {
    allowedDeptIds = scope.departmentIds
  }

  if (allowedDeptIds.length === 0) {
    return NextResponse.json({ institutionId: scope.institutionId, supervisors: [] })
  }

  let query = svc
    .from('supervisor_assignments')
    .select(`
      *,
      supervisor:profiles!supervisor_id(id, full_name, email, avatar_url, title),
      student:profiles!student_id(id, full_name, email, avatar_url, title)
    `)
    .in('department_id', allowedDeptIds)
    .eq('status', 'active')
    .order('assigned_at', { ascending: false })

  // Supervisors without elevated roles only see their own assignments.
  if (scope.isSupervisor && !scope.isInstitutionAdmin && !scope.isDepartmentHead) {
    query = query.eq('supervisor_id', scope.userId)
  }

  const { data: assignments, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Milestone stats per student
  const studentIds = [...new Set((assignments ?? []).map(a => a.student_id))]
  const { data: milestones } = studentIds.length > 0
    ? await svc
        .from('student_milestones')
        .select('student_id, status')
        .in('student_id', studentIds)
    : { data: [] }

  const statsFor = (studentId: string) => {
    const sm = milestones?.filter(m => m.student_id === studentId) ?? []
    return {
      total: sm.length,
      approved: sm.filter(m => m.status === 'approved').length,
      pending_review: sm.filter(m => ['submitted', 'under_review'].includes(m.status)).length,
    }
  }

  // Group by supervisor
  const supervisorMap = new Map<string, {
    supervisor: Record<string, unknown>
    students: Array<{
      assignment_id: string
      student: Record<string, unknown>
      role: string
      assigned_at: string
      milestone_summary: { total: number; approved: number; pending_review: number }
    }>
  }>()

  for (const a of (assignments ?? [])) {
    const supId = a.supervisor_id
    if (!supervisorMap.has(supId)) {
      supervisorMap.set(supId, { supervisor: a.supervisor, students: [] })
    }
    supervisorMap.get(supId)!.students.push({
      assignment_id: a.id,
      student: a.student,
      role: a.role,
      assigned_at: a.assigned_at,
      milestone_summary: statsFor(a.student_id),
    })
  }

  const result = Array.from(supervisorMap.values()).map(entry => ({
    ...entry,
    total_students: entry.students.length,
    total_milestones: entry.students.reduce((s, st) => s + st.milestone_summary.total, 0),
    approved_milestones: entry.students.reduce((s, st) => s + st.milestone_summary.approved, 0),
    pending_review: entry.students.reduce((s, st) => s + st.milestone_summary.pending_review, 0),
  }))

  return NextResponse.json({ institutionId: scope.institutionId, supervisors: result })
}
