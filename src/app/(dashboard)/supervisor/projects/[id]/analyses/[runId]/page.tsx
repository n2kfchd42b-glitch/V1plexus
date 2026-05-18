import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SupervisorAnalysisViewer } from '@/components/supervisor-student/SupervisorAnalysisViewer'
import type { AnalysisResult } from '@/lib/analysis/types'
import type { AnalysisType } from '@/types/database'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

const ANALYSIS_LABELS: Record<string, string> = {
  descriptive_statistics: 'Descriptive Statistics',
  frequencies: 'Frequencies',
  regression: 'Regression',
  t_test: 'T-Test',
  anova: 'ANOVA',
  chi_square: 'Chi-Square',
  correlation: 'Correlation',
  factor_analysis: 'Factor Analysis',
}

export default async function SupervisorAnalysisPage({
  params,
}: {
  params: Promise<{ id: string; runId: string }>
}) {
  const { id: projectId, runId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Verify supervisor access
  const { data: member } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member) notFound()

  // Fetch the analysis run
  const { data: run } = await supabase
    .from('analysis_runs')
    .select('id, analysis_type, status, results, created_at, project_id')
    .eq('id', runId)
    .eq('project_id', projectId)
    .eq('status', 'completed')
    .single()

  if (!run || !run.results) notFound()

  // Fetch project owner (student)
  const { data: project } = await supabase
    .from('projects')
    .select('owner_id, title')
    .eq('id', projectId)
    .single()

  if (!project) notFound()

  const label = ANALYSIS_LABELS[run.analysis_type] ?? run.analysis_type

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center gap-3">
          <Link
            href={`/supervisor/projects/${projectId}`}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to project
          </Link>
          <span className="text-slate-200 select-none">·</span>
          <span className="text-sm font-semibold text-slate-800">{label}</span>
        </div>
      </div>

      <SupervisorAnalysisViewer
        runId={runId}
        projectId={projectId}
        studentId={project.owner_id}
        analysisType={run.analysis_type as AnalysisType}
        result={run.results as AnalysisResult}
      />
    </div>
  )
}
