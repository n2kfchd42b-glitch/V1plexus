import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/supervisor/students/[studentId]/research
// Returns the student's projects with datasets, analysis runs, and documents.
// Supervisor must have an active assignment for this student.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const { studentId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify active assignment
  const { data: assignment } = await supabase
    .from('supervisor_assignments')
    .select('id')
    .eq('supervisor_id', user.id)
    .eq('student_id', studentId)
    .eq('status', 'active')
    .maybeSingle()

  if (!assignment) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Only return projects the student has explicitly shared with this supervisor
  const { data: sharedMemberships } = await supabase
    .from('project_members')
    .select('project_id')
    .eq('user_id', user.id)
    .eq('role', 'viewer')

  const sharedProjectIds = (sharedMemberships ?? []).map(m => m.project_id)

  if (!sharedProjectIds.length) return NextResponse.json([])

  const { data: projects, error } = await supabase
    .from('projects')
    .select('id, title, status, phase, updated_at')
    .eq('owner_id', studentId)
    .in('id', sharedProjectIds)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!projects?.length) return NextResponse.json([])

  const projectIds = projects.map(p => p.id)

  // Fetch datasets, analysis runs, documents in parallel
  const [datasetsRes, runsRes, docsRes] = await Promise.all([
    supabase
      .from('datasets')
      .select('id, name, project_id, created_at, updated_at')
      .in('project_id', projectIds)
      .order('updated_at', { ascending: false }),
    supabase
      .from('analysis_runs')
      .select('id, analysis_type, status, created_at, project_id')
      .in('project_id', projectIds)
      .order('created_at', { ascending: false }),
    supabase
      .from('documents')
      .select('id, title, updated_at, project_id')
      .in('project_id', projectIds)
      .order('updated_at', { ascending: false }),
  ])

  const datasets   = datasetsRes.data  ?? []
  const runs       = runsRes.data      ?? []
  const documents  = docsRes.data      ?? []

  const result = projects.map(p => ({
    ...p,
    datasets:      datasets.filter(d => d.project_id === p.id),
    analysis_runs: runs.filter(r => r.project_id === p.id),
    documents:     documents.filter(d => d.project_id === p.id),
  }))

  return NextResponse.json(result)
}
