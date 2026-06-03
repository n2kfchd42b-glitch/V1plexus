import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getScope } from '@/lib/admin/scope'

/**
 * GET /api/department/[id]/defenses
 *
 * Final defenses that have been scheduled but not yet recorded — i.e.
 * thesis_defenses where defense_type='final' AND outcome IS NULL, scoped to
 * students supervised in this dept.
 *
 * Companion to /intake (which lists "submitted, awaiting scheduling").
 * Together they cover the two admin actions in the thesis tail:
 *   submit  → schedule defense  → record outcome
 *
 * Returns metadata + the scheduled date/time/location. No content.
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

  // Students supervised in this dept
  const { data: assignments } = await svc
    .from('supervisor_assignments')
    .select('student_id')
    .eq('department_id', id)
    .in('status', ['active', 'ended'])

  const studentIds = [...new Set((assignments ?? []).map(a => a.student_id as string))]
  if (studentIds.length === 0) {
    return NextResponse.json({ defenses: [] })
  }

  // Projects owned by those students
  const { data: projects } = await svc
    .from('projects')
    .select('id, owner_id, title')
    .in('owner_id', studentIds)

  const projectIds = (projects ?? []).map(p => p.id as string)
  if (projectIds.length === 0) {
    return NextResponse.json({ defenses: [] })
  }

  // Scheduled-but-not-decided final defenses
  const { data: defenses, error } = await svc
    .from('thesis_defenses')
    .select(`
      id, project_id, scheduled_date, scheduled_time, location, meeting_link, notes,
      created_at
    `)
    .in('project_id', projectIds)
    .eq('defense_type', 'final')
    .is('outcome', null)
    .order('scheduled_date', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Hydrate thesis + student + supervisor
  const { data: theses } = await svc
    .from('thesis_metadata')
    .select(`
      project_id, thesis_title, degree_type, supervisor_id, defense_status,
      supervisor:profiles!supervisor_id(id, full_name, email, avatar_url)
    `)
    .in('project_id', (defenses ?? []).map(d => d.project_id as string))

  type ThesisRow = {
    project_id: string
    thesis_title: string | null
    degree_type: string
    defense_status: string
    supervisor: { id: string; full_name: string | null; email: string; avatar_url: string | null } | null
  }
  const thesisByProject = new Map<string, ThesisRow>(
    ((theses ?? []) as unknown as ThesisRow[]).map(t => [t.project_id, t]),
  )

  const projectById = new Map((projects ?? []).map(p => [p.id as string, p as { id: string; owner_id: string; title: string }]))
  const studentIdsNeeded = new Set((defenses ?? []).map(d => projectById.get(d.project_id as string)?.owner_id).filter(Boolean) as string[])

  const [studentRes, enrollmentRes] = await Promise.all([
    studentIdsNeeded.size > 0
      ? svc.from('profiles').select('id, full_name, email, avatar_url').in('id', [...studentIdsNeeded])
      : Promise.resolve({ data: [] }),
    studentIdsNeeded.size > 0
      ? svc.from('institution_enrollments')
          .select('user_id, programme:institution_programmes(id, name, short_code)')
          .eq('department_id', id)
          .eq('status', 'active')
          .in('user_id', [...studentIdsNeeded])
      : Promise.resolve({ data: [] }),
  ])

  const studentById = new Map(((studentRes.data ?? []) as Array<{ id: string; full_name: string | null; email: string; avatar_url: string | null }>).map(s => [s.id, s]))
  type EnrollmentRow = { user_id: string; programme: { id: string; name: string; short_code: string | null } | null }
  const programmeByStudent = new Map<string, { id: string; name: string; short_code: string | null } | null>()
  for (const row of ((enrollmentRes.data ?? []) as unknown as EnrollmentRow[])) {
    programmeByStudent.set(row.user_id, row.programme)
  }

  const result = (defenses ?? []).map(d => {
    const project = projectById.get(d.project_id as string)
    const studentId = project?.owner_id ?? ''
    const thesis = thesisByProject.get(d.project_id as string)
    return {
      defense_id: d.id,
      project_id: d.project_id,
      title: thesis?.thesis_title ?? project?.title ?? '(untitled)',
      degree_type: thesis?.degree_type ?? null,
      scheduled_date: d.scheduled_date,
      scheduled_time: d.scheduled_time,
      location: d.location,
      meeting_link: d.meeting_link,
      notes: d.notes,
      student: studentById.get(studentId) ?? null,
      supervisor: thesis?.supervisor ?? null,
      programme: programmeByStudent.get(studentId) ?? null,
    }
  })

  return NextResponse.json({ defenses: result })
}
