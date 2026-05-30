import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getScope } from '@/lib/admin/scope'

/**
 * GET /api/department/[id]/intake
 *
 * Theses in this department awaiting admin defense scheduling — the first
 * legitimate admin re-entry surface after supervisor-student work concludes.
 *
 * A thesis appears here when:
 *   - thesis_metadata.lifecycle_state = 'submitted'         (work is done)
 *   - thesis_metadata.defense_status   = 'not_scheduled'    (defense pending)
 *   - the student is supervised in THIS department
 *
 * Returns metadata only: thesis title, student, supervisor, programme,
 * submitted timestamp. NO chapters, no drafts, no commentary — admin is
 * receiving a deliverable, not reading it.
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

  // Dept gate
  const { data: dept } = await svc
    .from('departments')
    .select('id, institution_id')
    .eq('id', id)
    .maybeSingle()
  if (!dept || dept.institution_id !== scope.institutionId) {
    return NextResponse.json({ error: 'Department not found' }, { status: 404 })
  }

  // Students currently/previously supervised in this dept (we include 'ended'
  // because a thesis can be submitted after the formal supervision window).
  const { data: assignments } = await svc
    .from('supervisor_assignments')
    .select('student_id')
    .eq('department_id', id)
    .in('status', ['active', 'ended'])

  const studentIds = [...new Set((assignments ?? []).map(a => a.student_id as string))]
  if (studentIds.length === 0) {
    return NextResponse.json({ theses: [] })
  }

  // Projects owned by those students
  const { data: projects } = await svc
    .from('projects')
    .select('id, owner_id, title')
    .in('owner_id', studentIds)

  const projectIds = (projects ?? []).map(p => p.id as string)
  if (projectIds.length === 0) {
    return NextResponse.json({ theses: [] })
  }

  // Submitted theses awaiting scheduling
  const { data: theses, error } = await svc
    .from('thesis_metadata')
    .select(`
      id, project_id, thesis_title, degree_type, supervisor_id, updated_at,
      lifecycle_state, defense_status,
      supervisor:profiles!supervisor_id(id, full_name, email, avatar_url)
    `)
    .in('project_id', projectIds)
    .eq('lifecycle_state', 'submitted')
    .eq('defense_status', 'not_scheduled')
    .order('updated_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Hydrate student + programme info (one lookup each)
  const projectById = new Map((projects ?? []).map(p => [p.id as string, p as { id: string; owner_id: string; title: string }]))
  const studentSet = new Set((theses ?? []).map(t => projectById.get(t.project_id as string)?.owner_id).filter(Boolean) as string[])

  const [studentRes, enrollmentRes] = await Promise.all([
    studentSet.size > 0
      ? svc.from('profiles').select('id, full_name, email, avatar_url').in('id', [...studentSet])
      : Promise.resolve({ data: [] }),
    studentSet.size > 0
      ? svc.from('institution_enrollments')
          .select('user_id, programme:institution_programmes(id, name, short_code)')
          .eq('department_id', id)
          .eq('status', 'active')
          .in('user_id', [...studentSet])
      : Promise.resolve({ data: [] }),
  ])

  const studentById = new Map(((studentRes.data ?? []) as Array<{ id: string; full_name: string | null; email: string; avatar_url: string | null }>).map(s => [s.id, s]))
  type EnrollmentRow = { user_id: string; programme: { id: string; name: string; short_code: string | null } | null }
  const programmeByStudent = new Map<string, { id: string; name: string; short_code: string | null } | null>()
  for (const row of ((enrollmentRes.data ?? []) as unknown as EnrollmentRow[])) {
    programmeByStudent.set(row.user_id, row.programme)
  }

  const result = (theses ?? []).map(t => {
    const project = projectById.get(t.project_id as string)
    const studentId = project?.owner_id ?? ''
    return {
      thesis_id: t.id,
      project_id: t.project_id,
      title: t.thesis_title ?? project?.title ?? '(untitled)',
      degree_type: t.degree_type,
      submitted_at: t.updated_at,
      student: studentById.get(studentId) ?? null,
      supervisor: t.supervisor,
      programme: programmeByStudent.get(studentId) ?? null,
    }
  })

  return NextResponse.json({ theses: result })
}
