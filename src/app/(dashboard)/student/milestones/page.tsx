'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { CheckCircle2, Star, Shield, ChevronRight, Bell, MessageSquare } from 'lucide-react'
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
  const [submitting, setSubmitting] = useState<StudentMilestone | null>(null)
  const [tab, setTab] = useState<'home' | 'roadmap'>('home')

  const supabase = createClient()

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [milestonesRes, profileRes, projectsRes, supervisorRes, notesRes] = await Promise.all([
      fetch(`/api/milestones?student_id=${user.id}`),
      supabase.from('profiles').select('full_name, email, title').eq('id', user.id).single(),
      supabase.from('projects').select('id, title, status, updated_at').eq('owner_id', user.id).order('updated_at', { ascending: false }).limit(3),
      supabase
        .from('supervisor_assignments')
        .select('supervisor_id, supervisor:profiles!supervisor_id(full_name, email)')
        .eq('student_id', user.id)
        .eq('status', 'active')
        .maybeSingle(),
      fetch(`/api/supervision/annotations?artifactId=${user.id}&artifactType=student`),
    ])

    if (milestonesRes.ok) setMilestones(await milestonesRes.json())
    if (profileRes.data) setProfile(profileRes.data)
    if (projectsRes.data) setProjects(projectsRes.data as Project[])
    if (supervisorRes.data) setSupervisor(supervisorRes.data as unknown as SupervisorAssignment)
    if (notesRes.ok) {
      const data = await notesRes.json()
      if (Array.isArray(data)) setNotes(data)
    }

    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  const firstName = profile?.full_name?.split(' ')[0] ?? 'there'
  const primaryProject = projects[0]
  const primaryPhase = (primaryProject as (Project & { phase?: string }) | undefined)?.phase ?? 'concept'

  const nextMilestone = milestones.find(m => !['approved', 'submitted'].includes(m.status))
  const pendingMilestones = milestones.filter(m => !['approved', 'submitted'].includes(m.status))
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
            { id: 'home', label: 'My Roadmap' },
            { id: 'roadmap', label: `Milestones (${milestones.length})` },
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

        {tab === 'roadmap' && (
          <div>
            {milestones.length === 0 ? (
              <div className="text-center py-20 text-text-tertiary">
                <div className="text-sm font-medium mb-1">No milestones assigned yet</div>
                <div className="text-xs">Your supervisor will set up your research roadmap</div>
              </div>
            ) : (
              <MilestoneRoadmap
                milestones={milestones}
                role="student"
                onSubmit={(m) => setSubmitting(m)}
              />
            )}
          </div>
        )}

        {tab === 'home' && (
          <>
            {/* Greeting */}
            <div className="flex items-end justify-between mb-5">
              <div>
                <h1 className="text-[32px] font-serif italic font-normal text-text-primary leading-tight tracking-tight">
                  {greeting()}, {firstName}.
                </h1>
                <div className="mt-1.5 text-sm text-text-secondary">
                  {unresolvedNotes.length > 0 && (
                    <>
                      You have{' '}
                      <span className="font-semibold text-text-primary">
                        {unresolvedNotes.length} new note{unresolvedNotes.length !== 1 ? 's' : ''}
                      </span>{' '}
                      from {supervisorName}{' '}
                    </>
                  )}
                  {pendingMilestones.length > 0 && (
                    <>· <span className="font-semibold text-text-primary">{pendingMilestones.length}</span> milestone{pendingMilestones.length !== 1 ? 's' : ''} in progress</>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <VerifyBadge />
                <span className="text-xs text-text-tertiary">
                  {approvedCount} milestone{approvedCount !== 1 ? 's' : ''} approved
                </span>
              </div>
            </div>

            {/* Hero — primary project */}
            {primaryProject && (
              <div className="bg-bg-surface border border-border-default rounded-lg p-4 mb-5 relative">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <PhasePill phase={primaryPhase} />
                      <span className="text-[11px] text-text-tertiary font-medium uppercase tracking-wide">
                        Primary project
                      </span>
                    </div>
                    <div className="text-[22px] font-serif italic leading-snug text-text-primary mb-3">
                      {primaryProject.title}
                    </div>
                    <PhaseBar phase={primaryPhase} showLabels height={6} />
                  </div>

                  {/* Next milestone sidebar */}
                  {nextMilestone && (
                    <div className="w-56 border-l border-border-default pl-4 flex-shrink-0">
                      <div className="text-[11px] text-text-tertiary font-medium uppercase tracking-wide mb-1">
                        Next milestone
                      </div>
                      <div className="text-base font-semibold text-text-primary leading-tight">
                        {nextMilestone.title}
                      </div>
                      {nextMilestone.due_date && (
                        <div className="text-xs text-text-secondary mt-0.5">
                          Due {new Date(nextMilestone.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </div>
                      )}
                      {pendingMilestones.length > 0 && (
                        <div className="mt-2.5 px-2 py-1.5 rounded border border-amber-300 bg-amber-50 text-[11px] text-amber-800">
                          ⚑ {pendingMilestones.length} milestone{pendingMilestones.length !== 1 ? 's' : ''} still to submit
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 2-col: From supervisor + What's next */}
            <div className="grid grid-cols-[1.2fr_1fr] gap-4 mb-4">

              {/* From supervisor */}
              <div className="bg-bg-surface border border-border-default rounded-lg overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-border-default">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-white font-mono font-semibold text-[9px] flex-shrink-0"
                    style={{ background: '#1B3A5C', fontSize: 9 }}
                  >
                    {supervisorInitials}
                  </div>
                  <span className="text-sm font-semibold text-text-primary">
                    From {supervisorName}
                  </span>
                  {unresolvedNotes.length > 0 && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-bg-surface-active text-text-secondary border border-border-default">
                      {unresolvedNotes.length} unread
                    </span>
                  )}
                  <button className="ml-auto text-[11px] font-semibold text-text-tertiary hover:text-text-primary transition-colors px-2 h-6">
                    Mark all read
                  </button>
                </div>

                {unresolvedNotes.length === 0 && notes.length === 0 ? (
                  <div className="px-4 py-6 text-center text-text-tertiary text-xs">
                    No notes yet — your supervisor's feedback will appear here
                  </div>
                ) : (
                  <div className="divide-y divide-border-subtle">
                    {[...unresolvedNotes, ...notes.filter(n => n.is_resolved)].slice(0, 4).map((note, i) => (
                      <div key={note.id} className="flex gap-2.5 items-start px-4 py-3 relative">
                        {!note.is_resolved && (
                          <div className="absolute left-1.5 top-5 w-1.5 h-1.5 rounded-full bg-accent-blue" />
                        )}
                        <MessageSquare className={cn('h-3.5 w-3.5 flex-shrink-0 mt-0.5', note.is_resolved ? 'text-text-tertiary' : 'text-text-secondary')} />
                        <div className="flex-1 min-w-0">
                          <div className={cn('text-sm truncate', note.is_resolved ? 'text-text-secondary' : 'font-semibold text-text-primary')}>
                            Note on {note.artifact_type}
                          </div>
                          <div className="text-xs text-text-secondary mt-0.5 line-clamp-1">
                            {note.content}
                          </div>
                        </div>
                        <span className="text-[11px] text-text-tertiary font-mono flex-shrink-0">
                          {new Date(note.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {projects[0] && (
                  <div className="px-4 py-2 border-t border-border-subtle">
                    <Link
                      href={`/projects/${projects[0].id}`}
                      className="text-[11px] font-semibold text-accent-blue hover:underline flex items-center gap-1"
                    >
                      Open project to reply <ChevronRight className="h-3 w-3" />
                    </Link>
                  </div>
                )}
              </div>

              {/* What's next */}
              <div className="bg-bg-surface border border-border-default rounded-lg overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-border-default">
                  <Star className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-sm font-semibold text-text-primary">What&apos;s next</span>
                  {pendingMilestones.length > 0 && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-accent-blue-subtle text-accent-blue border border-blue-200">
                      {pendingMilestones.length}
                    </span>
                  )}
                </div>

                {pendingMilestones.length === 0 ? (
                  <div className="px-4 py-6 text-center text-text-tertiary text-xs">
                    All milestones submitted — great work!
                  </div>
                ) : (
                  <div className="divide-y divide-border-subtle">
                    {pendingMilestones.slice(0, 4).map((m, i) => (
                      <div
                        key={m.id}
                        className="flex items-center gap-2.5 px-4 py-3 cursor-pointer hover:bg-bg-surface-hover transition-colors"
                        onClick={() => setSubmitting(m)}
                      >
                        <div className={cn(
                          'w-4 h-4 rounded flex-shrink-0 border',
                          i === 0 ? 'border-amber-400 bg-amber-50' : 'border-border-strong bg-bg-surface',
                        )} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-text-primary truncate">{m.title}</div>
                          {m.due_date && (
                            <div className="text-[11px] text-text-tertiary mt-0.5">
                              Due {new Date(m.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                            </div>
                          )}
                        </div>
                        {i === 0 ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            now
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-bg-surface-active text-text-secondary border border-border-default">
                            later
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Contributions card */}
            <div className="bg-gradient-to-b from-green-50 to-white border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                  <Shield className="h-5 w-5 text-green-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-text-primary">
                    Your work — recorded permanently
                  </div>
                  <div className="text-xs text-text-secondary mt-0.5">
                    Every submission, edit, and milestone is on your project&apos;s ledger. Cite your contributions confidently.
                  </div>
                </div>
                <div className="flex gap-4 flex-shrink-0">
                  {[
                    { k: 'Approved', v: String(approvedCount) },
                    { k: 'Submitted', v: String(milestones.filter(m => m.status === 'submitted').length) },
                    { k: 'Projects', v: String(projects.length) },
                  ].map(s => (
                    <div key={s.k} className="text-right">
                      <div className="text-[22px] font-serif leading-none font-normal text-text-primary">{s.v}</div>
                      <div className="text-[10px] text-text-tertiary uppercase tracking-wide mt-0.5">{s.k}</div>
                    </div>
                  ))}
                </div>
                <button className="flex items-center gap-1.5 h-7 px-3 rounded border border-green-200 text-[11px] font-semibold text-green-700 hover:bg-green-50 transition-colors flex-shrink-0">
                  Ledger
                </button>
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
