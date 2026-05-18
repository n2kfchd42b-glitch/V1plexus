import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/student/artifacts
// Returns the calling student's projects with their documents, datasets, and analysis runs.
export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: projects, error } = await supabase
    .from('projects')
    .select('id, title')
    .eq('owner_id', user.id)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!projects?.length) return NextResponse.json([])

  const projectIds = projects.map(p => p.id)

  const [datasetsRes, runsRes, docsRes] = await Promise.all([
    supabase
      .from('datasets')
      .select('id, name, project_id, updated_at')
      .in('project_id', projectIds)
      .order('updated_at', { ascending: false }),
    supabase
      .from('analysis_runs')
      .select('id, analysis_type, status, project_id, created_at')
      .in('project_id', projectIds)
      .eq('status', 'completed')
      .order('created_at', { ascending: false }),
    supabase
      .from('documents')
      .select('id, title, project_id, updated_at')
      .in('project_id', projectIds)
      .order('updated_at', { ascending: false }),
  ])

  const datasets   = datasetsRes.data  ?? []
  const runs       = runsRes.data      ?? []
  const documents  = docsRes.data      ?? []

  const result = projects.map(p => ({
    id: p.id,
    title: p.title,
    datasets:      datasets.filter(d => d.project_id === p.id),
    analysis_runs: runs.filter(r => r.project_id === p.id),
    documents:     documents.filter(d => d.project_id === p.id),
  })).filter(p => p.datasets.length + p.analysis_runs.length + p.documents.length > 0 || true)

  return NextResponse.json(result)
}
