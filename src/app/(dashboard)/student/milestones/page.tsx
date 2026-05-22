'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  ChevronRight, MessageSquare, BookOpen,
  CheckSquare, Star, CheckCircle2,
  FileText, Database, BarChart2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { StudentMilestone } from '@/types/database'
import { MilestoneRoadmap } from '@/components/supervisor-student/MilestoneRoadmap'
import { MilestoneSubmitModal } from '@/components/supervisor-student/MilestoneSubmitModal'
import { VerifyBadge } from '@/components/ui/verify-badge'
import { PhasePill } from '@/components/ui/phase-bar'
import { cn } from '@/lib/utils'

interface ProjectPhaseRow {
  phase_key: string
  name: string | null
  color: string | null
  start_date: string | null
  end_date: string | null
  completed_at: string | null
  sort_order: number | null
}

// Fallback colors matching the Gantt's CSS variables
const PHASE_FALLBACK_COLORS: Record<string, string> = {
  concept: '#A1A1AA', protocol: '#3B82F6', ethics: '#F59E0B',
  data_collection: '#8B5CF6', data: '#8B5CF6', analysis: '#EC4899',
  writing: '#14B8A6', publication: '#22C55E',
}

function fmtShort(iso: string) {
  const [, m, d] = iso.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[parseInt(m) - 1]} ${parseInt(d)}`
}

function MiniPhaseBar({ phases }: { phases: ProjectPhaseRow[] }) {
  if (phases.length === 0) return null
  const activeIdx = phases.findIndex(p => !p.completed_at)
  return (
    <div className="w-full">
      <div className="flex gap-0.5 h-1.5">
        {phases.map((p, i) => {
          const color = p.color ?? PHASE_FALLBACK_COLORS[p.phase_key] ?? '#A1A1AA'
          const isDone = !!p.completed_at
          const isActive = i === activeIdx
          return (
            <div
              key={p.phase_key}
              className="flex-1 rounded-sm"
              title={
                p.start_date && p.end_date
                  ? `${p.name ?? p.phase_key}: ${fmtShort(p.start_date)} → ${fmtShort(p.end_date)}${isDone ? ' ✓' : ''}`
                  : p.name ?? p.phase_key
              }
              style={{
                background: isDone || isActive ? color : '#E4E4E7',
                opacity: isDone ? 0.4 : 1,
              }}
            />
          )
        })}
      </div>
      <div className="flex gap-0.5 mt-1">
        {phases.map((p, i) => {
          const isActive = i === activeIdx
          return (
            <div key={p.phase_key} className="flex-1 min-w-0">
              <span className={cn(
                'text-[9px] font-medium block truncate',
                isActive ? 'text-text-primary font-semibold' : 'text-text-tertiary'
              )}>
                {(p.name ?? p.phase_key).slice(0, 3)}
              </span>
              {p.start_date && (
                <span className="text-[8px] text-text-tertiary block leading-tight font-mono">
                  {fmtShort(p.start_date)}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface Project {
  id: string
  title: string
  status: string
  phase?: string
  updated_at: string
}

interface SupervisorNote {
  id: string
  content: string
  artifact_type: string
  artifact_id: string
  created_at: string
  is_resolved: boolean
  supervisor?: { full_name: string | null }
}

interface Profile {
  full_name: string | null
  email: string
  title: string | null
}

interface SupervisionRecord {
  id: string
  title: string
  summary: string
  action_items: string[]
  created_at: string
  supervisor?: { full_name: string | null }
}

interface SupervisorAssignment {
  supervisor_id: string
  supervisor: {
    full_name: string | null
    email: string
  }
}

interface LatestDoc     { id: string; title: string; doc_type: string | null; updated_at: string }
interface LatestDataset { id: string; name: string;  updated_at: string }
interface LatestRun     { id: string; title: string | null; analysis_type: string; created_at: string }

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60)   return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24)   return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function StudentMilestonesPage() {
  const [milestones, setMilestones] = useState<StudentMilestone[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [supervisor, setSupervisor] = useState<SupervisorAssignment | null>(null)
  const [notes, setNotes] = useState<SupervisorNote[]>([])
  const [loading, setLoading] = useState(true)
  const [sessions, setSessions] = useState<SupervisionRecord[]>([])
  const [submitting, setSubmitting] = useState<StudentMilestone | null>(null)
  const [projectPhases, setProjectPhases] = useState<ProjectPhaseRow[]>([])
  const [latestDoc,     setLatestDoc]     = useState<LatestDoc | null>(null)
  const [latestDataset, setLatestDataset] = useState<LatestDataset | null>(null)
  const [latestRun,     setLatestRun]     = useState<LatestRun | null>(null)

  const supabase = createClient()

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [milestonesRes, profileRes, projectsRes, supervisorRes, notesRes, sessionsRes] = await Promise.all([
      fetch(`/api/milestones?student_id=${user.id}`),
      supabase.from('profiles').select('full_name, email, title').eq('id', user.id).single(),
      supabase.from('projects').select('id, title, status, phase, updated_at').eq('owner_id', user.id).order('updated_at', { ascending: false }).limit(3),
      supabase
        .from('supervisor_assignments')
        .select('supervisor_id, supervisor:profiles!supervisor_id(full_name, email)')
        .eq('student_id', user.id)
        .eq('status', 'active')
        .maybeSingle(),
      fetch(`/api/supervision/annotations?studentId=${user.id}`),
      fetch(`/api/supervision/records?studentId=${user.id}`),
    ])

    if (milestonesRes.ok) setMilestones(await milestonesRes.json())
    if (profileRes.data) setProfile(profileRes.data)
    if (projectsRes.data) {
      const loaded = projectsRes.data as Project[]
      setProjects(loaded)
      // Fetch project_phases + latest artifacts in parallel
      if (loaded[0]) {
        const pid = loaded[0].id
        const [phasesRes, docRes, datasetRes, runRes] = await Promise.all([
          supabase.from('project_phases').select('phase_key, name, color, start_date, end_date, completed_at, sort_order').eq('project_id', pid).order('sort_order'),
          supabase.from('documents').select('id, title, doc_type, updated_at').eq('project_id', pid).is('deleted_at', null).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
          supabase.from('datasets').select('id, name, updated_at').eq('project_id', pid).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
          supabase.from('analysis_runs').select('id, title, analysis_type, created_at').eq('project_id', pid).eq('status', 'completed').order('created_at', { ascending: false }).limit(1).maybeSingle(),
        ])
        if (phasesRes.data) setProjectPhases(phasesRes.data as ProjectPhaseRow[])
        if (docRes.data)     setLatestDoc(docRes.data as LatestDoc)
        if (datasetRes.data) setLatestDataset(datasetRes.data as LatestDataset)
        if (runRes.data)     setLatestRun(runRes.data as LatestRun)
      }
    }
    if (supervisorRes.data) setSupervisor(supervisorRes.data as unknown as SupervisorAssignment)
    if (notesRes.ok) {
      const data = await notesRes.json()
      if (Array.isArray(data)) setNotes(data)
    }
    if (sessionsRes.ok) {
      const data = await sessionsRes.json()
      if (Array.isArray(data)) setSessions(data)
    }

    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  const firstName = profile?.full_name?.split(' ')[0] ?? 'there'
  const primaryProject = projects[0]

  // Active phase = first entry in sort_order without completed_at, matching Gantt logic
  const activePhaseRow = projectPhases.find(p => !p.completed_at) ?? projectPhases[projectPhases.length - 1]
  const primaryPhase = activePhaseRow?.phase_key ?? primaryProject?.phase ?? 'concept'

  const approvedCount = milestones.filter(m => m.status === 'approved').length
  const unresolvedNotes = notes.filter(n => !n.is_resolved)

  async function markNoteRead(noteId: string) {
    await fetch('/api/supervision/annotations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: noteId, is_resolved: true }),
    })
    setNotes(prev => prev.map(n => n.id === noteId ? { ...n, is_resolved: true } : n))
  }

  async function markAllRead() {
    await Promise.all(unresolvedNotes.map(n => markNoteRead(n.id)))
  }

  const supervisorName = supervisor
    ? (supervisor.supervisor as { full_name: string | null }).full_name ?? 'Your supervisor'
    : 'Your supervisor'
  const supervisorInitials = supervisorName.split(' ').map((p: string) => p[0]).join('').slice(0, 2).toUpperCase()

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-text-tertiary text-sm font-mono">
      Loading your roadmap…
    </div>
  )

  return (
    <div className="h-full overflow-y-auto px-8 py-6">
      <div className="max-w-5xl mx-auto">

        {/* Page header */}
        <div className="mb-6">
          <div className="flex items-end justify-between mb-4">
            <div>
              <h1 className="text-[32px] font-serif italic font-normal text-text-primary leading-tight tracking-tight">
                {greeting()}, {firstName}.
              </h1>
              <div className="mt-1 text-sm text-text-secondary">
                {unresolvedNotes.length > 0 && (
                  <span>
                    <span className="font-semibold text-text-primary">
                      {unresolvedNotes.length} new note{unresolvedNotes.length !== 1 ? 's' : ''}
                    </span>{' '}
                    from {supervisorName}
                    {approvedCount > 0 && ' · '}
                  </span>
                )}
                {approvedCount > 0 && (
                  <span>
                    <span className="font-semibold text-text-primary">{approvedCount}</span> milestone{approvedCount !== 1 ? 's' : ''} approved
                  </span>
                )}
              </div>
            </div>
            <VerifyBadge />
          </div>

          {/* Primary project hero */}
          {primaryProject && (
            <div className="bg-bg-surface border border-border-default rounded-lg p-4">
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <PhasePill phase={primaryPhase} />
                    <span className="text-[11px] text-text-tertiary font-medium uppercase tracking-wide">
                      Primary project
                    </span>
                  </div>
                  <div className="text-[20px] font-serif italic leading-snug text-text-primary mb-3">
                    {primaryProject.title}
                  </div>
                  <MiniPhaseBar phases={projectPhases} />
                </div>

                <div className="border-l border-border-default pl-4 flex-shrink-0 flex flex-col gap-2.5">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="text-sm font-semibold text-text-primary">{approvedCount}</span>
                    <span className="text-xs text-text-secondary">approved</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Star className="h-3.5 w-3.5 text-amber-400" />
                    <span className="text-sm font-semibold text-text-primary">
                      {milestones.filter(m => m.status !== 'approved').length}
                    </span>
                    <span className="text-xs text-text-secondary">remaining</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Two-column: milestones + sidebar */}
        <div className="grid grid-cols-[1fr_260px] gap-5 items-start">

          {/* Main — milestone list */}
          <div>
            {milestones.length === 0 ? (
              <div className="text-center py-20 text-text-tertiary bg-bg-surface border border-border-default rounded-lg">
                <div className="text-sm font-medium mb-1">No milestones assigned yet</div>
                <div className="text-xs">Your supervisor will set up your research roadmap</div>
              </div>
            ) : (
              <MilestoneRoadmap
                milestones={milestones}
                role="student"
                projectId={projects[0]?.id}
                onSubmit={(m) => setSubmitting(m)}
              />
            )}
          </div>

          {/* Sidebar */}
          <div className="flex flex-col gap-4">

            {/* Supervisor notes */}
            <div className="bg-bg-surface border border-border-default rounded-lg overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border-default">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-white font-mono font-semibold flex-shrink-0"
                  style={{ background: '#1B3A5C', fontSize: 9 }}
                >
                  {supervisorInitials}
                </div>
                <span className="text-xs font-semibold text-text-primary truncate">
                  {supervisorName}
                </span>
                {unresolvedNotes.length > 0 && (
                  <>
                    <span className="ml-auto inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-accent-blue-subtle text-accent-blue border border-blue-200 flex-shrink-0">
                      {unresolvedNotes.length}
                    </span>
                    <button
                      onClick={markAllRead}
                      className="text-[10px] font-semibold text-text-tertiary hover:text-text-primary transition-colors flex-shrink-0"
                    >
                      Mark all read
                    </button>
                  </>
                )}
              </div>

              {notes.length === 0 ? (
                <div className="px-3 py-5 text-center text-[11px] text-text-tertiary">
                  No notes yet
                </div>
              ) : (
                <div className="divide-y divide-border-subtle">
                  {[...unresolvedNotes, ...notes.filter(n => n.is_resolved)].slice(0, 5).map(note => (
                    <div key={note.id} className="group flex gap-2 items-start px-3 py-2.5 relative hover:bg-bg-surface-hover transition-colors">
                      {!note.is_resolved && (
                        <div className="absolute left-1 top-4 w-1.5 h-1.5 rounded-full bg-accent-blue flex-shrink-0" />
                      )}
                      <MessageSquare className={cn('h-3 w-3 flex-shrink-0 mt-0.5', note.is_resolved ? 'text-text-tertiary' : 'text-text-secondary')} />
                      <div className="flex-1 min-w-0">
                        <div className={cn('text-[12px] truncate', note.is_resolved ? 'text-text-secondary' : 'font-semibold text-text-primary')}>
                          Note on {note.artifact_type}
                        </div>
                        <div className="text-[11px] text-text-secondary mt-0.5 line-clamp-2 leading-snug">
                          {note.content}
                        </div>
                      </div>
                      {!note.is_resolved && (
                        <button
                          onClick={() => markNoteRead(note.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5 text-[10px] font-semibold text-text-tertiary hover:text-accent-blue"
                          title="Mark as read"
                        >
                          ✓
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {projects[0] && (
                <div className="px-3 py-2 border-t border-border-subtle">
                  <Link
                    href={`/projects/${projects[0].id}`}
                    className="text-[11px] font-semibold text-accent-blue hover:underline flex items-center gap-1"
                  >
                    Open project to reply <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
              )}
            </div>

            {/* Quick access */}
            {(latestDoc || latestDataset || latestRun) && primaryProject && (
              <div className="bg-bg-surface border border-border-default rounded-lg overflow-hidden">
                <div className="px-3 py-2.5 border-b border-border-default">
                  <span className="text-xs font-semibold text-text-primary">Quick access</span>
                </div>
                <div className="divide-y divide-border-subtle">
                  {latestDoc && (
                    <Link
                      href={`/projects/${primaryProject.id}/documents/${latestDoc.id}`}
                      className="flex items-start gap-2.5 px-3 py-2.5 hover:bg-bg-surface-hover transition-colors group"
                    >
                      <FileText className="h-3.5 w-3.5 text-text-tertiary flex-shrink-0 mt-0.5 group-hover:text-accent-blue transition-colors" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-semibold text-text-primary truncate group-hover:text-accent-blue transition-colors">
                          {latestDoc.title || 'Untitled document'}
                        </div>
                        <div className="text-[11px] text-text-tertiary mt-0.5">
                          {latestDoc.doc_type ?? 'Document'} · {timeAgo(latestDoc.updated_at)}
                        </div>
                      </div>
                      <ChevronRight className="h-3 w-3 text-text-tertiary flex-shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                  )}
                  {latestDataset && (
                    <Link
                      href={`/projects/${primaryProject.id}/data`}
                      className="flex items-start gap-2.5 px-3 py-2.5 hover:bg-bg-surface-hover transition-colors group"
                    >
                      <Database className="h-3.5 w-3.5 text-text-tertiary flex-shrink-0 mt-0.5 group-hover:text-accent-blue transition-colors" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-semibold text-text-primary truncate group-hover:text-accent-blue transition-colors">
                          {latestDataset.name}
                        </div>
                        <div className="text-[11px] text-text-tertiary mt-0.5">
                          Dataset · {timeAgo(latestDataset.updated_at)}
                        </div>
                      </div>
                      <ChevronRight className="h-3 w-3 text-text-tertiary flex-shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                  )}
                  {latestRun && (
                    <Link
                      href={`/projects/${primaryProject.id}/analysis`}
                      className="flex items-start gap-2.5 px-3 py-2.5 hover:bg-bg-surface-hover transition-colors group"
                    >
                      <BarChart2 className="h-3.5 w-3.5 text-text-tertiary flex-shrink-0 mt-0.5 group-hover:text-accent-blue transition-colors" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-semibold text-text-primary truncate group-hover:text-accent-blue transition-colors">
                          {latestRun.title ?? latestRun.analysis_type}
                        </div>
                        <div className="text-[11px] text-text-tertiary mt-0.5">
                          Analysis · {timeAgo(latestRun.created_at)}
                        </div>
                      </div>
                      <ChevronRight className="h-3 w-3 text-text-tertiary flex-shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                  )}
                </div>
              </div>
            )}

            {/* Sessions */}
            {sessions.length > 0 && (
              <div className="bg-bg-surface border border-border-default rounded-lg overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border-default">
                  <BookOpen className="h-3.5 w-3.5 text-text-tertiary flex-shrink-0" />
                  <span className="text-xs font-semibold text-text-primary">
                    Sessions
                  </span>
                  <span className="ml-auto text-[10px] text-text-tertiary">{sessions.length}</span>
                </div>
                <div className="divide-y divide-border-subtle">
                  {sessions.slice(0, 4).map(session => (
                    <div key={session.id} className="px-3 py-2.5">
                      <div className="text-[12px] font-semibold text-text-primary truncate">{session.title}</div>
                      <div className="text-[11px] text-text-secondary mt-0.5">
                        {new Date(session.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                      {session.action_items?.length > 0 && (
                        <ul className="mt-1.5 space-y-1">
                          {session.action_items.slice(0, 2).map((item, idx) => (
                            <li key={idx} className="flex items-start gap-1.5 text-[11px] text-text-secondary">
                              <CheckSquare className="h-3 w-3 flex-shrink-0 mt-0.5 text-text-tertiary" />
                              <span className="line-clamp-1">{item}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>

      </div>

      {submitting && (
        <MilestoneSubmitModal
          milestone={submitting}
          onClose={() => setSubmitting(null)}
          onSuccess={() => { setSubmitting(null); load() }}
        />
      )}
    </div>
  )
}
