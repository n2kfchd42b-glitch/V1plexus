'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  Shield, ChevronRight, MessageSquare, BookOpen,
  CheckSquare, Star, CheckCircle2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { StudentMilestone } from '@/types/database'
import { MilestoneRoadmap } from '@/components/supervisor-student/MilestoneRoadmap'
import { MilestoneSubmitModal } from '@/components/supervisor-student/MilestoneSubmitModal'
import { VerifyBadge } from '@/components/ui/verify-badge'
import { PhaseBar, PhasePill } from '@/components/ui/phase-bar'
import { cn } from '@/lib/utils'

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
  const [tab, setTab] = useState<'milestones' | 'sessions'>('milestones')

  const supabase = createClient()

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [milestonesRes, profileRes, projectsRes, supervisorRes, notesRes, sessionsRes] = await Promise.all([
      fetch(`/api/milestones?student_id=${user.id}`),
      supabase.from('profiles').select('full_name, email, title').eq('id', user.id).single(),
      supabase.from('projects').select('id, title, status, updated_at').eq('owner_id', user.id).order('updated_at', { ascending: false }).limit(3),
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
    if (projectsRes.data) setProjects(projectsRes.data as Project[])
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
  const primaryPhase = (primaryProject as (Project & { phase?: string }) | undefined)?.phase ?? 'concept'

  const approvedCount = milestones.filter(m => m.status === 'approved').length
  const unresolvedNotes = notes.filter(n => !n.is_resolved)

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

        {/* Tabs */}
        <div className="flex gap-0 border-b border-border-default mb-6">
          {[
            { id: 'milestones', label: `Milestones (${milestones.length})` },
            { id: 'sessions',   label: `Sessions (${sessions.length})` },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as typeof tab)}
              className={cn(
                'relative px-4 py-2.5 text-sm font-semibold transition-colors',
                tab === t.id ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'
              )}
            >
              {t.label}
              {tab === t.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-primary rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* ── Sessions tab ───────────────────────────────────────────────── */}
        {tab === 'sessions' && (
          <div className="space-y-4">
            {sessions.length === 0 ? (
              <div className="text-center py-20 text-text-tertiary">
                <BookOpen className="h-8 w-8 mx-auto mb-3 opacity-40" />
                <div className="text-sm font-medium mb-1">No session records yet</div>
                <div className="text-xs">Your supervisor&apos;s session notes will appear here after your meetings</div>
              </div>
            ) : sessions.map(session => (
              <div key={session.id} className="bg-bg-surface border border-border-default rounded-lg overflow-hidden">
                <div className="flex items-start gap-4 px-5 py-4 border-b border-border-default">
                  <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                    <BookOpen className="h-4 w-4 text-indigo-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-text-primary">{session.title}</h3>
                    <p className="text-xs text-text-secondary mt-0.5">
                      {session.supervisor?.full_name ?? 'Your supervisor'} ·{' '}
                      {new Date(session.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                </div>
                <div className="px-5 py-4 space-y-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary mb-1.5">Summary</p>
                    <p className="text-sm text-text-primary leading-relaxed whitespace-pre-line">{session.summary}</p>
                  </div>
                  {session.action_items && session.action_items.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary mb-1.5">Action items</p>
                      <ul className="space-y-1.5">
                        {session.action_items.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-text-primary">
                            <CheckSquare className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-text-tertiary" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Milestones tab ─────────────────────────────────────────────── */}
        {tab === 'milestones' && (
          <>
            {/* Page header — greeting + project hero */}
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
                        {milestones.length > 0 && ' · '}
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
                      <PhaseBar phase={primaryPhase} showLabels height={6} />
                    </div>

                    {/* Progress stats */}
                    <div className="border-l border-border-default pl-4 flex-shrink-0 flex flex-col gap-2.5">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        <span className="text-sm font-semibold text-text-primary">{approvedCount}</span>
                        <span className="text-xs text-text-secondary">approved</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Star className="h-3.5 w-3.5 text-amber-400" />
                        <span className="text-sm font-semibold text-text-primary">
                          {milestones.filter(m => !['approved'].includes(m.status)).length}
                        </span>
                        <span className="text-xs text-text-secondary">remaining</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Two-column: roadmap + supervisor sidebar */}
            <div className="grid grid-cols-[1fr_260px] gap-5 items-start">

              {/* Main — milestone roadmap */}
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

              {/* Sidebar — supervisor notes + ledger strip */}
              <div className="flex flex-col gap-4">

                {/* From supervisor */}
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
                      <span className="ml-auto inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-accent-blue-subtle text-accent-blue border border-blue-200 flex-shrink-0">
                        {unresolvedNotes.length}
                      </span>
                    )}
                  </div>

                  {notes.length === 0 ? (
                    <div className="px-3 py-5 text-center text-[11px] text-text-tertiary">
                      No notes yet
                    </div>
                  ) : (
                    <div className="divide-y divide-border-subtle">
                      {[...unresolvedNotes, ...notes.filter(n => n.is_resolved)].slice(0, 5).map(note => (
                        <div key={note.id} className="flex gap-2 items-start px-3 py-2.5 relative">
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

                {/* Ledger strip */}
                <div
                  className="rounded-lg p-3"
                  style={{
                    background: 'linear-gradient(180deg, var(--status-success-bg) 0%, var(--bg-surface) 100%)',
                    border: '1px solid var(--border-status-success)',
                  }}
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <Shield className="h-3 w-3 text-green-700 flex-shrink-0" />
                    <span className="text-[11px] font-semibold text-green-700">Your work is recorded</span>
                  </div>
                  <div className="flex gap-3">
                    {[
                      { k: 'Approved', v: approvedCount },
                      { k: 'Submitted', v: milestones.filter(m => m.status === 'submitted').length },
                      { k: 'Projects', v: projects.length },
                    ].map(s => (
                      <div key={s.k} className="text-center flex-1">
                        <div className="text-[18px] font-serif leading-none text-text-primary">{s.v}</div>
                        <div className="text-[9px] text-text-tertiary uppercase tracking-wide mt-0.5">{s.k}</div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          </>
        )}

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
