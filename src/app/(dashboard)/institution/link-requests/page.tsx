'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, Loader2, UserPlus, X, GraduationCap } from 'lucide-react'
import { toast } from 'sonner'
import type { InstitutionProgramme, InstitutionCohort, Department } from '@/types/database'

interface LinkRequest {
  id: string
  user_id: string
  institution_id: string
  status: string
  message: string | null
  auto_approved: boolean
  decided_by: string | null
  decided_at: string | null
  decline_reason: string | null
  created_at: string
  user: {
    id: string
    full_name: string | null
    email: string
    avatar_url: string | null
    title: string | null
  } | null
}

type Tab = 'pending' | 'history'

export default function LinkRequestsPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('pending')
  const [requests, setRequests] = useState<LinkRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [acting, setActing] = useState<string | null>(null)
  const [declineFor, setDeclineFor] = useState<LinkRequest | null>(null)
  const [declineReason, setDeclineReason] = useState('')
  const [approveFor, setApproveFor] = useState<LinkRequest | null>(null)
  const [programmes, setProgrammes] = useState<InstitutionProgramme[]>([])
  const [cohorts, setCohorts] = useState<InstitutionCohort[]>([])
  const [departments, setDepartments] = useState<Department[]>([])

  useEffect(() => {
    async function loadMeta() {
      const [pRes, cRes, dRes] = await Promise.all([
        fetch('/api/institution/programmes', { cache: 'no-store' }),
        fetch('/api/institution/cohorts', { cache: 'no-store' }),
        fetch('/api/institution/departments', { cache: 'no-store' }),
      ])
      if (pRes.ok) setProgrammes((await pRes.json()).programmes ?? [])
      if (cRes.ok) setCohorts((await cRes.json()).cohorts ?? [])
      if (dRes.ok) setDepartments((await dRes.json()).departments ?? [])
    }
    void loadMeta()
  }, [])

  useEffect(() => {
    void load(tab)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  async function load(forTab: Tab) {
    setLoading(true)
    setError(null)
    const status = forTab === 'pending' ? 'pending' : 'approved,declined,cancelled'
    const res = await fetch(`/api/institution/link-requests?status=${encodeURIComponent(status)}`)
    if (res.status === 401) {
      router.push('/login')
      return
    }
    if (res.status === 403 || res.status === 404) {
      setError('You don’t have permission to view link requests. Ask your institution admin.')
      setLoading(false)
      return
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? 'Could not load requests')
      setLoading(false)
      return
    }
    const data = await res.json() as { requests: LinkRequest[] }
    setRequests(data.requests ?? [])
    setLoading(false)
  }

  async function approve(req: LinkRequest, assignment: ApprovalAssignment) {
    setActing(req.id)
    const res = await fetch(`/api/institution/link-requests/${req.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve', ...assignment }),
    })
    setActing(null)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      toast.error(body.error ?? 'Could not approve the request')
      return
    }
    toast.success(`Approved ${req.user?.full_name ?? req.user?.email ?? 'user'}`)
    setApproveFor(null)
    router.refresh()
    await load(tab)
  }

  async function decline() {
    if (!declineFor) return
    setActing(declineFor.id)
    const res = await fetch(`/api/institution/link-requests/${declineFor.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'decline', decline_reason: declineReason.trim() || undefined }),
    })
    setActing(null)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      toast.error(body.error ?? 'Could not decline the request')
      return
    }
    toast.success('Request declined')
    setDeclineFor(null)
    setDeclineReason('')
    router.refresh()
    await load(tab)
  }

  return (
    <div className="min-h-screen bg-[var(--bg-app)] px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/institution"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Institution
        </Link>

        <div className="flex items-start gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-[var(--accent-blue)]/10 flex items-center justify-center">
            <UserPlus className="h-5 w-5 text-[var(--accent-blue)]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">Link requests</h1>
            <p className="text-sm text-[var(--text-tertiary)] mt-0.5">
              Individuals who want to join your institution. Approving links their profile and adds them to the institutional workspace.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 mb-4 border-b border-[var(--border-default)]">
          {(['pending', 'history'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-2 text-sm font-medium transition-colors -mb-px border-b-2 ${
                tab === t
                  ? 'text-[var(--accent-blue)] border-[var(--accent-blue)]'
                  : 'text-[var(--text-tertiary)] border-transparent hover:text-[var(--text-primary)]'
              }`}
            >
              {t === 'pending' ? 'Pending' : 'History'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--text-tertiary)]" />
          </div>
        ) : error ? (
          <div className="px-4 py-3 bg-[var(--status-error-bg)] border border-[var(--border-status-error)] rounded-md text-sm text-[var(--status-error-text)]">
            {error}
          </div>
        ) : requests.length === 0 ? (
          <p className="text-sm text-[var(--text-tertiary)] py-12 text-center bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-md">
            {tab === 'pending' ? 'No pending requests.' : 'No history yet.'}
          </p>
        ) : (
          <ul className="space-y-3">
            {requests.map((req) => (
              <li
                key={req.id}
                className="bg-[var(--bg-surface)] rounded-md border border-[var(--border-default)] p-4"
              >
                <div className="flex items-start gap-3">
                  <Avatar user={req.user} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                          {[req.user?.title, req.user?.full_name].filter(Boolean).join(' ') || req.user?.email || 'Unknown user'}
                        </p>
                        <p className="text-xs text-[var(--text-tertiary)] truncate">{req.user?.email ?? ''}</p>
                      </div>
                      <StatusPill status={req.status} autoApproved={req.auto_approved} />
                    </div>
                    {req.message && (
                      <p className="mt-2 text-xs text-[var(--text-secondary)] whitespace-pre-wrap px-3 py-2 bg-[var(--bg-surface-2)] rounded">
                        {req.message}
                      </p>
                    )}
                    {req.status === 'declined' && req.decline_reason && (
                      <p className="mt-2 text-xs text-[var(--text-tertiary)]">
                        <strong>Reason:</strong> {req.decline_reason}
                      </p>
                    )}
                    <p className="mt-2 text-[11px] text-[var(--text-tertiary)]">
                      {req.status === 'pending'
                        ? `Requested ${formatDate(req.created_at)}`
                        : `${capitalize(req.status)} ${formatDate(req.decided_at ?? req.created_at)}`}
                    </p>
                    {req.status === 'pending' && (
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          onClick={() => setApproveFor(req)}
                          disabled={acting === req.id}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-[var(--accent-blue)] hover:bg-[var(--accent-blue-hover)] disabled:opacity-60 text-white text-xs font-semibold transition-colors"
                        >
                          {acting === req.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                          Approve…
                        </button>
                        <button
                          onClick={() => { setDeclineFor(req); setDeclineReason('') }}
                          disabled={acting === req.id}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-[var(--bg-surface-2)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-60 text-[var(--text-secondary)] text-xs font-semibold transition-colors border border-[var(--border-default)]"
                        >
                          <X className="h-3 w-3" />
                          Decline
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {approveFor && (
        <ApprovalModal
          request={approveFor}
          programmes={programmes}
          cohorts={cohorts}
          departments={departments}
          submitting={acting === approveFor.id}
          onClose={() => setApproveFor(null)}
          onSubmit={(assignment) => approve(approveFor, assignment)}
        />
      )}

      {declineFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-[var(--bg-surface)] rounded-xl shadow-xl border border-[var(--border-default)] w-full max-w-md">
            <div className="px-5 py-4 border-b border-[var(--border-default)] flex items-center justify-between">
              <h3 className="text-base font-bold text-[var(--text-primary)]">Decline link request</h3>
              <button onClick={() => setDeclineFor(null)} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-sm text-[var(--text-secondary)]">
                Decline the request from{' '}
                <strong className="text-[var(--text-primary)]">
                  {declineFor.user?.full_name ?? declineFor.user?.email ?? 'this user'}
                </strong>?
              </p>
              <div>
                <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">
                  Reason <span className="text-[var(--text-tertiary)] font-normal">(optional)</span>
                </label>
                <textarea
                  rows={3}
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  placeholder="Visible to the requester."
                  className="w-full bg-[var(--bg-app)] border border-[var(--border-default)] rounded-md px-2.5 py-1.5 text-sm resize-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
                  maxLength={500}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setDeclineFor(null)}
                  className="px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-md"
                >
                  Cancel
                </button>
                <button
                  onClick={decline}
                  disabled={acting === declineFor.id}
                  className="px-3 py-1.5 rounded-md bg-[var(--status-error)] hover:opacity-90 text-white text-xs font-semibold disabled:opacity-60"
                >
                  {acting === declineFor.id ? 'Declining…' : 'Decline request'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface ApprovalAssignment {
  programme_id: string | null
  cohort_id: string | null
  department_id: string | null
  matriculation_number: string | null
}

function ApprovalModal({
  request, programmes, cohorts, departments, submitting, onClose, onSubmit,
}: {
  request: LinkRequest
  programmes: InstitutionProgramme[]
  cohorts: InstitutionCohort[]
  departments: Department[]
  submitting: boolean
  onClose: () => void
  onSubmit: (a: ApprovalAssignment) => void
}) {
  const [programmeId, setProgrammeId] = useState('')
  const [cohortId, setCohortId] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [matric, setMatric] = useState('')

  const cohortsForProgramme = useMemo(
    () => cohorts.filter((c) => c.programme_id === programmeId),
    [cohorts, programmeId]
  )

  useEffect(() => {
    // Clear cohort when programme changes and the previous cohort no longer applies.
    if (programmeId && cohortId && !cohortsForProgramme.find((c) => c.id === cohortId)) {
      setCohortId('')
    }
  }, [programmeId, cohortId, cohortsForProgramme])

  const userLabel = request.user?.full_name ?? request.user?.email ?? 'this user'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-[var(--bg-surface)] rounded-xl shadow-xl border border-[var(--border-default)] w-full max-w-lg">
        <div className="px-5 py-4 border-b border-[var(--border-default)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-[var(--accent-blue)]" />
            <h3 className="text-base font-bold text-[var(--text-primary)]">Approve & assign</h3>
          </div>
          <button onClick={onClose} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-[var(--text-secondary)]">
            Linking <strong className="text-[var(--text-primary)]">{userLabel}</strong>. All assignments are optional &mdash;
            you can leave them blank and assign later from <code className="text-[10px] font-mono bg-[var(--bg-app)] px-1 py-0.5 rounded">/institution/members</code>.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Programme</label>
              <select
                value={programmeId}
                onChange={(e) => setProgrammeId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[var(--bg-app)] border border-[var(--border-default)] rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
              >
                <option value="">— None —</option>
                {programmes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Cohort</label>
              <select
                value={cohortId}
                onChange={(e) => setCohortId(e.target.value)}
                disabled={!programmeId}
                className="w-full px-3 py-2 text-sm bg-[var(--bg-app)] border border-[var(--border-default)] rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] disabled:opacity-50"
              >
                <option value="">— None —</option>
                {cohortsForProgramme.map((c) => <option key={c.id} value={c.id}>{c.year}{c.label && ` (${c.label})`}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Department</label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[var(--bg-app)] border border-[var(--border-default)] rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
              >
                <option value="">— None —</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Matriculation #</label>
              <input
                value={matric}
                onChange={(e) => setMatric(e.target.value)}
                placeholder="e.g. UG-2024-001"
                className="w-full px-3 py-2 text-sm bg-[var(--bg-app)] border border-[var(--border-default)] rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] font-mono"
                maxLength={100}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--border-default)] bg-[var(--bg-surface-2)] rounded-b-xl">
          <button
            onClick={onClose}
            className="text-xs font-semibold px-3 py-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >Cancel</button>
          <button
            onClick={() => onSubmit({
              programme_id: programmeId || null,
              cohort_id: cohortId || null,
              department_id: departmentId || null,
              matriculation_number: matric.trim() || null,
            })}
            disabled={submitting}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-1.5 rounded-md bg-[var(--accent-blue)] text-white hover:bg-[var(--accent-blue-hover)] disabled:opacity-60"
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            {submitting ? 'Approving…' : 'Approve & link'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Avatar({ user }: { user: LinkRequest['user'] }) {
  if (user?.avatar_url) {
    return (
      <img
        src={user.avatar_url}
        alt=""
        className="w-9 h-9 rounded-full object-cover flex-shrink-0 border border-[var(--border-default)]"
      />
    )
  }
  const initials = (user?.full_name ?? user?.email ?? '?')
    .split(/[\s@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('') || '?'
  return (
    <div className="w-9 h-9 rounded-full bg-[var(--bg-surface-2)] flex items-center justify-center text-xs font-semibold text-[var(--text-secondary)] flex-shrink-0">
      {initials}
    </div>
  )
}

function StatusPill({ status, autoApproved }: { status: string; autoApproved: boolean }) {
  const map: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700',
    approved: 'bg-emerald-100 text-emerald-700',
    declined: 'bg-[var(--bg-surface-2)] text-[var(--text-secondary)]',
    cancelled: 'bg-[var(--bg-surface-2)] text-[var(--text-tertiary)]',
  }
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${map[status] ?? 'bg-[var(--bg-surface-2)] text-[var(--text-secondary)]'} flex-shrink-0`}>
      {status === 'approved' && autoApproved ? 'auto-approved' : status}
    </span>
  )
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  } catch { return iso }
}
function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1)
}
