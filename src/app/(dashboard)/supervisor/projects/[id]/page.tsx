import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { format } from 'date-fns'
import {
  ArrowLeft, Database, BarChart2, FileText, ExternalLink,
  MessageSquare, FolderOpen, Shield,
} from 'lucide-react'
import { cn } from '@/lib/utils'

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

export default async function SupervisorProjectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Verify this supervisor has explicit viewer access to this project
  const { data: member } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member) notFound()

  // Fetch everything in parallel
  const [
    projectResult,
    datasetsResult,
    analysisResult,
    documentsResult,
  ] = await Promise.all([
    supabase
      .from('projects')
      .select('id, title, phase, status, owner_id, created_at')
      .eq('id', id)
      .is('deleted_at', null)
      .single(),
    supabase
      .from('datasets')
      .select('id, name, updated_at')
      .eq('project_id', id)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false }),
    supabase
      .from('analysis_runs')
      .select('id, analysis_type, status, created_at')
      .eq('project_id', id)
      .eq('status', 'completed')
      .order('created_at', { ascending: false }),
    supabase
      .from('documents')
      .select('id, title, updated_at, doc_type')
      .eq('project_id', id)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false }),
  ])

  if (!projectResult.data) notFound()
  const project = projectResult.data

  // Fetch the student profile
  const { data: studentProfile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', project.owner_id)
    .single()

  const datasets  = datasetsResult.data  ?? []
  const runs      = analysisResult.data  ?? []
  const documents = documentsResult.data ?? []

  return (
    <div className="min-h-screen bg-bg-app">

      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <div className="bg-bg-surface border-b border-border-default sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center gap-3">
          <Link
            href={`/supervisor/students/${project.owner_id}`}
            className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to student
          </Link>
          <span className="text-border-strong select-none">·</span>
          <span className="text-sm font-semibold text-text-primary truncate">{project.title}</span>
          <span className="ml-auto flex items-center gap-2">
            <span className="text-xs text-text-tertiary">{studentProfile?.full_name ?? studentProfile?.email ?? 'Student'}</span>
            <Link
              href={`/supervisor/projects/${id}/integrity`}
              className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors"
              title="View integrity ledger"
            >
              <Shield className="h-3 w-3" /> Ledger
            </Link>
          </span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-3 py-4 sm:px-6 sm:py-8 space-y-8">

        {/* ── Research output — two columns ──────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

          {/* Datasets */}
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-text-tertiary mb-3">
              Datasets <span className="ml-1 text-text-tertiary/60">({datasets.length})</span>
            </h2>
            <div className="bg-bg-surface rounded-xl border border-border-default shadow-sm overflow-hidden">
              {datasets.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <Database className="h-5 w-5 text-text-tertiary/40 mx-auto mb-1.5" />
                  <p className="text-xs text-text-tertiary">No datasets uploaded yet</p>
                </div>
              ) : (
                <div className="divide-y divide-border-subtle">
                  {datasets.map(d => (
                    <Link
                      key={d.id}
                      href={`/supervisor/projects/${id}/datasets/${d.id}`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-bg-surface-hover transition-colors"
                    >
                      <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0">
                        <Database className="h-3.5 w-3.5 text-violet-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-text-primary truncate">{d.name}</p>
                        <p className="text-[10px] text-text-tertiary">
                          {d.updated_at ? format(new Date(d.updated_at), 'dd MMM yyyy') : ''}
                        </p>
                      </div>
                      <ExternalLink className="h-3.5 w-3.5 text-text-tertiary/60 flex-shrink-0" />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Analysis runs */}
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-text-tertiary mb-3">
              Analyses <span className="ml-1 text-text-tertiary/60">({runs.length})</span>
            </h2>
            <div className="bg-bg-surface rounded-xl border border-border-default shadow-sm overflow-hidden">
              {runs.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <BarChart2 className="h-5 w-5 text-text-tertiary/40 mx-auto mb-1.5" />
                  <p className="text-xs text-text-tertiary">No completed analyses yet</p>
                </div>
              ) : (
                <div className="divide-y divide-border-subtle">
                  {runs.map(r => (
                    <Link
                      key={r.id}
                      href={`/supervisor/projects/${id}/analyses/${r.id}`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-bg-surface-hover transition-colors"
                    >
                      <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                        <BarChart2 className="h-3.5 w-3.5 text-emerald-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-text-primary truncate capitalize">
                          {ANALYSIS_LABELS[r.analysis_type] ?? r.analysis_type.replace(/_/g, ' ')}
                        </p>
                        <p className="text-[10px] text-text-tertiary">
                          {r.created_at ? format(new Date(r.created_at), 'dd MMM yyyy') : ''}
                        </p>
                      </div>
                      <ExternalLink className="h-3.5 w-3.5 text-text-tertiary/60 flex-shrink-0" />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* ── Documents ──────────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest text-text-tertiary mb-3">
            Documents <span className="ml-1 text-text-tertiary/60">({documents.length})</span>
          </h2>

          {documents.length === 0 ? (
            <div className="bg-bg-surface rounded-xl border border-border-default shadow-sm p-6 text-center">
              <FolderOpen className="h-5 w-5 text-text-tertiary/40 mx-auto mb-1.5" />
              <p className="text-xs text-text-tertiary">No documents written yet</p>
            </div>
          ) : (
            <div className="bg-bg-surface rounded-xl border border-border-default shadow-sm overflow-hidden">
              {documents.map((doc, i) => (
                <div key={doc.id} className={cn('flex items-center gap-4 px-5 py-3.5', i > 0 && 'border-t border-border-subtle')}>
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                    <FileText className="h-4 w-4 text-indigo-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-text-primary truncate">{doc.title || 'Untitled document'}</p>
                    <p className="text-[10px] text-text-tertiary">
                      {(doc as { doc_type?: string }).doc_type?.replace(/_/g, ' ') ?? 'Document'}
                      {doc.updated_at ? ` · Updated ${format(new Date(doc.updated_at), 'dd MMM yyyy')}` : ''}
                    </p>
                  </div>
                  <Link
                    href={`/supervisor/projects/${id}/documents/${doc.id}`}
                    className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold text-accent-blue hover:opacity-75 transition-opacity"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    View & comment
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  )
}
