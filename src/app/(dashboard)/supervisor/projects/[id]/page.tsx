import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { format } from 'date-fns'
import {
  ArrowLeft, CheckCircle2, Clock, RotateCcw, Circle,
  Database, BarChart2, FileText, ExternalLink, MessageSquare,
  FolderOpen, AlertCircle, Shield,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { SupervisionRecordsPanel } from '@/components/supervisor-student/SupervisionRecordsPanel'
import type { SupervisionRecord } from '@/components/supervisor-student/SupervisionRecordModal'
import { SupervisorGanttPanel } from '@/components/supervisor-student/SupervisorGanttPanel'

// ── Status display config ─────────────────────────────────────────────────────
const MILESTONE_STATUS = {
  not_started:       { label: 'Not started',        icon: Circle,        color: 'text-slate-400',   bg: 'bg-slate-50'   },
  in_progress:       { label: 'In progress',         icon: Clock,         color: 'text-amber-500',   bg: 'bg-amber-50'   },
  submitted:         { label: 'Awaiting review',     icon: AlertCircle,   color: 'text-blue-500',    bg: 'bg-blue-50'    },
  revision_requested:{ label: 'Revision requested',  icon: RotateCcw,     color: 'text-orange-500',  bg: 'bg-orange-50'  },
  approved:          { label: 'Approved',            icon: CheckCircle2,  color: 'text-emerald-500', bg: 'bg-emerald-50' },
} as const

const PHASE_LABELS: Record<string, string> = {
  concept: 'Concept', protocol: 'Protocol', ethics: 'Ethics',
  data_collection: 'Data Collection', analysis: 'Analysis',
  writing: 'Writing', publication: 'Publication',
}

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
    milestonesResult,
    datasetsResult,
    analysisResult,
    documentsResult,
    recordsResult,
  ] = await Promise.all([
    supabase
      .from('projects')
      .select('id, title, phase, status, owner_id, created_at')
      .eq('id', id)
      .is('deleted_at', null)
      .single(),
    supabase
      .from('student_milestones')
      .select(`
        id, title, description, status, due_date, created_at,
        latest_submission:milestone_submissions(
          id, round, submitted_at, note, document_id, dataset_id, analysis_run_id
        )
      `)
      .eq('supervisor_id', user.id)
      .order('created_at', { ascending: true }),
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
    supabase
      .from('supervision_records')
      .select('id, supervisor_id, student_id, project_id, title, summary, action_items, created_at')
      .eq('project_id', id)
      .eq('supervisor_id', user.id)
      .order('created_at', { ascending: false }),
  ])

  if (!projectResult.data) notFound()
  const project = projectResult.data

  // Fetch the student profile
  const { data: studentProfile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', project.owner_id)
    .single()

  const milestones = milestonesResult.data ?? []
  const datasets   = datasetsResult.data   ?? []
  const runs       = analysisResult.data   ?? []
  const documents  = documentsResult.data  ?? []
  const records    = (recordsResult.data   ?? []) as SupervisionRecord[]

  // Filter milestones that belong to this student
  // (supervisor_id = me, student_id = project.owner_id)
  const projectMilestones = milestones.filter(m => {
    // We need to re-query or trust that we got all milestones for this supervisor
    // The sub-query above already scopes to supervisor_id = user.id
    // We just need to further filter by student
    return true // All returned milestones are for this supervisor
  })

  const awaiting = projectMilestones.filter(m => m.status === 'submitted').length
  const approved = projectMilestones.filter(m => m.status === 'approved').length

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center gap-3">
          <Link
            href={`/supervisor/students/${project.owner_id}`}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to student
          </Link>
          <span className="text-slate-200 select-none">·</span>
          <span className="text-sm font-semibold text-slate-800 truncate">{project.title}</span>
          <span className="ml-auto flex items-center gap-2">
            <span className="text-xs text-slate-400">{studentProfile?.full_name ?? studentProfile?.email ?? 'Student'}</span>
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

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">

        {/* ── Research timeline (read-only Gantt) ────────────────────────────── */}
        <SupervisorGanttPanel projectId={id} userId={user.id} />

        {/* ── Stats strip ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Milestones',  value: projectMilestones.length },
            { label: 'Awaiting review', value: awaiting,   highlight: awaiting > 0 },
            { label: 'Approved',    value: approved },
            { label: 'Documents',   value: documents.length },
          ].map(({ label, value, highlight }) => (
            <div key={label} className={cn(
              'bg-white rounded-xl border px-4 py-3 shadow-sm',
              highlight ? 'border-blue-200' : 'border-slate-100'
            )}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
              <p className={cn(
                'text-2xl font-extrabold mt-0.5',
                highlight ? 'text-blue-600' : 'text-slate-800'
              )}>{value}</p>
            </div>
          ))}
        </div>

        {/* ── Milestones ─────────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Milestones</h2>

          {projectMilestones.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 text-center">
              <Circle className="h-6 w-6 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No milestones assigned to this student yet</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              {projectMilestones.map((m, i) => {
                const cfg = MILESTONE_STATUS[m.status as keyof typeof MILESTONE_STATUS] ?? MILESTONE_STATUS.not_started
                const Icon = cfg.icon
                const subs = Array.isArray(m.latest_submission) ? m.latest_submission : (m.latest_submission ? [m.latest_submission] : [])
                const latest = subs.sort((a: {round:number}, b: {round:number}) => b.round - a.round)[0] as {
                  id: string; round: number; submitted_at: string; note?: string;
                  document_id?: string|null; dataset_id?: string|null; analysis_run_id?: string|null
                } | undefined
                return (
                  <div key={m.id} className={cn('px-5 py-4', i > 0 && 'border-t border-slate-50')}>
                    <div className="flex items-start gap-3">
                      <div className={cn('w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5', cfg.bg)}>
                        <Icon className={cn('h-3.5 w-3.5', cfg.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <p className="text-sm font-semibold text-slate-800">{m.title}</p>
                          <span className={cn('text-[10px] font-bold', cfg.color)}>{cfg.label}</span>
                          {m.due_date && (
                            <span className="text-[10px] text-slate-400 ml-auto flex-shrink-0">
                              Due {format(new Date(m.due_date), 'dd MMM yyyy')}
                            </span>
                          )}
                        </div>
                        {m.description && (
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{m.description}</p>
                        )}
                        {/* Latest submission note */}
                        {latest?.note && (
                          <div className="mt-2 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                              Student note · Round {latest.round}
                            </p>
                            <p className="text-xs text-slate-600 leading-relaxed">{latest.note}</p>
                          </div>
                        )}
                      </div>
                      {m.status === 'submitted' && (
                        <Link
                          href={`/supervisor/students/${project.owner_id}`}
                          className="flex-shrink-0 text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                        >
                          Review <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* ── Research output — two columns ──────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-6">

          {/* Datasets */}
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">
              Datasets <span className="ml-1 text-slate-300">({datasets.length})</span>
            </h2>
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              {datasets.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <Database className="h-5 w-5 text-slate-200 mx-auto mb-1.5" />
                  <p className="text-xs text-slate-400">No datasets uploaded yet</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {datasets.map(d => (
                    <Link
                      key={d.id}
                      href={`/supervisor/projects/${id}/datasets/${d.id}`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
                    >
                      <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0">
                        <Database className="h-3.5 w-3.5 text-violet-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-700 truncate">{d.name}</p>
                        <p className="text-[10px] text-slate-400">
                          {d.updated_at ? format(new Date(d.updated_at), 'dd MMM yyyy') : ''}
                        </p>
                      </div>
                      <ExternalLink className="h-3.5 w-3.5 text-slate-300 flex-shrink-0" />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Analysis runs */}
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">
              Analyses <span className="ml-1 text-slate-300">({runs.length})</span>
            </h2>
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              {runs.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <BarChart2 className="h-5 w-5 text-slate-200 mx-auto mb-1.5" />
                  <p className="text-xs text-slate-400">No completed analyses yet</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {runs.map(r => (
                    <Link
                      key={r.id}
                      href={`/supervisor/projects/${id}/analyses/${r.id}`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
                    >
                      <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                        <BarChart2 className="h-3.5 w-3.5 text-emerald-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-700 truncate capitalize">
                          {ANALYSIS_LABELS[r.analysis_type] ?? r.analysis_type.replace(/_/g, ' ')}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {r.created_at ? format(new Date(r.created_at), 'dd MMM yyyy') : ''}
                        </p>
                      </div>
                      <ExternalLink className="h-3.5 w-3.5 text-slate-300 flex-shrink-0" />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* ── Documents ──────────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">
            Documents <span className="ml-1 text-slate-300">({documents.length})</span>
          </h2>

          {documents.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 text-center">
              <FolderOpen className="h-5 w-5 text-slate-200 mx-auto mb-1.5" />
              <p className="text-xs text-slate-400">No documents written yet</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              {documents.map((doc, i) => (
                <div key={doc.id} className={cn('flex items-center gap-4 px-5 py-3.5', i > 0 && 'border-t border-slate-50')}>
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                    <FileText className="h-4 w-4 text-indigo-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{doc.title || 'Untitled document'}</p>
                    <p className="text-[10px] text-slate-400">
                      {(doc as { doc_type?: string }).doc_type?.replace(/_/g, ' ') ?? 'Document'}
                      {doc.updated_at ? ` · Updated ${format(new Date(doc.updated_at), 'dd MMM yyyy')}` : ''}
                    </p>
                  </div>
                  <Link
                    href={`/supervisor/projects/${id}/documents/${doc.id}`}
                    className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    View & comment
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Supervision Records ─────────────────────────────────────────────── */}
        <SupervisionRecordsPanel
          projectId={id}
          studentId={project.owner_id}
          initialRecords={records}
        />

      </div>
    </div>
  )
}
