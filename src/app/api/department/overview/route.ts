import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/department/overview
// Returns all supervisors + their students + milestone stats for the caller's workspace.
// Accessible by workspace owners, admins, and supervisors.
export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Resolve caller's workspace
  const { data: membership } = await supabase
    .from('workspace_memberships')
    .select('workspace_id, role')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  if (!membership) return NextResponse.json({ error: 'No active workspace' }, { status: 403 })

  const allowedRoles = ['owner', 'admin', 'department_head', 'supervisor']
  if (!allowedRoles.includes(membership.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const workspaceId = membership.workspace_id

  // All active supervisor assignments in this workspace
  const { data: assignments, error } = await supabase
    .from('supervisor_assignments')
    .select(`
      *,
      supervisor:profiles!supervisor_id(id, full_name, email, avatar_url, title),
      student:profiles!student_id(id, full_name, email, avatar_url, title)
    `)
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')
    .order('assigned_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Milestone stats per student
  const studentIds = [...new Set(assignments.map(a => a.student_id))]
  const { data: milestones } = studentIds.length > 0
    ? await supabase
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

  for (const a of assignments) {
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

  return NextResponse.json({ workspaceId, supervisors: result })
}
