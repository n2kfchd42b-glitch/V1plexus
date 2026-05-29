'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  Upload, FileSpreadsheet, Loader2, Search, X, Trash2,
  ClipboardList, Plus,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RosterEntryStatus, RosterIntendedRole, InstitutionProgramme, InstitutionCohort, Department } from '@/types/database'
import { RosterUploadDialog } from '@/components/institution/RosterUploadDialog'

interface RosterEntry {
  id: string
  matriculation_number: string
  full_name_hint: string | null
  email_hint: string | null
  intended_role: RosterIntendedRole
  notes: string | null
  status: RosterEntryStatus
  claimed_at: string | null
  created_at: string
  programme: { id: string; name: string; degree_level: string } | null
  cohort: { id: string; year: number; label: string | null } | null
  department: { id: string; name: string } | null
  claimed_user: { id: string; full_name: string | null; email: string } | null
}

const STATUS_TONE: Record<RosterEntryStatus, string> = {
  unclaimed: 'bg-amber-100 text-amber-700',
  claimed: 'bg-emerald-100 text-emerald-700',
  invalidated: 'bg-slate-100 text-slate-500',
}

export default function RosterPage() {
  const [entries, setEntries] = useState<RosterEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<RosterEntryStatus | ''>('')
  const [programmeFilter, setProgrammeFilter] = useState<string>('')
  const [search, setSearch] = useState('')
  const [programmes, setProgrammes] = useState<InstitutionProgramme[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [cohorts, setCohorts] = useState<InstitutionCohort[]>([])
  const [uploading, setUploading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<RosterEntry | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams()
    if (statusFilter) params.set('status', statusFilter)
    if (programmeFilter) params.set('programme_id', programmeFilter)
    if (search.trim()) params.set('search', search.trim())
    const res = await fetch(`/api/institution/roster?${params.toString()}`, { cache: 'no-store' })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? 'Could not load roster')
      setLoading(false)
      return
    }
    const { entries: e, total: t } = await res.json() as { entries: RosterEntry[]; total: number }
    setEntries(e)
    setTotal(t)
    setLoading(false)
  }

  async function loadMeta() {
    const [pRes, dRes, cRes] = await Promise.all([
      fetch('/api/institution/programmes', { cache: 'no-store' }),
      fetch('/api/institution/departments', { cache: 'no-store' }),
      fetch('/api/institution/cohorts', { cache: 'no-store' }),
    ])
    if (pRes.ok) setProgrammes((await pRes.json()).programmes ?? [])
    if (dRes.ok) setDepartments((await dRes.json()).departments ?? [])
    if (cRes.ok) setCohorts((await cRes.json()).cohorts ?? [])
  }

  useEffect(() => { void load() }, [statusFilter, programmeFilter])
  useEffect(() => { void loadMeta() }, [])

  // Debounced search
  useEffect(() => {
    const handle = setTimeout(() => { void load() }, 250)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const counts = useMemo(() => {
    const c = { unclaimed: 0, claimed: 0, invalidated: 0 }
    for (const e of entries) c[e.status]++
    return c
  }, [entries])

  return (
    <div className="px-8 py-8 max-w-6xl mx-auto">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--accent-blue)]/10 flex items-center justify-center flex-shrink-0">
            <ClipboardList className="h-5 w-5 text-[var(--accent-blue)]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)] font-manrope">Roster</h1>
            <p className="text-sm text-[var(--text-secondary)] mt-0.5">
              Pre-loaded matriculation list. Students entering a matching matric number are instantly verified — no manual approval needed.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-default)] hover:border-[var(--accent-blue)]/40 text-[var(--text-secondary)] hover:text-[var(--accent-blue)]"
          >
            <Plus className="h-3.5 w-3.5" />
            Add row
          </button>
          <button
            onClick={() => setUploading(true)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[var(--accent-blue)] text-white hover:bg-[var(--accent-blue-hover)]"
          >
            <Upload className="h-3.5 w-3.5" />
            Upload CSV / Excel
          </button>
        </div>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-tertiary)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search matric, name, email"
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as RosterEntryStatus | '')} className="px-2.5 py-1.5 text-sm bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]">
          <option value="">All ({total})</option>
          <option value="unclaimed">Unclaimed</option>
          <option value="claimed">Claimed</option>
          <option value="invalidated">Invalidated</option>
        </select>
        <select value={programmeFilter} onChange={(e) => setProgrammeFilter(e.target.value)} className="px-2.5 py-1.5 text-sm bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]">
          <option value="">All programmes</option>
          {programmes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="py-10 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-[var(--text-tertiary)]" /></div>
      ) : error ? (
        <div className="py-6 text-center text-sm text-red-600">{error}</div>
      ) : entries.length === 0 ? (
        <div className="bg-[var(--bg-surface)] border border-dashed border-[var(--border-default)] rounded-xl p-10 text-center">
          <FileSpreadsheet className="h-8 w-8 mx-auto text-[var(--text-tertiary)] mb-3" />
          <p className="text-sm font-semibold text-[var(--text-primary)]">No roster entries yet</p>
          <p className="text-xs text-[var(--text-tertiary)] mt-1 max-w-md mx-auto">
            Upload a CSV or Excel file (.csv, .xlsx, .xls) with matric numbers.
            Programmes and cohorts you reference are auto-created &mdash; students typing
            a matching matric on the link page get verified instantly.
          </p>
          <button
            onClick={() => setUploading(true)}
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg bg-[var(--accent-blue)] text-white hover:bg-[var(--accent-blue-hover)]"
          >
            <Upload className="h-4 w-4" />
            Upload roster
          </button>
        </div>
      ) : (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-md overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[var(--border-default)] flex items-center gap-3 text-[11px] text-[var(--text-tertiary)] font-medium">
            <span>Showing {entries.length} of {total}</span>
            <span className="text-amber-700">· {counts.unclaimed} unclaimed</span>
            <span className="text-emerald-700">· {counts.claimed} claimed</span>
            {counts.invalidated > 0 && <span>· {counts.invalidated} invalidated</span>}
          </div>
          <ul className="divide-y divide-[var(--border-default)] max-h-[60vh] overflow-y-auto">
            {entries.map((e) => (
              <li key={e.id} className="px-4 py-2.5 flex items-center gap-3 hover:bg-[var(--bg-surface-hover)]">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-xs font-semibold text-[var(--text-primary)]">{e.matriculation_number}</p>
                    <span className={cn('text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded', STATUS_TONE[e.status])}>
                      {e.status}
                    </span>
                    {e.intended_role !== 'researcher' && (
                      <span className="text-[9px] uppercase text-[var(--text-tertiary)]">{e.intended_role}</span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] truncate mt-0.5">
                    {e.full_name_hint ?? e.email_hint ?? '—'}
                    {e.email_hint && e.full_name_hint && <span className="text-[var(--text-tertiary)]"> · {e.email_hint}</span>}
                  </p>
                  <p className="text-[11px] text-[var(--text-tertiary)] truncate mt-0.5">
                    {[
                      e.programme?.name,
                      e.cohort ? `${e.cohort.year}${e.cohort.label ? ` ${e.cohort.label}` : ''}` : null,
                      e.department?.name,
                    ].filter(Boolean).join(' · ') || 'No programme assigned'}
                  </p>
                  {e.status === 'claimed' && e.claimed_user && (
                    <p className="text-[11px] text-emerald-700 mt-0.5">
                      Claimed by {e.claimed_user.full_name ?? e.claimed_user.email}
                    </p>
                  )}
                </div>
                {e.status !== 'claimed' && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => setEditing(e)} className="text-[var(--text-tertiary)] hover:text-[var(--accent-blue)] p-1" title="Edit">
                      <Search className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm(`Delete roster entry ${e.matriculation_number}?`)) return
                        const res = await fetch(`/api/institution/roster/${e.id}`, { method: 'DELETE' })
                        if (!res.ok) {
                          const body = await res.json().catch(() => ({}))
                          toast.error(body.error ?? 'Could not delete')
                          return
                        }
                        toast.success('Entry removed')
                        await load()
                      }}
                      className="text-[var(--text-tertiary)] hover:text-red-600 p-1"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(creating || editing) && (
        <RosterEntryModal
          entry={editing}
          programmes={programmes}
          cohorts={cohorts}
          departments={departments}
          onClose={() => { setCreating(false); setEditing(null) }}
          onSaved={async () => { setCreating(false); setEditing(null); await load() }}
        />
      )}

      {uploading && (
        <RosterUploadDialog
          onClose={() => setUploading(false)}
          onCommitted={async () => { await load(); await loadMeta() }}
        />
      )}
    </div>
  )
}

// ── Add / edit roster entry modal ──────────────────────────────────────────

function RosterEntryModal({
  entry, programmes, cohorts, departments, onClose, onSaved,
}: {
  entry: RosterEntry | null
  programmes: InstitutionProgramme[]
  cohorts: InstitutionCohort[]
  departments: Department[]
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const isEdit = !!entry
  const [matric, setMatric] = useState(entry?.matriculation_number ?? '')
  const [fullName, setFullName] = useState(entry?.full_name_hint ?? '')
  const [email, setEmail] = useState(entry?.email_hint ?? '')
  const [programmeId, setProgrammeId] = useState(entry?.programme?.id ?? '')
  const [cohortId, setCohortId] = useState(entry?.cohort?.id ?? '')
  const [departmentId, setDepartmentId] = useState(entry?.department?.id ?? '')
  const [role, setRole] = useState<RosterIntendedRole>(entry?.intended_role ?? 'researcher')
  const [notes, setNotes] = useState(entry?.notes ?? '')
  const [submitting, setSubmitting] = useState(false)

  const cohortsForProgramme = useMemo(
    () => cohorts.filter((c) => c.programme_id === programmeId),
    [cohorts, programmeId]
  )

  // Clear cohort if programme changes and the selected cohort doesn't belong
  useEffect(() => {
    if (programmeId && cohortId && !cohortsForProgramme.find((c) => c.id === cohortId)) {
      setCohortId('')
    }
  }, [programmeId, cohortId, cohortsForProgramme])

  async function submit() {
    if (!matric.trim()) { toast.error('Matriculation number is required'); return }
    setSubmitting(true)
    const url = isEdit ? `/api/institution/roster/${entry!.id}` : '/api/institution/roster'
    const method = isEdit ? 'PATCH' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        matriculation_number: matric.trim(),
        full_name_hint: fullName.trim() || null,
        email_hint: email.trim() || null,
        programme_id: programmeId || null,
        cohort_id: cohortId || null,
        department_id: departmentId || null,
        intended_role: role,
        notes: notes.trim() || null,
      }),
    })
    setSubmitting(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      toast.error(body.error ?? 'Could not save')
      return
    }
    toast.success(isEdit ? 'Entry updated' : 'Entry added')
    await onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-[var(--bg-surface)] rounded-xl shadow-xl border border-[var(--border-default)] w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-default)]">
          <h3 className="text-base font-bold text-[var(--text-primary)]">{isEdit ? 'Edit roster entry' : 'Add roster entry'}</h3>
          <button onClick={onClose} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-5 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-medium mb-1">Matriculation number <span className="text-red-500">*</span></label>
            <input autoFocus value={matric} onChange={(e) => setMatric(e.target.value)} placeholder="UG-2024-001" className="w-full px-3 py-2 text-sm bg-[var(--bg-app)] border border-[var(--border-default)] rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] font-mono" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Full name hint</label>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" className="w-full px-3 py-2 text-sm bg-[var(--bg-app)] border border-[var(--border-default)] rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Email hint</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.edu" className="w-full px-3 py-2 text-sm bg-[var(--bg-app)] border border-[var(--border-default)] rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Programme</label>
              <select value={programmeId} onChange={(e) => setProgrammeId(e.target.value)} className="w-full px-3 py-2 text-sm bg-[var(--bg-app)] border border-[var(--border-default)] rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]">
                <option value="">— None —</option>
                {programmes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Cohort</label>
              <select value={cohortId} onChange={(e) => setCohortId(e.target.value)} disabled={!programmeId} className="w-full px-3 py-2 text-sm bg-[var(--bg-app)] border border-[var(--border-default)] rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] disabled:opacity-50">
                <option value="">— None —</option>
                {cohortsForProgramme.map((c) => <option key={c.id} value={c.id}>{c.year}{c.label && ` (${c.label})`}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Department</label>
              <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="w-full px-3 py-2 text-sm bg-[var(--bg-app)] border border-[var(--border-default)] rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]">
                <option value="">— None —</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Role on the workspace</label>
              <select value={role} onChange={(e) => setRole(e.target.value as RosterIntendedRole)} className="w-full px-3 py-2 text-sm bg-[var(--bg-app)] border border-[var(--border-default)] rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]">
                <option value="researcher">Researcher</option>
                <option value="student">Student</option>
                <option value="supervisor">Supervisor</option>
                <option value="coordinator">Coordinator</option>
                <option value="admin">Admin</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full px-3 py-2 text-sm bg-[var(--bg-app)] border border-[var(--border-default)] rounded-md resize-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]" maxLength={2000} />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--border-default)] bg-[var(--bg-surface-2)] rounded-b-xl">
          <button onClick={onClose} className="text-xs font-semibold px-3 py-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)]">Cancel</button>
          <button onClick={submit} disabled={submitting} className="text-xs font-semibold px-3 py-1.5 rounded-md bg-[var(--accent-blue)] text-white hover:bg-[var(--accent-blue-hover)] disabled:opacity-60">{submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Add entry'}</button>
        </div>
      </div>
    </div>
  )
}
