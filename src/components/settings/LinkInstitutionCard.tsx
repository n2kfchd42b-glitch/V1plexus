'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Building2, CheckCircle2, Clock, Loader2, Search, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

type LinkState =
  | { kind: 'loading' }
  | { kind: 'unlinked'; pending: PendingRequest | null }
  | { kind: 'linked'; institution: InstitutionSummary }

interface InstitutionSummary {
  id: string
  name: string
  short_name: string | null
  country: string | null
  type: string | null
}

interface PendingRequest {
  id: string
  institution: InstitutionSummary | null
  message: string | null
  created_at: string
}

interface ProvisionedInstitution extends InstitutionSummary {
  auto_link_domains: string[]
}

/**
 * /settings card that lets an individual researcher request to link their
 * account to a registered institution. Once linked, the existing
 * institutional surfaces (workflow v2, thesis policy) appear automatically.
 */
export function LinkInstitutionCard({ userEmail }: { userEmail: string | null }) {
  const [state, setState] = useState<LinkState>({ kind: 'loading' })
  const [picking, setPicking] = useState(false)

  useEffect(() => {
    void refresh()
  }, [])

  async function refresh() {
    setState({ kind: 'loading' })
    const res = await fetch('/api/me/institution-link')
    if (!res.ok) {
      setState({ kind: 'unlinked', pending: null })
      return
    }
    const body = await res.json() as {
      profile: { institution_id: string | null; institution: InstitutionSummary | null } | null
      requests: Array<{
        id: string
        status: string
        message: string | null
        created_at: string
        institution: InstitutionSummary | null
      }>
    }

    if (body.profile?.institution_id && body.profile.institution) {
      setState({ kind: 'linked', institution: body.profile.institution })
      return
    }
    const pending = body.requests.find((r) => r.status === 'pending') ?? null
    setState({
      kind: 'unlinked',
      pending: pending
        ? {
            id: pending.id,
            institution: pending.institution,
            message: pending.message,
            created_at: pending.created_at,
          }
        : null,
    })
  }

  async function cancelPending(id: string) {
    const res = await fetch(`/api/me/institution-link/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      toast.error(body.error ?? 'Could not cancel the request')
      return
    }
    toast.success('Request cancelled')
    await refresh()
  }

  if (state.kind === 'loading') {
    return (
      <section className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-default)] p-5 flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-[var(--text-tertiary)]" />
        <span className="text-sm text-[var(--text-tertiary)]">Loading institution status…</span>
      </section>
    )
  }

  if (state.kind === 'linked') {
    return (
      <section className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-default)] p-5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-[var(--accent-blue)]/10 flex items-center justify-center flex-shrink-0">
            <Building2 className="h-4 w-4 text-[var(--accent-blue)]" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-[var(--text-primary)] font-manrope">Institution</h2>
            <p className="text-sm text-[var(--text-secondary)] mt-0.5 truncate">
              You&apos;re linked to <span className="font-semibold text-[var(--text-primary)]">{state.institution.name}</span>
              {state.institution.country ? ` · ${state.institution.country}` : ''}
            </p>
            <p className="text-xs text-[var(--text-tertiary)] mt-1">
              Your institution&apos;s admins handle membership changes. Contact them to unlink or switch.
            </p>
          </div>
        </div>
      </section>
    )
  }

  if (state.pending) {
    return (
      <section className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-default)] p-5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-[var(--text-primary)] font-manrope">Link request pending</h2>
            <p className="text-sm text-[var(--text-secondary)] mt-0.5 truncate">
              Waiting for an admin at <span className="font-semibold text-[var(--text-primary)]">{state.pending.institution?.name ?? 'your institution'}</span> to review.
            </p>
            <p className="text-xs text-[var(--text-tertiary)] mt-1">
              Submitted {new Date(state.pending.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}.
            </p>
            <button
              onClick={() => cancelPending(state.pending!.id)}
              className="mt-3 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--status-error-text)] underline"
            >
              Cancel request
            </button>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-default)] p-5">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-[var(--accent-blue)]/10 flex items-center justify-center flex-shrink-0">
          <Building2 className="h-4 w-4 text-[var(--accent-blue)]" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold text-[var(--text-primary)] font-manrope">Link to an institution</h2>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            Connect your account to a registered institution to unlock thesis workflows, supervision tools, and shared workspaces.
          </p>
          <p className="text-xs text-[var(--text-tertiary)] mt-1">
            Don&apos;t see yours?{' '}
            <a href="/contact-institutions" className="text-[var(--accent-blue)] hover:underline">Ask them to register</a>.
          </p>
          <button
            onClick={() => setPicking(true)}
            className="mt-3 inline-flex items-center gap-1.5 bg-[var(--accent-blue)] text-white text-sm font-semibold px-3.5 py-1.5 rounded-md hover:bg-[var(--accent-blue-hover)] transition-colors"
          >
            <Search className="h-3.5 w-3.5" />
            Find your institution
          </button>
        </div>
      </div>

      {picking && (
        <InstitutionPicker
          userEmail={userEmail}
          onClose={() => setPicking(false)}
          onSubmitted={async () => {
            setPicking(false)
            await refresh()
          }}
        />
      )}
    </section>
  )
}

function InstitutionPicker({
  userEmail,
  onClose,
  onSubmitted,
}: {
  userEmail: string | null
  onClose: () => void
  onSubmitted: () => Promise<void>
}) {
  const supabase = useMemo(() => createClient(), [])
  const [query, setQuery] = useState('')
  const [institutions, setInstitutions] = useState<ProvisionedInstitution[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [selected, setSelected] = useState<ProvisionedInstitution | null>(null)
  const [message, setMessage] = useState('')
  const [matric, setMatric] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoadingList(true)
      const { data } = await supabase
        .from('institutions')
        .select('id, name, short_name, country, type, auto_link_domains, provisioned_at')
        .not('provisioned_at', 'is', null)
        .order('name', { ascending: true })
        .limit(500)

      if (cancelled) return
      const list = (data ?? []).map((d) => ({
        id: d.id as string,
        name: d.name as string,
        short_name: (d.short_name as string | null) ?? null,
        country: (d.country as string | null) ?? null,
        type: (d.type as string | null) ?? null,
        auto_link_domains: (d.auto_link_domains as string[] | null) ?? [],
      })) as ProvisionedInstitution[]
      setInstitutions(list)
      setLoadingList(false)
    }
    void load()
    return () => { cancelled = true }
  }, [supabase])

  const callerDomain = useMemo(() => {
    const e = (userEmail ?? '').toLowerCase()
    return e.includes('@') ? e.split('@')[1] : ''
  }, [userEmail])

  const willAutoApprove =
    Boolean(selected && callerDomain) &&
    (selected!.auto_link_domains ?? [])
      .map((d) => d.toLowerCase().trim())
      .includes(callerDomain)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return institutions
    return institutions.filter((i) =>
      i.name.toLowerCase().includes(q) ||
      (i.short_name ?? '').toLowerCase().includes(q) ||
      (i.country ?? '').toLowerCase().includes(q),
    )
  }, [institutions, query])

  async function submit() {
    if (!selected) return
    setSubmitting(true)
    const res = await fetch('/api/me/institution-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        institution_id: selected.id,
        message: message.trim() || undefined,
        matriculation_number: matric.trim() || undefined,
      }),
    })
    setSubmitting(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      // 404 from the matric path means "we tried roster verification and the
      // matric didn't match." Surface that clearly so the user can correct
      // it or pick the manual-request path explicitly.
      toast.error(body.error ?? 'Could not submit your request')
      return
    }
    const body = await res.json() as {
      status: 'approved' | 'pending'
      auto_approved: boolean
      verified_via?: 'matriculation'
    }
    if (body.status === 'approved') {
      toast.success(
        body.verified_via === 'matriculation'
          ? `Verified — welcome to ${selected.name}`
          : `Linked to ${selected.name}`
      )
    } else {
      toast.success('Request sent — an admin will review it.')
    }
    await onSubmitted()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-[var(--bg-surface)] rounded-xl shadow-xl border border-[var(--border-default)] w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-default)]">
          <h3 className="text-base font-bold text-[var(--text-primary)]">
            {selected ? 'Confirm link request' : 'Find your institution'}
          </h3>
          <button
            onClick={onClose}
            className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!selected ? (
          <>
            <div className="px-5 py-3 border-b border-[var(--border-default)]">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-tertiary)]" />
                <input
                  autoFocus
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name, short name or country…"
                  className="w-full pl-8 pr-3 py-2 text-sm bg-[var(--bg-app)] border border-[var(--border-default)] rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loadingList ? (
                <div className="flex items-center justify-center py-12 text-sm text-[var(--text-tertiary)] gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading institutions…
                </div>
              ) : filtered.length === 0 ? (
                <div className="px-5 py-12 text-center text-sm text-[var(--text-tertiary)]">
                  No matches. <a href="/contact-institutions" className="text-[var(--accent-blue)] hover:underline">Ask your institution to register</a>.
                </div>
              ) : (
                <ul className="divide-y divide-[var(--border-default)]">
                  {filtered.map((inst) => (
                    <li key={inst.id}>
                      <button
                        onClick={() => setSelected(inst)}
                        className="w-full text-left px-5 py-3 hover:bg-[var(--bg-surface-hover)] transition-colors"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                              {inst.name}
                            </p>
                            <p className="text-xs text-[var(--text-tertiary)] mt-0.5 truncate">
                              {[inst.short_name, inst.country, inst.type?.replace(/_/g, ' ')].filter(Boolean).join(' · ')}
                            </p>
                          </div>
                          {(inst.auto_link_domains ?? []).map((d) => d.toLowerCase()).includes(callerDomain) && (
                            <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 flex-shrink-0">
                              auto-link
                            </span>
                          )}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        ) : (
          <div className="px-5 py-4 space-y-4 flex-1 overflow-y-auto">
            <button
              onClick={() => { setSelected(null); setMessage('') }}
              className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            >
              ← Pick a different institution
            </button>
            <div className="bg-[var(--bg-surface-2)] rounded-lg p-4 border border-[var(--border-default)]">
              <p className="text-sm font-semibold text-[var(--text-primary)]">{selected.name}</p>
              <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                {[selected.short_name, selected.country, selected.type?.replace(/_/g, ' ')].filter(Boolean).join(' · ')}
              </p>
            </div>

            {willAutoApprove ? (
              <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700">
                <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <p className="text-xs">
                  Your email domain <strong>{callerDomain}</strong> is on this institution&apos;s auto-link list. You&apos;ll be linked immediately.
                </p>
              </div>
            ) : (
              <div className="text-xs text-[var(--text-tertiary)] px-3 py-2 rounded-md bg-[var(--bg-surface-2)] border border-[var(--border-default)]">
                An admin or coordinator at {selected.name} will review and approve your request.
                Your in-progress theses keep their current policy snapshot; new theses will pick up the institution&apos;s policy after you&apos;re linked.
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">
                Matriculation number <span className="text-[var(--text-tertiary)] font-normal">(optional, instant verification)</span>
              </label>
              <input
                value={matric}
                onChange={(e) => setMatric(e.target.value)}
                placeholder="e.g. UG-2024-001"
                className="w-full bg-[var(--bg-app)] border border-[var(--border-default)] rounded-md px-2.5 py-1.5 text-sm font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
                maxLength={100}
              />
              <p className="text-[11px] text-[var(--text-tertiary)] mt-1">
                If {selected.name} has pre-loaded a roster, entering your matric number links you instantly with your programme and cohort already set.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">
                Note to the admin <span className="text-[var(--text-tertiary)] font-normal">(optional)</span>
              </label>
              <textarea
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="e.g. PhD student, supervised by Dr. X, starting January 2026"
                className="w-full bg-[var(--bg-app)] border border-[var(--border-default)] rounded-md px-2.5 py-1.5 text-sm resize-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
                maxLength={2000}
              />
            </div>

            <button
              onClick={submit}
              disabled={submitting}
              className={cn(
                'w-full text-white text-sm font-semibold rounded-md py-2 transition-colors',
                'bg-[var(--accent-blue)] hover:bg-[var(--accent-blue-hover)] disabled:opacity-60',
              )}
            >
              {submitting
                ? 'Submitting…'
                : matric.trim()
                  ? 'Verify with matric'
                  : willAutoApprove
                    ? 'Link me now'
                    : 'Send request'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
