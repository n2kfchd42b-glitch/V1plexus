'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Mail, BookOpen, MessageSquare, CheckSquare, UserCheck } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface SupervisorProfile {
  id: string
  full_name: string | null
  email: string
  title: string | null
  avatar_url: string | null
}

interface SupervisionRecord {
  id: string
  title: string
  summary: string
  action_items: string[]
  created_at: string
}

interface SupervisorNote {
  id: string
  content: string
  artifact_type: string
  created_at: string
  is_resolved: boolean
}

export default function MySupervisorPage() {
  const [supervisor, setSupervisor] = useState<SupervisorProfile | null>(null)
  const [sessions, setSessions] = useState<SupervisionRecord[]>([])
  const [notes, setNotes] = useState<SupervisorNote[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: assignment } = await supabase
      .from('supervisor_assignments')
      .select('supervisor_id, supervisor:profiles!supervisor_id(id, full_name, email, title, avatar_url)')
      .eq('student_id', user.id)
      .eq('status', 'active')
      .maybeSingle()

    if (assignment?.supervisor) {
      setSupervisor(assignment.supervisor as unknown as SupervisorProfile)
    }

    const [sessionsRes, notesRes] = await Promise.all([
      fetch(`/api/supervision/records?studentId=${user.id}`),
      fetch(`/api/supervision/annotations?studentId=${user.id}`),
    ])

    if (sessionsRes.ok) {
      const data = await sessionsRes.json()
      if (Array.isArray(data)) setSessions(data.slice(0, 5))
    }
    if (notesRes.ok) {
      const data = await notesRes.json()
      if (Array.isArray(data)) setNotes(data)
    }

    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  const unresolvedNotes = notes.filter(n => !n.is_resolved)
  const initials = supervisor?.full_name
    ?.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase() ?? '?'

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-text-tertiary text-sm font-mono">
      Loading…
    </div>
  )

  if (!supervisor) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
      <div className="h-14 w-14 rounded-2xl bg-bg-surface border border-border-default flex items-center justify-center mb-5">
        <UserCheck className="h-7 w-7 text-text-tertiary" />
      </div>
      <h1 className="text-lg font-semibold text-text-primary mb-2">No supervisor assigned yet</h1>
      <p className="text-sm text-text-secondary max-w-sm">
        Your institution admin will assign a supervisor. Once assigned, you&apos;ll see their profile and session history here.
      </p>
    </div>
  )

  return (
    <div className="px-8 py-6 max-w-3xl mx-auto">

      {/* Supervisor card */}
      <div className="bg-bg-surface border border-border-default rounded-xl p-5 mb-6">
        <div className="flex items-start gap-4">
          <div
            className="w-14 h-14 rounded-full flex-shrink-0 flex items-center justify-center font-mono font-semibold text-white text-xl"
            style={{ background: '#1B3A5C' }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-serif italic font-normal text-text-primary leading-tight">
              {supervisor.full_name ?? 'Your Supervisor'}
            </h1>
            {supervisor.title && (
              <p className="text-sm text-text-secondary mt-0.5">{supervisor.title}</p>
            )}
            <a
              href={`mailto:${supervisor.email}`}
              className="inline-flex items-center gap-1.5 mt-2 text-sm text-accent-blue hover:underline"
            >
              <Mail className="h-3.5 w-3.5" />
              {supervisor.email}
            </a>
          </div>

          {unresolvedNotes.length > 0 && (
            <div className="flex-shrink-0 flex flex-col items-end gap-1">
              <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                {unresolvedNotes.length} unread note{unresolvedNotes.length !== 1 ? 's' : ''}
              </span>
              <Link
                href="/student/milestones"
                className="text-[11px] text-text-tertiary hover:text-text-primary transition-colors"
              >
                view in roadmap →
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Unresolved notes */}
      {unresolvedNotes.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-text-primary mb-2">
            Notes from your supervisor
          </h2>
          <div className="bg-bg-surface border border-border-default rounded-xl divide-y divide-border-subtle overflow-hidden">
            {unresolvedNotes.slice(0, 4).map(note => (
              <div key={note.id} className="flex items-start gap-3 px-4 py-3">
                <MessageSquare className="h-3.5 w-3.5 text-indigo-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-text-secondary capitalize mb-0.5">
                    On {note.artifact_type}
                  </p>
                  <p className="text-sm text-text-primary line-clamp-2">{note.content}</p>
                </div>
                <span className="text-[11px] text-text-tertiary font-mono flex-shrink-0">
                  {new Date(note.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Session history */}
      <div>
        <h2 className="text-sm font-semibold text-text-primary mb-2">
          Supervision sessions
        </h2>

        {sessions.length === 0 ? (
          <div className="bg-bg-surface border border-border-default rounded-xl py-12 text-center">
            <BookOpen className="h-7 w-7 mx-auto mb-2.5 text-text-tertiary opacity-40" />
            <p className="text-sm text-text-secondary font-medium">No sessions recorded yet</p>
            <p className="text-xs text-text-tertiary mt-0.5">
              Session notes will appear here after your supervisor logs them
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map(session => (
              <div
                key={session.id}
                className="bg-bg-surface border border-border-default rounded-xl overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-border-default">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-3.5 w-3.5 text-indigo-400 flex-shrink-0" />
                      <span className="text-sm font-semibold text-text-primary">{session.title}</span>
                    </div>
                    <span className="text-[11px] text-text-tertiary font-mono flex-shrink-0">
                      {new Date(session.created_at).toLocaleDateString('en-GB', {
                        day: 'numeric', month: 'short', year: 'numeric'
                      })}
                    </span>
                  </div>
                </div>

                <div className="px-4 py-3 space-y-3">
                  <p className="text-sm text-text-primary leading-relaxed whitespace-pre-line">
                    {session.summary}
                  </p>

                  {session.action_items?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary mb-1.5">
                        Your action items
                      </p>
                      <ul className="space-y-1">
                        {session.action_items.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-text-primary">
                            <CheckSquare className="h-3.5 w-3.5 text-text-tertiary flex-shrink-0 mt-0.5" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {sessions.length === 5 && (
              <Link
                href="/student/milestones"
                className={cn(
                  'block text-center py-2 text-xs font-medium text-text-secondary',
                  'hover:text-text-primary transition-colors'
                )}
              >
                View all sessions in Milestones →
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
