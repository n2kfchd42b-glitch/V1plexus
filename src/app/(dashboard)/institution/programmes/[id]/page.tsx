'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  ArrowLeft, Loader2, Plus, Layers, Users, GraduationCap,
  Calendar, Power, X, UserMinus,
} from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'
import type { DegreeLevel, EnrollmentStatus } from '@/types/database'

interface Programme {
  id: string
  name: string
  short_code: string | null
  degree_level: DegreeLevel
  duration_months: number | null
  description: string | null
  active: boolean
  department: { id: string; name: string } | null
}

interface Cohort {
  id: string
  year: number
  label: string | null
  start_date: string | null
  expected_completion: string | null
}

interface EnrollmentRow {
  id: string
  user_id: string
  status: EnrollmentStatus
  matriculation_number: string | null
  enrolled_at: string
  user: { id: string; full_name: string | null; email: string; avatar_url: string | null; title: string | null } | null
  cohort: { id: string; year: number; label: string | null } | null
  department: { id: string; name: string } | null
}

interface Detail {
  programme: Programme
  cohorts: Cohort[]
  enrollments: EnrollmentRow[]
}

const DEGREE_LABEL: Record<DegreeLevel, string> = {
  bachelor: "Bachelor's", master: "Master's", phd: 'PhD',
  postdoc: 'Postdoc', staff: 'Staff', other: 'Other',
}

const STATUS_TONE: Record<EnrollmentStatus, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  on_leave: 'bg-amber-100 text-amber-700',
  graduated: 'bg-sky-100 text-sky-700',
  withdrawn: 'bg-slate-100 text-slate-500',
}

export default function ProgrammeDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id as string
  const [data, setData] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creatingCohort, setCreatingCohort] = useState(false)
  const [cohortFilter, setCohortFilter] = useState<string>('')
  const [assigning, setAssigning] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    const res = await fetch(`/api/institution/programmes/${id}`, { cache: 'no-store' })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? 'Could not load programme')
      setLoading(false)
      return
    }
    setData(await res.json())
    setLoading(false)
  }
  useEffect(() => { if (id) void load() }, [id])

  const filteredEnrollments = useMemo(() => {
    if (!data) return []
    if (!cohortFilter) return data.enrollments
    if (cohortFilter === '__nocohort__') return data.enrollments.filter((e) => !e.cohort)
    return data.enrollments.filter((e) => e.cohort?.id === cohortFilter)
  }, [data, cohortFilter])

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-[var(--text-tertiary)]" /></div>
  }
  if (error || !data) {
    return <div className="px-8 py-10 text-center text-sm text-[var(--text-tertiary)]">{error ?? 'Programme not found'}</div>
  }

  async function deactivate() {
    if (!data) return
    if (!confirm(`Deactivate ${data.programme.name}? It will be hidden from the active list but existing enrollments stay intact.`)) return
    const res = await fetch(`/api/institution/programmes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: false }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      toast.error(body.error ?? 'Could not deactivate')
      return
    }
    toast.success('Programme deactivated')
    await load()
  }

  async function withdrawEnrollment(enrollmentId: string, userName: string) {
    if (!confirm(`Withdraw ${userName} from this programme?`)) return
    const res = await fetch(`/api/institution/enrollments/${enrollmentId}`, { method: 'DELETE' })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      toast.error(body.error ?? 'Could not withdraw')
      return
    }
    toast.success(`${userName} withdrawn`)
    await load()
  }

  const active = filteredEnrollments.filter((e) => e.status === 'active')
  const other = filteredEnrollments.filter((e) => e.status !== 'active')

  return (
    <div className="px-8 py-8 max-w-5xl mx-auto">
      <Link href="/institution/programmes" className="inline-flex items-center gap-1 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] mb-4">
        <ArrowLeft className="h-3 w-3" />
        All programmes
      </Link>

      <header className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--accent-blue)]/10 flex items-center justify-center flex-shrink-0">
            <GraduationCap className="h-5 w-5 text-[var(--accent-blue)]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)] font-manrope flex items-center gap-2">
              {data.programme.name}
              {!data.programme.active && (
                <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">Inactive</span>
              )}
            </h1>
            <p className="text-sm text-[var(--text-secondary)] mt-0.5">
              {DEGREE_LABEL[data.programme.degree_level]}
              {data.programme.short_code && <> · {data.programme.short_code}</>}
              {data.programme.duration_months && <> · {data.programme.duration_months} months</>}
              {data.programme.department && <> · {data.programme.department.name}</>}
            </p>
            {data.programme.description && (
              <p className="text-xs text-[var(--text-tertiary)] mt-1 max-w-xl">{data.programme.description}</p>
            )}
          </div>
        </div>
        {data.programme.active && (
          <button
            onClick={deactivate}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-default)] hover:border-amber-400 text-[var(--text-secondary)] hover:text-amber-600"
          >
            <Power className="h-3.5 w-3.5" />
            Deactivate
          </button>
        )}
      </header>

      {/* Cohorts */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Layers className="h-4 w-4 text-[var(--text-tertiary)]" />
            Cohorts <span className="text-xs font-normal text-[var(--text-tertiary)]">({data.cohorts.length})</span>
          </h2>
          <button
            onClick={() => setCreatingCohort(true)}
            className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-md bg-[var(--bg-surface)] border border-[var(--border-default)] hover:border-[var(--accent-blue)]/40 text-[var(--text-secondary)] hover:text-[var(--accent-blue)]"
          >
            <Plus className="h-3 w-3" />
            New cohort
          </button>
        </div>
        {data.cohorts.length === 0 ? (
          <div className="bg-[var(--bg-surface)] border border-dashed border-[var(--border-default)] rounded-xl p-6 text-center">
            <p className="text-xs text-[var(--text-tertiary)]">No cohorts yet. Create one for each yearly intake.</p>
          </div>
        ) : (
          <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {data.cohorts.map((c) => {
              const enrolledInCohort = data.enrollments.filter((e) => e.cohort?.id === c.id && e.status === 'active').length
              return (
                <li key={c.id}>
                  <button
                    onClick={() => setCohortFilter(cohortFilter === c.id ? '' : c.id)}
                    className={cn(
                      'w-full text-left rounded-lg border p-2.5 transition-colors',
                      cohortFilter === c.id
                        ? 'bg-[var(--accent-blue-subtle)] border-[var(--accent-blue)]/40'
                        : 'bg-[var(--bg-surface)] border-[var(--border-default)] hover:border-[var(--accent-blue)]/30'
                    )}
                  >
                    <p className="text-sm font-bold text-[var(--text-primary)]">{c.year}{c.label && <span className="ml-1 text-xs font-normal text-[var(--text-tertiary)]">{c.label}</span>}</p>
                    <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5 flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {enrolledInCohort} enrolled
                    </p>
                    {c.start_date && (
                      <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5 flex items-center gap-1">
                        <Calendar className="h-2.5 w-2.5" />
                        {new Date(c.start_date).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                      </p>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Enrollments */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Users className="h-4 w-4 text-[var(--text-tertiary)]" />
            Enrolled
            <span className="text-xs font-normal text-[var(--text-tertiary)]">({active.length} active{other.length > 0 && `, ${other.length} other`})</span>
            {cohortFilter && (
              <button onClick={() => setCohortFilter('')} className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-[var(--accent-blue-subtle)] text-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/20">
                Cohort filter on · clear
              </button>
            )}
          </h2>
          <button
            onClick={() => setAssigning(true)}
            className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-md bg-[var(--bg-surface)] border border-[var(--border-default)] hover:border-[var(--accent-blue)]/40 text-[var(--text-secondary)] hover:text-[var(--accent-blue)]"
          >
            <Plus className="h-3 w-3" />
            Assign existing member
          </button>
        </div>

        {active.length === 0 && other.length === 0 ? (
          <div className="bg-[var(--bg-surface)] border border-dashed border-[var(--border-default)] rounded-xl p-6 text-center">
            <p className="text-xs text-[var(--text-tertiary)]">
              No one enrolled{cohortFilter ? ' in this cohort' : ''} yet.
              Upload a <Link href="/institution/roster" className="text-[var(--accent-blue)] hover:underline">roster</Link> or assign existing members.
            </p>
          </div>
        ) : (
          <ul className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-md divide-y divide-[var(--border-default)]">
            {[...active, ...other].map((e) => (
              <li key={e.id} className="px-4 py-3 flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-[var(--accent-primary)] flex items-center justify-center text-white text-xs font-bold flex-shrink-0 overflow-hidden">
                  {e.user?.avatar_url
                    ? <img src={e.user.avatar_url} alt="" className="h-8 w-8 object-cover" />
                    : getInitials(e.user?.full_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                    {[e.user?.title, e.user?.full_name].filter(Boolean).join(' ') || e.user?.email || 'Unknown'}
                  </p>
                  <p className="text-xs text-[var(--text-tertiary)] truncate">
                    {e.user?.email}
                    {e.matriculation_number && <span className="ml-2 font-mono text-[10px]">· {e.matriculation_number}</span>}
                  </p>
                </div>
                {e.cohort && (
                  <span className="text-[10px] text-[var(--text-tertiary)] flex-shrink-0">
                    {e.cohort.year}{e.cohort.label && ` ${e.cohort.label}`}
                  </span>
                )}
                <span className={cn('text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md flex-shrink-0', STATUS_TONE[e.status])}>
                  {e.status.replace('_', ' ')}
                </span>
                {e.status === 'active' && (
                  <button
                    onClick={() => withdrawEnrollment(e.id, e.user?.full_name ?? e.user?.email ?? 'user')}
                    className="text-[var(--text-tertiary)] hover:text-red-600"
                    title="Withdraw"
                  >
                    <UserMinus className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {creatingCohort && (
        <CreateCohortModal
          programmeId={id}
          existing={data.cohorts}
          onClose={() => setCreatingCohort(false)}
          onCreated={async () => { setCreatingCohort(false); await load(); toast.success('Cohort created') }}
        />
      )}

      {assigning && (
        <AssignMemberModal
          programmeId={id}
          cohorts={data.cohorts}
          onClose={() => setAssigning(false)}
          onAssigned={async () => { setAssigning(false); await load(); toast.success('Enrollment created') }}
        />
      )}
    </div>
  )
}

// ── Create cohort modal ────────────────────────────────────────────────────

function CreateCohortModal({
  programmeId, existing, onClose, onCreated,
}: { programmeId: string; existing: Cohort[]; onClose: () => void; onCreated: () => Promise<void> }) {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(String(currentYear))
  const [label, setLabel] = useState('')
  const [startDate, setStartDate] = useState('')
  const [expectedCompletion, setExpectedCompletion] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit() {
    const yearN = Number(year)
    if (!Number.isFinite(yearN)) { toast.error('Year must be a number'); return }
    setSubmitting(true)
    const res = await fetch('/api/institution/cohorts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        programme_id: programmeId,
        year: yearN,
        label: label.trim() || null,
        start_date: startDate || null,
        expected_completion: expectedCompletion || null,
      }),
    })
    setSubmitting(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      toast.error(body.error ?? 'Could not create cohort')
      return
    }
    await onCreated()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-[var(--bg-surface)] rounded-xl shadow-xl border border-[var(--border-default)] w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-default)]">
          <h3 className="text-base font-bold text-[var(--text-primary)]">New cohort</h3>
          <button onClick={onClose} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Year <span className="text-red-500">*</span></label>
              <input type="number" min={1900} max={2200} value={year} onChange={(e) => setYear(e.target.value)} className="w-full px-3 py-2 text-sm bg-[var(--bg-app)] border border-[var(--border-default)] rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Label</label>
              <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Fall" className="w-full px-3 py-2 text-sm bg-[var(--bg-app)] border border-[var(--border-default)] rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Start date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full px-3 py-2 text-sm bg-[var(--bg-app)] border border-[var(--border-default)] rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Expected completion</label>
              <input type="date" value={expectedCompletion} onChange={(e) => setExpectedCompletion(e.target.value)} className="w-full px-3 py-2 text-sm bg-[var(--bg-app)] border border-[var(--border-default)] rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]" />
            </div>
          </div>
          {existing.some((c) => c.year === Number(year) && (c.label ?? '') === label.trim()) && (
            <p className="text-xs text-amber-600">A cohort with that year &amp; label already exists.</p>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--border-default)] bg-[var(--bg-surface-2)] rounded-b-xl">
          <button onClick={onClose} className="text-xs font-semibold px-3 py-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)]">Cancel</button>
          <button onClick={submit} disabled={submitting} className="text-xs font-semibold px-3 py-1.5 rounded-md bg-[var(--accent-blue)] text-white hover:bg-[var(--accent-blue-hover)] disabled:opacity-60">{submitting ? 'Creating…' : 'Create cohort'}</button>
        </div>
      </div>
    </div>
  )
}

// ── Assign existing member modal ───────────────────────────────────────────

interface MemberLite { user_id: string; full_name: string | null; email: string; avatar_url: string | null }

function AssignMemberModal({
  programmeId, cohorts, onClose, onAssigned,
}: { programmeId: string; cohorts: Cohort[]; onClose: () => void; onAssigned: () => Promise<void> }) {
  const [members, setMembers] = useState<MemberLite[]>([])
  const [loadingMembers, setLoadingMembers] = useState(true)
  const [query, setQuery] = useState('')
  const [selectedUser, setSelectedUser] = useState<MemberLite | null>(null)
  const [cohortId, setCohortId] = useState('')
  const [matric, setMatric] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await fetch('/api/institution/members?limit=1000', { cache: 'no-store' })
      if (cancelled) return
      if (!res.ok) { setLoadingMembers(false); return }
      const { members: m } = await res.json() as { members: Array<{ user: { id: string; full_name: string | null; email: string; avatar_url: string | null } | null }> }
      setMembers(
        (m ?? [])
          .filter((mem) => mem.user)
          .map((mem) => ({
            user_id: mem.user!.id,
            full_name: mem.user!.full_name,
            email: mem.user!.email,
            avatar_url: mem.user!.avatar_url,
          }))
      )
      setLoadingMembers(false)
    })()
    return () => { cancelled = true }
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return members.slice(0, 50)
    return members.filter((m) =>
      (m.full_name ?? '').toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
    ).slice(0, 50)
  }, [members, query])

  async function submit() {
    if (!selectedUser) return
    setSubmitting(true)
    const res = await fetch('/api/institution/enrollments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: selectedUser.user_id,
        programme_id: programmeId,
        cohort_id: cohortId || null,
        matriculation_number: matric.trim() || null,
      }),
    })
    setSubmitting(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      toast.error(body.error ?? 'Could not enrol')
      return
    }
    await onAssigned()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-[var(--bg-surface)] rounded-xl shadow-xl border border-[var(--border-default)] w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-default)]">
          <h3 className="text-base font-bold text-[var(--text-primary)]">{selectedUser ? 'Confirm enrollment' : 'Assign existing member'}</h3>
          <button onClick={onClose} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"><X className="h-4 w-4" /></button>
        </div>
        {!selectedUser ? (
          <>
            <div className="px-5 py-3 border-b border-[var(--border-default)]">
              <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or email…" className="w-full px-3 py-2 text-sm bg-[var(--bg-app)] border border-[var(--border-default)] rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]" />
            </div>
            <div className="flex-1 overflow-y-auto">
              {loadingMembers ? (
                <div className="flex items-center justify-center py-10 text-sm text-[var(--text-tertiary)] gap-2"><Loader2 className="h-4 w-4 animate-spin" />Loading members…</div>
              ) : filtered.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-[var(--text-tertiary)]">No matches.</div>
              ) : (
                <ul className="divide-y divide-[var(--border-default)]">
                  {filtered.map((m) => (
                    <li key={m.user_id}>
                      <button onClick={() => setSelectedUser(m)} className="w-full text-left px-5 py-3 hover:bg-[var(--bg-surface-hover)] flex items-center gap-3">
                        <div className="h-7 w-7 rounded-full bg-[var(--accent-primary)] flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 overflow-hidden">
                          {m.avatar_url ? <img src={m.avatar_url} alt="" className="h-7 w-7 object-cover" /> : getInitials(m.full_name)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{m.full_name ?? m.email}</p>
                          <p className="text-xs text-[var(--text-tertiary)] truncate">{m.email}</p>
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
            <button onClick={() => setSelectedUser(null)} className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">← Pick a different member</button>
            <div className="bg-[var(--bg-surface-2)] rounded-lg p-3 border border-[var(--border-default)]">
              <p className="text-sm font-semibold text-[var(--text-primary)]">{selectedUser.full_name ?? selectedUser.email}</p>
              <p className="text-xs text-[var(--text-tertiary)]">{selectedUser.email}</p>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Cohort</label>
              <select value={cohortId} onChange={(e) => setCohortId(e.target.value)} className="w-full px-3 py-2 text-sm bg-[var(--bg-app)] border border-[var(--border-default)] rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]">
                <option value="">— No specific cohort —</option>
                {cohorts.map((c) => <option key={c.id} value={c.id}>{c.year}{c.label && ` (${c.label})`}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Matriculation number (optional)</label>
              <input value={matric} onChange={(e) => setMatric(e.target.value)} placeholder="e.g. UG-2024-001" className="w-full px-3 py-2 text-sm bg-[var(--bg-app)] border border-[var(--border-default)] rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]" />
            </div>
            <button onClick={submit} disabled={submitting} className="w-full text-white text-sm font-semibold rounded-md py-2 bg-[var(--accent-blue)] hover:bg-[var(--accent-blue-hover)] disabled:opacity-60">
              {submitting ? 'Enrolling…' : 'Enrol member'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
