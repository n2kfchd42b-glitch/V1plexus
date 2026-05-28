'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Upload, FileSpreadsheet, Loader2, Search, X, Trash2, Ban,
  CheckCircle2, AlertCircle, ClipboardList, Plus,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RosterEntryStatus, RosterIntendedRole, InstitutionProgramme, InstitutionCohort, Department } from '@/types/database'

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

interface CsvOutcome {
  line: number
  matric?: string
  status: 'inserted' | 'skipped' | 'error'
  reason?: string
  warnings?: string[]
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
  const [uploadResult, setUploadResult] = useState<{ inserted: number; skipped: number; errors: number; outcomes: CsvOutcome[] } | null>(null)
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
          <CsvUploadButton
            disabled={uploading}
            onUpload={async (csv) => {
              setUploading(true)
              setUploadResult(null)
              const res = await fetch('/api/institution/roster', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ csv }),
              })
              setUploading(false)
              if (!res.ok) {
                const body = await res.json().catch(() => ({}))
                toast.error(body.error ?? 'Upload failed')
                return
              }
              const { summary, outcomes } = await res.json() as { summary: { inserted: number; skipped: number; errors: number }; outcomes: CsvOutcome[] }
              setUploadResult({ ...summary, outcomes })
              toast.success(`Uploaded: ${summary.inserted} inserted, ${summary.skipped} skipped, ${summary.errors} errors`)
              await load()
            }}
          />
        </div>
      </header>

      {uploadResult && (
        <div className="mb-6 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border-default)] flex items-center justify-between">
            <div className="flex items-center gap-3 text-sm">
              <span className="inline-flex items-center gap-1 text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" /> <strong>{uploadResult.inserted}</strong> inserted
              </span>
              <span className="inline-flex items-center gap-1 text-amber-700">
                <AlertCircle className="h-3.5 w-3.5" /> <strong>{uploadResult.skipped}</strong> skipped
              </span>
              <span className="inline-flex items-center gap-1 text-red-600">
                <Ban className="h-3.5 w-3.5" /> <strong>{uploadResult.errors}</strong> errors
              </span>
            </div>
            <button onClick={() => setUploadResult(null)} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"><X className="h-4 w-4" /></button>
          </div>
          {uploadResult.outcomes.some((o) => o.status !== 'inserted' || (o.warnings && o.warnings.length > 0)) && (
            <ul className="max-h-48 overflow-y-auto divide-y divide-[var(--border-default)]">
              {uploadResult.outcomes
                .filter((o) => o.status !== 'inserted' || (o.warnings && o.warnings.length > 0))
                .map((o, i) => (
                  <li key={i} className={cn(
                    'px-4 py-1.5 text-xs flex items-start gap-3',
                    o.status === 'error' ? 'text-red-700 bg-red-50/30' : o.status === 'skipped' ? 'text-amber-700 bg-amber-50/30' : 'text-amber-600 bg-amber-50/20'
                  )}>
                    <span className="font-mono text-[10px] w-12 flex-shrink-0 pt-0.5">line {o.line}</span>
                    {o.matric && <span className="font-mono text-[11px] flex-shrink-0 pt-0.5">{o.matric}</span>}
                    <span className="truncate">
                      {o.status !== 'inserted' ? o.reason : o.warnings?.join('; ')}
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}

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
            Upload a CSV or Excel file (.csv, .xlsx, .xls) with matric numbers (and optionally programme, cohort, department).
            Students typing one of these matric numbers on the link page get verified instantly.
          </p>
          <details className="mt-4 text-left max-w-md mx-auto">
            <summary className="text-xs font-semibold text-[var(--accent-blue)] cursor-pointer">CSV / Excel format</summary>
            <pre className="mt-2 p-3 bg-[var(--bg-app)] border border-[var(--border-default)] rounded-md text-[10px] font-mono overflow-x-auto whitespace-pre">
{`matriculation_number,full_name,email,programme,cohort_year,cohort_label,department,intended_role
UG-2024-001,Jane Doe,jane@ug.edu,MSc Computer Science,2024,Fall,Engineering,student
UG-2024-002,John Roe,john@ug.edu,MSc Computer Science,2024,Fall,Engineering,student
SUP-001,Dr. Smith,smith@ug.edu,,,,Computer Science,supervisor`}
            </pre>
            <p className="text-[11px] text-[var(--text-tertiary)] mt-2">
              Only <code>matriculation_number</code> is required. Other columns are looked up by name (case-insensitive); rows referencing unknown programmes/departments are reported as errors and not inserted.
            </p>
          </details>
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
    </div>
  )
}

// ── CSV upload button ──────────────────────────────────────────────────────

function CsvUploadButton({ onUpload, disabled }: { onUpload: (csv: string) => Promise<void>; disabled?: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null)
  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0]
          if (!file) return
          e.target.value = ''

          const isExcel = /\.(xlsx|xls)$/i.test(file.name)

          if (!isExcel && file.size > 2_000_000) {
            toast.error('CSV is too large (max 2 MB)')
            return
          }
          if (isExcel && file.size > 10_000_000) {
            toast.error('Excel file is too large (max 10 MB)')
            return
          }

          try {
            let csvText: string
            if (isExcel) {
              const XLSX = await import('xlsx')
              const buffer = await file.arrayBuffer()
              const workbook = XLSX.read(buffer, { type: 'array' })
              const sheetName = workbook.SheetNames[0]
              if (!sheetName) throw new Error('Workbook has no sheets')
              const sheet = workbook.Sheets[sheetName]
              csvText = XLSX.utils.sheet_to_csv(sheet)
            } else {
              csvText = await file.text()
            }
            await onUpload(csvText)
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Could not read file')
          }
        }}
      />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[var(--accent-blue)] text-white hover:bg-[var(--accent-blue-hover)] disabled:opacity-60"
      >
        {disabled ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
        {disabled ? 'Uploading…' : 'Upload CSV / Excel'}
      </button>
    </>
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
