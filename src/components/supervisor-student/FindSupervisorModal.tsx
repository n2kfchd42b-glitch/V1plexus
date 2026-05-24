'use client'

import { useState, useCallback, useEffect } from 'react'
import { X, Search, UserCheck, Loader2, CheckCircle2, Mail, ArrowLeft, Info } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface SupervisorResult {
  id: string
  full_name: string | null
  email: string
  title: string | null
  research_discipline: string | null
  supervision_areas: string[] | null
  supervision_bio: string | null
}

interface Props {
  onClose: () => void
  onRequested: () => void
}

export function FindSupervisorModal({ onClose, onRequested }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SupervisorResult[]>([])
  const [searching, setSearching] = useState(false)
  const [sending, setSending] = useState<string | null>(null)
  const [sent, setSent] = useState<Set<string>>(new Set())

  // Email invite state
  const [emailMode, setEmailMode] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteMessage, setInviteMessage] = useState('')
  const [inviting, setInviting] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  // Whether the student already has a primary supervisor (active or pending).
  // When true, any new request is auto-assigned as co-supervisor server-side.
  const [primaryName, setPrimaryName] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('supervisor_assignments')
        .select('supervisor:profiles!supervisor_id(full_name, email)')
        .eq('student_id', user.id)
        .eq('role', 'primary')
        .in('status', ['pending', 'active'])
        .maybeSingle()
      if (cancelled) return
      const sup = (data?.supervisor ?? null) as { full_name: string | null, email: string | null } | null
      if (sup) setPrimaryName(sup.full_name ?? sup.email ?? 'your main supervisor')
    })()
    return () => { cancelled = true }
  }, [supabase])

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return }
    setSearching(true)
    // Only surface people who opted in. Search by name, email, OR expertise area.
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, title, research_discipline, supervision_areas, supervision_bio')
      .eq('available_to_supervise', true)
      .or(`full_name.ilike.%${q}%,email.ilike.%${q}%,supervision_areas.cs.{${q}}`)
      .limit(8)
    setResults((data as SupervisorResult[]) ?? [])
    setSearching(false)
  }, [supabase])

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    const timeout = setTimeout(() => search(val), 300)
    return () => clearTimeout(timeout)
  }

  const inviteByEmail = async () => {
    if (!inviteEmail.trim()) return
    setInviting(true)
    const res = await fetch('/api/invitations/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'supervisor',
        email: inviteEmail.trim().toLowerCase(),
        role: 'supervisor',
        message: inviteMessage || null,
      }),
    })
    const body = await res.json()
    if (res.ok) {
      setEmailSent(true)
      toast.success('Invitation sent — they\'ll get an email to join Plexus as your supervisor')
    } else {
      toast.error(body.error ?? 'Failed to send invitation')
    }
    setInviting(false)
  }

  const requestSupervision = async (supervisorId: string) => {
    setSending(supervisorId)
    const res = await fetch('/api/supervisor/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ supervisor_id: supervisorId }),
    })
    const body = await res.json()
    if (res.ok) {
      setSent(prev => new Set(prev).add(supervisorId))
      const role = body?.assignedRole as 'primary' | 'co_supervisor' | undefined
      toast.success(
        role === 'co_supervisor'
          ? 'Co-supervisor request sent'
          : 'Supervision request sent'
      )
      onRequested()
    } else {
      toast.error(body.error ?? 'Failed to send request')
    }
    setSending(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-bg-surface rounded-2xl shadow-2xl w-full max-w-md border border-border-default">
        <div className="flex items-center justify-between p-5 border-b border-border-subtle">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent-blue/10 flex items-center justify-center">
              <UserCheck className="h-4 w-4 text-accent-blue" />
            </div>
            <div>
              <h2 className="text-base font-bold text-text-primary">Find a Supervisor</h2>
              <p className="text-xs text-text-tertiary mt-0.5">Search by name or email</p>
            </div>
          </div>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5">
          {emailMode ? (
            /* ── Email invite compose ── */
            emailSent ? (
              <div className="text-center py-6">
                <CheckCircle2 className="h-10 w-10 mx-auto text-status-success mb-3" />
                <p className="text-sm font-semibold text-text-primary mb-1">Invitation sent!</p>
                <p className="text-xs text-text-tertiary max-w-xs mx-auto">
                  {inviteEmail} will receive an email with a link to join Plexus as your supervisor.
                </p>
                <button
                  onClick={onClose}
                  className="mt-5 text-xs font-medium text-accent-blue hover:underline"
                >
                  Close
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <button
                  onClick={() => { setEmailMode(false); setInviteEmail(''); setInviteMessage('') }}
                  className="flex items-center gap-1.5 text-xs text-text-tertiary hover:text-text-primary transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to search
                </button>
                <div>
                  <label className="text-xs font-medium text-text-secondary block mb-1.5">
                    Supervisor&apos;s email
                  </label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    placeholder="dr.mensah@university.edu"
                    autoFocus
                    className="w-full px-3 py-2.5 text-sm border border-border-default rounded-lg bg-bg-surface focus:outline-none focus:ring-2 focus:ring-accent-blue text-text-primary placeholder:text-text-tertiary"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-text-secondary block mb-1.5">
                    Message <span className="text-text-tertiary font-normal">(optional)</span>
                  </label>
                  <textarea
                    value={inviteMessage}
                    onChange={e => setInviteMessage(e.target.value)}
                    placeholder="Introduce yourself and your research topic…"
                    rows={3}
                    className="w-full px-3 py-2.5 text-sm border border-border-default rounded-lg bg-bg-surface focus:outline-none focus:ring-2 focus:ring-accent-blue text-text-primary placeholder:text-text-tertiary resize-none"
                  />
                </div>
                <button
                  onClick={inviteByEmail}
                  disabled={!inviteEmail.trim() || inviting}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-accent-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  {inviting ? 'Sending…' : 'Send invitation'}
                </button>
                <p className="text-[11px] text-text-tertiary text-center">
                  They&apos;ll receive an email explaining Plexus and a link to accept your supervision request.
                </p>
              </div>
            )
          ) : (
            /* ── Search existing users ── */
            <>
              {primaryName && (
                <div className="mb-4 flex items-start gap-2 rounded-lg border border-accent-blue/20 bg-accent-blue/5 p-2.5">
                  <Info className="h-3.5 w-3.5 mt-0.5 text-accent-blue flex-shrink-0" />
                  <p className="text-[11px] leading-relaxed text-text-secondary">
                    <span className="font-semibold text-text-primary">{primaryName}</span> is your main supervisor.
                    Anyone you request next will be added as a <span className="font-semibold">co-supervisor</span>.
                  </p>
                </div>
              )}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
                <input
                  type="text"
                  value={query}
                  onChange={handleQueryChange}
                  placeholder="Dr. Mensah, or mensah@ug.edu.gh"
                  autoFocus
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-border-default rounded-lg bg-bg-surface focus:outline-none focus:ring-2 focus:ring-accent-blue text-text-primary placeholder:text-text-tertiary"
                />
                {searching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary animate-spin" />
                )}
              </div>

              {results.length === 0 && !query.trim() && (
                <div className="text-center py-8 text-text-tertiary">
                  <Search className="h-7 w-7 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Type to search for a supervisor</p>
                </div>
              )}

              {results.length === 0 && query.trim().length > 1 && !searching && (
                <div className="space-y-3">
                  <div className="text-center py-4 text-text-tertiary">
                    <p className="text-sm font-medium text-text-primary">No one found for &quot;{query}&quot;</p>
                    <p className="text-xs mt-1">They may not be on Plexus yet.</p>
                  </div>
                  <button
                    onClick={() => {
                      setEmailMode(true)
                      if (query.includes('@')) setInviteEmail(query)
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-dashed border-accent-blue/40 bg-accent-blue/5 hover:bg-accent-blue/10 transition-colors text-left"
                  >
                    <div className="w-9 h-9 rounded-full bg-accent-blue/10 flex items-center justify-center flex-shrink-0">
                      <Mail className="h-4 w-4 text-accent-blue" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-text-primary">Invite by email</p>
                      <p className="text-xs text-text-tertiary">Send them a link to join Plexus as your supervisor</p>
                    </div>
                  </button>
                </div>
              )}

              {results.length > 0 && (
                <div className="space-y-2">
                  {results.map(person => {
                    const isSent = sent.has(person.id)
                    const isLoading = sending === person.id
                    return (
                      <div
                        key={person.id}
                        className={cn(
                          'flex items-center gap-3 p-3 rounded-lg border transition-colors',
                          isSent
                            ? 'border-status-success/30 bg-status-success/5'
                            : 'border-border-default bg-bg-surface hover:bg-bg-surface-hover'
                        )}
                      >
                        <div
                          className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center font-mono font-semibold text-white text-sm"
                          style={{ background: '#1B3A5C' }}
                        >
                          {(person.full_name ?? person.email).slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-text-primary truncate">
                            {person.full_name ?? person.email}
                          </div>
                          {person.title && (
                            <div className="text-[11px] text-text-tertiary truncate">{person.title}</div>
                          )}
                          {(person.supervision_areas?.length ?? 0) > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {person.supervision_areas!.slice(0, 3).map(a => (
                                <span key={a} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-accent-blue/10 text-accent-blue">
                                  {a}
                                </span>
                              ))}
                              {person.supervision_areas!.length > 3 && (
                                <span className="text-[10px] text-text-tertiary">+{person.supervision_areas!.length - 3}</span>
                              )}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => !isSent && requestSupervision(person.id)}
                          disabled={isSent || isLoading}
                          className={cn(
                            'flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors',
                            isSent
                              ? 'bg-status-success/10 text-status-success cursor-default'
                              : 'bg-accent-primary text-white hover:opacity-90 disabled:opacity-60'
                          )}
                        >
                          {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                          {isSent && <CheckCircle2 className="h-3 w-3" />}
                          {isSent ? 'Requested' : isLoading ? 'Sending…' : 'Request'}
                        </button>
                      </div>
                    )
                  })}

                  {/* Always show invite-by-email option below results too */}
                  <button
                    onClick={() => setEmailMode(true)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-text-tertiary hover:text-text-primary hover:bg-bg-surface-hover transition-colors text-left"
                  >
                    <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                    Not seeing them? Invite by email instead
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
