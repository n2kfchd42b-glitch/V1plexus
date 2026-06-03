import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getScope } from '@/lib/admin/scope'

/**
 * GET /api/department/[id]/detail
 *
 * Single-department board payload for the dept-head UI. Returns only the
 * STRUCTURAL view — heads, the supervisor↔student directory, who's still
 * waiting to be matched, and counts of structural state.
 *
 * Deliberately does NOT return milestone progress, statuses, due dates, or
 * any work-content signal. The supervisor↔student working relationship is
 * private to that pair; admins prepare scaffolding and reconnect only at
 * intake / submission / defense / breach. This endpoint is the scaffolding.
 *
 * Access:
 *   - Institution admin / workspace owner → any dept in their institution
 *   - Department head                     → only the dept(s) they head
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const scope = await getScope(supabase)
  if (!scope) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (scope.departmentIds !== 'all' && !scope.departmentIds.includes(id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const svc = createServiceClient()

  const { data: department, error: deptErr } = await svc
    .from('departments')
    .select('id, name, description, institution_id')
    .eq('id', id)
    .maybeSingle()
  if (deptErr) return NextResponse.json({ error: deptErr.message }, { status: 500 })
  if (!department || department.institution_id !== scope.institutionId) {
    return NextResponse.json({ error: 'Department not found' }, { status: 404 })
  }

  const { data: workspace } = await svc
    .from('workspaces')
    .select('id, name')
    .eq('institution_id', scope.institutionId)
    .eq('type', 'institutional')
    .maybeSingle()

  const [headsRes, assignmentsRes, enrollmentsRes, availSupRes, rosterCountRes, intakeStudentsRes] = await Promise.all([
    workspace
      ? svc
          .from('workspace_memberships')
          .select(`
            user_id, joined_at,
            user:profiles!workspace_memberships_user_id_fkey(id, full_name, email, avatar_url, title)
          `)
          .eq('workspace_id', workspace.id)
          .eq('department_id', id)
          .eq('role', 'department_head')
          .eq('status', 'active')
      : Promise.resolve({ data: [] }),
    svc
      .from('supervisor_assignments')
      .select(`
        id, role, assigned_at, supervisor_id, student_id,
        supervisor:profiles!supervisor_id(id, full_name, email, avatar_url, title),
        student:profiles!student_id(id, full_name, email, avatar_url, title)
      `)
      .eq('department_id', id)
      .eq('status', 'active')
      .order('assigned_at', { ascending: false }),
    svc
      .from('institution_enrollments')
      .select(`
        id, user_id, status, programme_id, cohort_id,
        user:profiles!user_id(id, full_name, email, avatar_url, title),
        programme:institution_programmes(id, name, short_code)
      `)
      .eq('department_id', id)
      .eq('status', 'active'),
    svc
      .from('profiles')
      .select('id, full_name, email, avatar_url, title, supervision_max_students, department_id')
      .eq('institution_id', scope.institutionId)
      .eq('available_to_supervise', true)
      .order('full_name', { ascending: true, nullsFirst: false }),
    svc
      .from('institution_roster_entries')
      .select('id', { count: 'exact', head: true })
      .eq('department_id', id)
      .eq('status', 'unclaimed'),
    // For the Intake tab badge: students supervised (now or previously) in
    // this dept. The actual intake query joins onward through projects ↔
    // thesis_metadata; here we just need the student set so we can count
    // their submitted theses in a follow-up query.
    svc
      .from('supervisor_assignments')
      .select('student_id')
      .eq('department_id', id)
      .in('status', ['active', 'ended']),
  ])

  const assignments = assignmentsRes.data ?? []

  // Directory only: supervisor → list of student names + role + assigned_at.
  // No milestone metrics — that's working content, owned by the pair.
  const supervisorMap = new Map<string, {
    supervisor: Record<string, unknown>
    students: Array<{
      assignment_id: string
      student: Record<string, unknown>
      role: string
      assigned_at: string
    }>
  }>()

  for (const a of assignments) {
    const supId = a.supervisor_id
    if (!supervisorMap.has(supId)) {
      supervisorMap.set(supId, { supervisor: a.supervisor as unknown as Record<string, unknown>, students: [] })
    }
    supervisorMap.get(supId)!.students.push({
      assignment_id: a.id,
      student: a.student as unknown as Record<string, unknown>,
      role: a.role,
      assigned_at: a.assigned_at,
    })
  }

  const supervisorTree = Array.from(supervisorMap.values()).map(entry => ({
    ...entry,
    total_students: entry.students.length,
  }))

  const heads = ((headsRes.data ?? []) as unknown as Array<{ user: { id: string; full_name: string | null; email: string; avatar_url: string | null; title: string | null } | null }>)
    .map(r => r.user)
    .filter((u): u is { id: string; full_name: string | null; email: string; avatar_url: string | null; title: string | null } => u !== null)

  // Students enrolled in this dept who don't yet have an active *primary*
  // supervisor in this dept. Matchmaking is admin's responsibility, so this
  // pending list is fair game.
  const primaryStudentIds = new Set(
    assignments.filter(a => a.role === 'primary').map(a => a.student_id as string),
  )
  type EnrollmentRow = {
    id: string
    user_id: string
    user: { id: string; full_name: string | null; email: string; avatar_url: string | null; title: string | null } | null
    programme: { id: string; name: string; short_code: string | null } | null
  }
  const unassignedStudents = ((enrollmentsRes.data ?? []) as unknown as EnrollmentRow[])
    .filter(e => e.user && !primaryStudentIds.has(e.user_id))
    .map(e => ({
      enrollment_id: e.id,
      student: e.user!,
      programme: e.programme,
    }))

  // Intake badge: submitted theses awaiting defense scheduling PLUS scheduled
  // defenses awaiting outcome — both are actions admin needs to take. Scoped
  // to students supervised in this dept.
  let intakePending = 0
  let defensesPending = 0
  const intakeStudentIds = [...new Set(((intakeStudentsRes.data ?? []) as Array<{ student_id: string }>).map(a => a.student_id))]
  if (intakeStudentIds.length > 0) {
    const { data: intakeProjects } = await svc
      .from('projects')
      .select('id')
      .in('owner_id', intakeStudentIds)
    const intakeProjectIds = (intakeProjects ?? []).map(p => p.id as string)
    if (intakeProjectIds.length > 0) {
      const [submittedCount, scheduledCount] = await Promise.all([
        svc
          .from('thesis_metadata')
          .select('id', { count: 'exact', head: true })
          .in('project_id', intakeProjectIds)
          .eq('lifecycle_state', 'submitted')
          .eq('defense_status', 'not_scheduled'),
        svc
          .from('thesis_defenses')
          .select('id', { count: 'exact', head: true })
          .in('project_id', intakeProjectIds)
          .eq('defense_type', 'final')
          .is('outcome', null),
      ])
      intakePending = submittedCount.count ?? 0
      defensesPending = scheduledCount.count ?? 0
    }
  }

  return NextResponse.json({
    department: {
      id: department.id,
      name: department.name,
      description: department.description,
    },
    heads,
    supervisor_tree: supervisorTree,
    unassigned_students: unassignedStudents,
    available_supervisors: availSupRes.data ?? [],
    counts: {
      supervisors: supervisorTree.length,
      students: new Set(assignments.map(a => a.student_id)).size,
      unassigned: unassignedStudents.length,
      roster_unclaimed: (rosterCountRes as { count: number | null }).count ?? 0,
      intake_pending: intakePending,
      defenses_pending: defensesPending,
    },
    viewer: {
      is_institution_admin: scope.isInstitutionAdmin,
      is_department_head: scope.isDepartmentHead,
    },
  })
}
