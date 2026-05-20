'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Plus, FolderOpen, ChevronRight,
  Shield, Download, MessageSquare, CheckCircle2,
  PenLine, BarChart2, Database, Filter, X, ClipboardList,
} from 'lucide-react'
import { StudentMilestone } from '@/types/database'
import { MilestoneRoadmap } from '@/components/supervisor-student/MilestoneRoadmap'
import { MilestoneReviewModal } from '@/components/supervisor-student/MilestoneReviewModal'
import { AddMilestoneModal } from '@/components/supervisor-student/AddMilestoneModal'
import { SupervisionRecordModal } from '@/components/supervisor-student/SupervisionRecordModal'
import { VerifyBadge } from '@/components/ui/verify-badge'
import { PhasePill, PHASE_ORDER, type ResearchPhase } from '@/components/ui/phase-bar'
import { InteractivePhaseBar } from '@/components/project/InteractivePhaseBar'
import type { GanttPhase } from '@/components/project/ProjectGantt'
import { createClient } from '@/lib/supabase/client'
import { cn, formatRelative } from '@/lib/utils'

interface ResearchProject {
  id: string
  title: string
  status: string
  phase?: string
  updated_at: string
}

interface Annotation {
  id: string
  content: string
  artifact_type: string
  artifact_id: string
  anchor: string
  anchor_label: string | null
  project_id: string
  created_at: string
  is_resolved: boolean
}

interface LedgerEntry {
  id: string
  t: string
  who: string
  action: string
  kind: 'edit' | 'analysis' | 'data' | 'approve' | 'msg'
  href?: string
  hot?: boolean
}

const KIND_ICON: Record<string, React.ElementType> = {
  edit: PenLine,
  analysis: BarChart2,
  data: Database,
  approve: CheckCircle2,
  msg: MessageSquare,
}

export default function StudentDetailPage() {
  const { studentId } = useParams<{ studentId: string }>()
  const searchParams = useSearchParams()
  const [milestones, setMilestones] = useState<StudentMilestone[]>([])
  const [projects, setProjects] = useState<ResearchProject[]>([])
  const [studentProfile, setStudentProfile] = useState<{
    full_name: string | null; email: string; title: string | null
  } | null>(null)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [reviewing, setReviewing] = useState<StudentMilestone | null>(null)
  const [addingMilestone, setAddingMilestone] = useState(false)
  const [recordingSession, setRecordingSession] = useState(false)
  const [loading, setLoading] = useState(true)
  const initialTab = searchParams.get('tab') as 'overview' | 'milestones' | 'research' | null
  const [activeTab, setActiveTab] = useState<'overview' | 'milestones' | 'research'>(initialTab ?? 'overview')
  const [ledgerFilter, setLedgerFilter] = useState<'all' | 'data' | 'edits' | 'analyses' | 'approvals'>('all')
  const [phaseDates, setPhaseDates] = useState<Record<string, { start_date: string | null; end_date: string | null; completed_at: string | null }>>({})
  const supabase = createClient()

  const load = useCallback(async () => {
    const [milestonesRes, profileRes, researchRes, annotationsRes] = await Promise.all([
      fetch(`/api/milestones?student_id=${studentId}`),
      supabase.from('profiles').select('full_name, email, title').eq('id', studentId).single(),
      fetch(`/api/supervisor/students/${studentId}/research`),
      fetch(`/api/supervision/annotations?studentId=${studentId}`),
    ])
    if (milestonesRes.ok) setMilestones(await milestonesRes.json())
    if (profileRes.data) setStudentProfile(profileRes.data)
    if (researchRes.ok) {
      const projs = await researchRes.json()
      setProjects(projs)
      // Fetch phase dates for the primary project
      if (projs[0]?.id) {
        const phasesRes = await fetch(`/api/projects/${projs[0].id}/phases`)
        if (phasesRes.ok) {
          const { phases } = await phasesRes.json()
          const map: Record<string, { start_date: string | null; end_date: string | null; completed_at: string | null }> = {}
          for (const p of (phases ?? [])) map[p.phase_key] = p
          setPhaseDates(map)
        }
      }
    }
    if (annotationsRes.ok) {
      const data = await annotationsRes.json()
      if (Array.isArray(data)) setAnnotations(data)
    }
    setLoading(false)
  }, [studentId, supabase])

  useEffect(() => { load() }, [load])

  const pendingReview = milestones.filter(m => ['submitted', 'under_review'].includes(m.status)).length
  const approved = milestones.filter(m => m.status === 'approved').length

  const primaryProjectId = projects[0]?.id

  function artifactHref(a: Annotation): string {
    const base = `/supervisor/projects/${a.project_id}`
    if (a.artifact_type === 'dataset')  return `${base}/datasets/${a.artifact_id}`
    if (a.artifact_type === 'analysis') return `${base}/analyses/${a.artifact_id}`
    return `${base}/documents/${a.artifact_id}`
  }

  // Build ledger entries from annotations + milestones
  const ledgerEntries: LedgerEntry[] = [
    ...annotations.slice(0, 12).map((a): LedgerEntry => ({
      id: a.id,
      t: formatRelative(a.created_at),
      who: 'You',
      action: `note on ${a.anchor_label ?? a.artifact_type}`,
      kind: 'msg',
      href: artifactHref(a),
      hot: !a.is_resolved,
    })),
    ...milestones
      .filter(m => m.status === 'approved')
      .slice(0, 4)
      .map((m): LedgerEntry => ({
        id: m.id,
        t: formatRelative(m.updated_at),
        who: 'You',
        action: `approved: ${m.title}`,
        kind: 'approve',
        href: `/supervisor/students/${studentId}?tab=milestones`,
        hot: false,
      })),
    ...milestones
      .filter(m => ['submitted', 'under_review'].includes(m.status))
      .slice(0, 3)
      .map((m): LedgerEntry => ({
        id: m.id + '_sub',
        t: formatRelative(m.updated_at),
        who: studentProfile?.full_name?.split(' ')[0] ?? 'Student',
        action: `submitted: ${m.title}`,
        kind: 'edit',
        href: `/supervisor/students/${studentId}?tab=milestones`,
        hot: true,
      })),
  ].sort((a, b) => 0) // keep insertion order for now

  const filteredLedger = ledgerFilter === 'all'
    ? ledgerEntries
    : ledgerEntries.filter(e => {
        if (ledgerFilter === 'data') return e.kind === 'data'
        if (ledgerFilter === 'edits') return e.kind === 'edit'
        if (ledgerFilter === 'analyses') return e.kind === 'analysis'
        if (ledgerFilter === 'approvals') return e.kind === 'approve'
        return true
      })

  const primaryPhase: ResearchPhase = ((projects[0] as ResearchProject & { phase?: string })?.phase as ResearchPhase) ?? 'concept'
  const phaseIdx = PHASE_ORDER.indexOf(primaryPhase)

  const name = studentProfile?.full_name ?? 'Student'

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-text-tertiary text-sm font-mono">Loading…</div>
  )

  const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'milestones', label: `Milestones (${milestones.length})`, badge: pendingReview },
    { id: 'research', label: `Projects (${projects.length})` },
  ] as const

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Main column ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto min-w-0">
        <div className="px-7 py-6 pb-12">

          {/* Back */}
          <Link
            href="/supervisor/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary mb-5 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Back to cohort
          </Link>

          {/* Hero */}
          <div className="flex items-start gap-4 mb-5">
            {/* Avatar */}
            <div
              className="w-14 h-14 rounded-full flex-shrink-0 flex items-center justify-center font-mono font-semibold text-white text-xl"
              style={{ background: '#1B3A5C' }}
            >
              {name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-[28px] font-serif italic font-normal leading-tight text-text-primary">
                  {name}
                </h1>
                {studentProfile?.title && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-bg-surface-active text-text-secondary border border-border-default">
                    {studentProfile.title}
                  </span>
                )}
                <VerifyBadge />
              </div>
              <div className="mt-1.5 text-sm text-text-secondary truncate">
                {studentProfile?.email}
                {projects.length > 0 && ` · ${projects.length} project${projects.length !== 1 ? 's' : ''}`}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => setRecordingSession(true)}
                className="inline-flex items-center gap-1.5 px-3 h-8 rounded-md border border-border-default text-xs font-semibold text-text-secondary hover:bg-bg-surface-hover transition-colors"
              >
                <ClipboardList className="h-3.5 w-3.5" /> Log Session
              </button>
              <button
                onClick={() => setAddingMilestone(true)}
                className="inline-flex items-center gap-1.5 px-3 h-8 rounded-md bg-accent-primary text-white text-xs font-semibold hover:opacity-90 transition-opacity"
              >
                <Plus className="h-3.5 w-3.5" /> Add Milestone
              </button>
            </div>
          </div>

          {/* Phase track */}
          {projects.length > 0 && (
            <div className="bg-bg-surface border border-border-default rounded-lg p-3.5 mb-5">
              <div className="flex items-center gap-3 mb-2.5">
                <span className="text-[11px] text-text-tertiary font-medium uppercase tracking-wide truncate">
                  {projects[0].title}
                </span>
                <div className="flex-1" />
                <PhasePill phase={primaryPhase} />
                <span className="text-[11px] text-text-tertiary font-mono whitespace-nowrap">
                  phase {phaseIdx + 1} of 7
                </span>
              </div>
              <InteractivePhaseBar
                projectId={primaryProjectId!}
                userId={studentId}
                initialPhases={Object.entries(phaseDates).map(([phase_key, d]): GanttPhase => ({ phase_key, ...d }))}
                height={8}
                readOnly
              />
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-0 border-b border-border-default mb-5">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'relative px-4 py-2.5 text-sm font-semibold transition-colors',
                  activeTab === tab.id ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'
                )}
              >
                {tab.label}
                {'badge' in tab && tab.badge > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center h-4 w-4 rounded-full bg-amber-500 text-white text-[9px] font-bold">
                    {tab.badge}
                  </span>
                )}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-primary rounded-full" />
                )}
              </button>
            ))}
          </div>

          {/* Overview tab */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-[1.4fr_1fr] gap-4">
              {/* Projects card */}
              <div className="bg-bg-surface border border-border-default rounded-lg p-4">
                <div className="flex items-center mb-3">
                  <span className="text-sm font-semibold text-text-primary">Projects</span>
                  <span className="ml-auto text-[11px] text-text-tertiary font-mono">
                    {projects.length} active
                  </span>
                </div>
                {projects.length === 0 ? (
                  <div className="text-xs text-text-tertiary italic py-4 text-center">
                    No shared projects yet
                  </div>
                ) : (
                  <div className="divide-y divide-border-subtle">
                    {projects.map((p, i) => (
                      <Link key={p.id} href={`/supervisor/projects/${p.id}`}>
                        <div className="flex items-center gap-3 py-2.5 hover:opacity-80 transition-opacity min-w-0">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-sm font-medium text-text-primary truncate">{p.title}</span>
                            </div>
                            <div className="text-xs text-text-secondary mt-0.5 truncate">
                              Updated {formatRelative(p.updated_at)}
                            </div>
                          </div>
                          {(p as ResearchProject & { phase?: string }).phase && (
                            <PhasePill phase={(p as ResearchProject & { phase?: string }).phase!} />
                          )}
                          <ChevronRight className="h-3.5 w-3.5 text-text-tertiary flex-shrink-0" />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Stats card */}
              <div className="bg-bg-surface border border-border-default rounded-lg p-4">
                <div className="flex items-center mb-3">
                  <span className="text-sm font-semibold text-text-primary">Progress</span>
                </div>
                <div className="space-y-3">
                  {[
                    { label: 'Approved', value: approved, color: 'text-green-600', bg: 'bg-green-50' },
                    { label: 'Awaiting review', value: pendingReview, color: 'text-amber-600', bg: 'bg-amber-50' },
                    { label: 'Total milestones', value: milestones.length, color: 'text-text-secondary', bg: 'bg-bg-inset' },
                  ].map(s => (
                    <div key={s.label} className="flex items-center gap-3">
                      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-lg font-bold', s.bg, s.color)}>
                        {s.value}
                      </div>
                      <span className="text-sm text-text-secondary">{s.label}</span>
                    </div>
                  ))}
                </div>

                {/* Open annotations */}
                {annotations.filter(a => !a.is_resolved).length > 0 && (
                  <>
                    <div className="h-px bg-border-default my-3" />
                    <div className="text-[11px] text-text-tertiary uppercase tracking-wider font-semibold mb-2">
                      Signals
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Link
                        href="/supervisor/inbox"
                        className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-accent-blue-subtle text-accent-blue border border-blue-200 hover:bg-blue-100 transition-colors"
                      >
                        {annotations.filter(a => !a.is_resolved).length} open notes
                      </Link>
                      {pendingReview > 0 && (
                        <button
                          onClick={() => setActiveTab('milestones')}
                          className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors"
                        >
                          Review needed
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Milestones tab */}
          {activeTab === 'milestones' && (
            <MilestoneRoadmap
              milestones={milestones}
              role="supervisor"
              projectId={primaryProjectId}
              onReview={(m) => setReviewing(m)}
            />
          )}

          {/* Research tab */}
          {activeTab === 'research' && (
            <div className="space-y-2">
              {projects.length === 0 ? (
                <div className="text-center py-16 text-text-tertiary">
                  <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No shared projects</p>
                  <p className="text-xs mt-1 text-text-tertiary opacity-70 max-w-xs mx-auto">
                    The student must share a project with you from their project overview.
                  </p>
                </div>
              ) : (
                projects.map(p => (
                  <Link key={p.id} href={`/supervisor/projects/${p.id}`}>
                    <div className="flex items-center gap-3 px-4 py-3 bg-bg-surface border border-border-default rounded-lg hover:bg-bg-surface-hover transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-accent-blue-subtle flex items-center justify-center flex-shrink-0">
                        <FolderOpen className="h-4 w-4 text-accent-blue" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-text-primary truncate">{p.title}</p>
                        <p className="text-[10px] text-text-tertiary mt-0.5">
                          Updated {formatRelative(p.updated_at)}
                        </p>
                      </div>
                      {(p as ResearchProject & { phase?: string }).phase && (
                        <PhasePill phase={(p as ResearchProject & { phase?: string }).phase!} />
                      )}
                      <ChevronRight className="h-4 w-4 text-text-tertiary" />
                    </div>
                  </Link>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Ledger panel ────────────────────────────────────────── */}
      <aside className="w-80 flex-shrink-0 border-l border-border-default bg-bg-surface flex flex-col">
        {/* Panel header */}
        <div className="px-4 py-3.5 border-b border-border-default flex items-center gap-2">
          <Shield className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
          <span className="text-sm font-semibold">Ledger</span>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-bg-surface-active text-text-secondary border border-border-default">
            this student
          </span>
          <span className="ml-auto">
            <kbd className="inline-flex items-center px-1 py-0.5 border border-b-2 border-border-default rounded font-mono text-[10px] text-text-tertiary bg-bg-surface">
              ⌘L
            </kbd>
          </span>
        </div>

        {/* Filter chips */}
        <div className="px-3 py-2 border-b border-border-subtle flex gap-1.5 flex-wrap">
          {(['all', 'data', 'edits', 'analyses', 'approvals'] as const).map(f => (
            <button
              key={f}
              onClick={() => setLedgerFilter(f)}
              className={cn(
                'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border transition-colors capitalize',
                ledgerFilter === f
                  ? 'bg-accent-blue-subtle text-accent-blue border-blue-200'
                  : 'bg-bg-surface text-text-secondary border-border-default hover:bg-bg-surface-hover'
              )}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Ledger entries */}
        <div className="flex-1 overflow-y-auto px-3.5 py-2">
          {filteredLedger.length === 0 ? (
            <div className="text-center py-10 text-text-tertiary text-xs">
              No activity recorded yet
            </div>
          ) : (
            filteredLedger.map((entry, i) => {
              const Icon = KIND_ICON[entry.kind] ?? PenLine
              const inner = (
                <>
                  {/* Timeline dot + line */}
                  <div className="w-4 flex flex-col items-center flex-shrink-0">
                    <div
                      className={cn(
                        'w-2 h-2 rounded-sm mt-1.5 flex-shrink-0',
                        entry.hot ? 'bg-accent-blue' : 'bg-text-tertiary'
                      )}
                    />
                    {i < filteredLedger.length - 1 && (
                      <div className="flex-1 w-px bg-border-default mt-1" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-1.5 min-w-0">
                      <Icon className="h-3 w-3 text-text-tertiary flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-text-primary leading-tight truncate">
                          <span className="font-semibold">{entry.who}</span>{' '}
                          <span className="text-text-secondary">{entry.action}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-[10px] text-text-tertiary">{entry.t}</span>
                          <VerifyBadge />
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )
              return entry.href ? (
                <Link
                  key={entry.id}
                  href={entry.href}
                  className="flex gap-2 py-2.5 border-t first:border-t-0 border-border-subtle relative hover:bg-bg-surface-hover transition-colors rounded-md px-1 -mx-1"
                >
                  {inner}
                </Link>
              ) : (
                <div key={entry.id} className="flex gap-2 py-2.5 border-t first:border-t-0 border-border-subtle relative">
                  {inner}
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-3 py-3 border-t border-border-default flex gap-2">
          <button className="flex-1 flex items-center justify-center gap-1.5 h-7 px-2 rounded border border-border-default text-[11px] font-medium text-text-secondary hover:bg-bg-surface-hover transition-colors">
            <Download className="h-3 w-3" /> Export
          </button>
          <button className="flex-1 flex items-center justify-center gap-1.5 h-7 px-2 rounded border border-border-default text-[11px] font-medium text-text-secondary hover:bg-bg-surface-hover transition-colors">
            <Shield className="h-3 w-3" /> Verify chain
          </button>
        </div>
      </aside>

      {/* Modals */}
      {reviewing && (
        <MilestoneReviewModal
          milestone={reviewing}
          onClose={() => setReviewing(null)}
          onSuccess={() => { setReviewing(null); load() }}
        />
      )}
      {addingMilestone && (
        <AddMilestoneModal
          studentId={studentId}
          projectId={primaryProjectId}
          onClose={() => setAddingMilestone(false)}
          onSuccess={() => { setAddingMilestone(false); load() }}
        />
      )}
      {recordingSession && primaryProjectId && (
        <SupervisionRecordModal
          projectId={primaryProjectId}
          studentId={studentId}
          open={recordingSession}
          onClose={() => setRecordingSession(false)}
          onCreated={() => { setRecordingSession(false); load() }}
        />
      )}
    </div>
  )
}
