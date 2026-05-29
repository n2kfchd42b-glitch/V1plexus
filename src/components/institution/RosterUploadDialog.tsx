'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  Upload, Loader2, X, GraduationCap, Layers, Users, ShieldAlert,
  CheckCircle2, AlertCircle, Ban, FileSpreadsheet, ArrowRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DegreeLevel } from '@/types/database'

interface PreviewProgrammeNew {
  slug: string
  name: string
  short_code: string
  degree_level: DegreeLevel
  department_name: string | null
  source_variants: string[]
}
interface PreviewProgrammeExisting {
  id: string
  name: string
  short_code: string | null
  degree_level: DegreeLevel
}
interface PreviewCohortNew {
  programmeSlug: string
  year: number
  label: string | null
}
interface PreviewSupervisor {
  matric: string
  full_name: string | null
  email: string | null
}
interface CsvOutcome {
  line: number
  matric?: string
  status: 'inserted' | 'skipped' | 'error'
  reason?: string
  warnings?: string[]
}

interface PreviewResponse {
  mode: 'preview'
  summary: {
    total_rows: number
    students: number
    supervisors: number
    will_insert: number
    will_skip: number
    errors: number
  }
  new_programmes: PreviewProgrammeNew[]
  new_cohorts: PreviewCohortNew[]
  existing_programmes: PreviewProgrammeExisting[]
  supervisors: PreviewSupervisor[]
  warnings: string[]
  outcomes: CsvOutcome[]
}

interface CommitResponse {
  mode: 'commit'
  summary: {
    total_rows: number
    inserted: number
    skipped: number
    errors: number
    new_programmes?: number
    new_cohorts?: number
    supervisors?: number
  }
  warnings: string[]
  outcomes: CsvOutcome[]
}

const DEGREE_LABEL: Record<DegreeLevel, string> = {
  bachelor: "Bachelor's",
  master: "Master's",
  phd: 'PhD',
  postdoc: 'Postdoc',
  staff: 'Staff',
  other: 'Other',
}

const DEGREE_TONE: Record<DegreeLevel, string> = {
  bachelor: 'bg-sky-100 text-sky-700',
  master: 'bg-indigo-100 text-indigo-700',
  phd: 'bg-purple-100 text-purple-700',
  postdoc: 'bg-amber-100 text-amber-700',
  staff: 'bg-slate-100 text-slate-700',
  other: 'bg-slate-100 text-slate-500',
}

interface Props {
  onClose: () => void
  /** Fires after a successful commit so callers can refresh their data. */
  onCommitted?: (summary: CommitResponse['summary']) => void | Promise<void>
}

export function RosterUploadDialog({ onClose, onCommitted }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [parsing, setParsing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [csv, setCsv] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [committed, setCommitted] = useState<CommitResponse | null>(null)

  async function handleFile(file: File) {
    const isExcel = /\.(xlsx|xls)$/i.test(file.name)
    if (!isExcel && file.size > 2_000_000) {
      toast.error('CSV is too large (max 2 MB)')
      return
    }
    if (isExcel && file.size > 10_000_000) {
      toast.error('Excel file is too large (max 10 MB)')
      return
    }

    setParsing(true)
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
      setCsv(csvText)
      setFileName(file.name)

      const res = await fetch('/api/institution/roster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: csvText, mode: 'preview' }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast.error(body.error ?? 'Could not parse file')
        setCsv(null); setFileName(null)
        return
      }
      const data = (await res.json()) as PreviewResponse
      setPreview(data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not read file')
      setCsv(null); setFileName(null)
    } finally {
      setParsing(false)
    }
  }

  async function commit() {
    if (!csv) return
    setSubmitting(true)
    const res = await fetch('/api/institution/roster', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv, mode: 'commit' }),
    })
    setSubmitting(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      toast.error(body.error ?? 'Upload failed')
      return
    }
    const data = (await res.json()) as CommitResponse
    setCommitted(data)
    const provisioned = data.summary.new_programmes ?? 0
    toast.success(
      `Roster uploaded: ${data.summary.inserted} added${provisioned > 0 ? `, ${provisioned} new programmes` : ''}`
    )
    await onCommitted?.(data.summary)
  }

  // ── Stage: pre-file ──────────────────────────────────────────────────────

  if (!preview && !parsing) {
    return (
      <Shell title="Upload roster" onClose={onClose}>
        <div className="px-6 py-8">
          <div className="text-center max-w-md mx-auto">
            <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-[var(--accent-blue)]/10 flex items-center justify-center">
              <FileSpreadsheet className="h-6 w-6 text-[var(--accent-blue)]" />
            </div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              Drop a CSV or Excel file
            </p>
            <p className="text-xs text-[var(--text-tertiary)] mt-1">
              Programmes and cohorts referenced in the file will be auto-created.
              You&rsquo;ll see a preview before anything is written.
            </p>
            <button
              onClick={() => fileRef.current?.click()}
              className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg bg-[var(--accent-blue)] text-white hover:bg-[var(--accent-blue-hover)]"
            >
              <Upload className="h-4 w-4" />
              Choose file
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (file) void handleFile(file)
              }}
            />
            <details className="mt-6 text-left">
              <summary className="text-xs font-semibold text-[var(--accent-blue)] cursor-pointer">CSV / Excel format</summary>
              <pre className="mt-2 p-3 bg-[var(--bg-app)] border border-[var(--border-default)] rounded-md text-[10px] font-mono overflow-x-auto whitespace-pre text-left">
{`matriculation_number,full_name,email,programme,cohort_year,cohort_label,department,intended_role
UG-2024-001,Jane Doe,jane@ug.edu,BSc Computer Science,2024,Fall,Engineering,student
UG-2024-002,John Roe,john@ug.edu,BSc Computer Science,2024,Fall,Engineering,student
SUP-001,Dr. Smith,smith@ug.edu,,,,Computer Science,supervisor`}
              </pre>
              <p className="text-[11px] text-[var(--text-tertiary)] mt-2">
                Only <code className="font-mono text-[10px]">matriculation_number</code> is required.
                Unknown programmes are auto-provisioned; unknown departments are flagged as warnings.
              </p>
            </details>
          </div>
        </div>
      </Shell>
    )
  }

  if (parsing) {
    return (
      <Shell title="Upload roster" onClose={onClose}>
        <div className="px-6 py-12 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--text-tertiary)] mx-auto" />
          <p className="text-sm text-[var(--text-secondary)] mt-3">
            Reading <span className="font-mono text-xs">{fileName}</span>&hellip;
          </p>
        </div>
      </Shell>
    )
  }

  // ── Stage: post-commit ───────────────────────────────────────────────────

  if (committed) {
    return (
      <Shell title="Roster uploaded" onClose={onClose}>
        <div className="px-6 py-6 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Added" value={committed.summary.inserted} tone="success" />
            <Stat label="Skipped" value={committed.summary.skipped} tone="warning" />
            <Stat label="Errors" value={committed.summary.errors} tone="error" />
          </div>
          {(committed.summary.new_programmes ?? 0) > 0 && (
            <div className="bg-[var(--bg-surface-2)] border border-[var(--border-default)] rounded-lg px-4 py-3 text-sm text-[var(--text-secondary)]">
              <p className="font-semibold text-[var(--text-primary)]">
                {committed.summary.new_programmes} new programme{committed.summary.new_programmes === 1 ? '' : 's'} provisioned
              </p>
              {(committed.summary.new_cohorts ?? 0) > 0 && (
                <p className="mt-0.5 text-xs">
                  {committed.summary.new_cohorts} new cohort{committed.summary.new_cohorts === 1 ? '' : 's'} created.
                </p>
              )}
            </div>
          )}
          <OutcomeList outcomes={committed.outcomes} />
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="text-xs font-semibold px-4 py-2 rounded-md bg-[var(--accent-blue)] text-white hover:bg-[var(--accent-blue-hover)]"
            >
              Done
            </button>
          </div>
        </div>
      </Shell>
    )
  }

  // ── Stage: preview ───────────────────────────────────────────────────────

  if (!preview) return null
  const sup = preview.summary
  const blockingErrors = sup.errors > 0 && sup.will_insert === 0

  return (
    <Shell title="Review roster" onClose={onClose} subtitle={fileName ?? undefined}>
      <div className="px-6 pt-5 pb-6 space-y-5 max-h-[70vh] overflow-y-auto">
        <div className="grid grid-cols-4 gap-3">
          <Stat label="Students" value={sup.students} />
          <Stat label="Supervisors" value={sup.supervisors} />
          <Stat label="Will skip" value={sup.will_skip} tone="warning" />
          <Stat label="Errors" value={sup.errors} tone={sup.errors > 0 ? 'error' : 'default'} />
        </div>

        {preview.warnings.length > 0 && (
          <section className="bg-amber-50/60 border border-amber-200 rounded-lg px-4 py-3">
            <div className="flex items-center gap-1.5 text-amber-800 text-xs font-bold uppercase tracking-wider mb-1.5">
              <ShieldAlert className="h-3.5 w-3.5" />
              Review before continuing
            </div>
            <ul className="text-xs text-amber-900 space-y-1 list-disc list-inside">
              {preview.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </section>
        )}

        {preview.new_programmes.length > 0 && (
          <section>
            <SectionHeader
              icon={GraduationCap}
              title={`${preview.new_programmes.length} new programme${preview.new_programmes.length === 1 ? '' : 's'} to create`}
              tone="accent"
            />
            <ul className="space-y-2">
              {preview.new_programmes.map((p) => (
                <li
                  key={p.slug}
                  className="bg-[var(--bg-surface-2)] border border-[var(--border-default)] rounded-lg px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[var(--text-primary)]">
                        {p.name}
                        <span className="ml-1.5 text-xs font-mono font-normal text-[var(--text-tertiary)]">{p.short_code}</span>
                      </p>
                      <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
                        slug · <span className="font-mono">{p.slug}</span>
                        {p.department_name && <> · dept <span className="font-mono">{p.department_name}</span></>}
                      </p>
                      {p.source_variants.length > 1 && (
                        <p className="text-[11px] text-amber-700 mt-1">
                          Source variants: {p.source_variants.join(' / ')}
                        </p>
                      )}
                    </div>
                    <span className={cn('text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md flex-shrink-0', DEGREE_TONE[p.degree_level])}>
                      {DEGREE_LABEL[p.degree_level]}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {preview.existing_programmes.length > 0 && (
          <section>
            <SectionHeader
              icon={GraduationCap}
              title={`Linking to ${preview.existing_programmes.length} existing programme${preview.existing_programmes.length === 1 ? '' : 's'}`}
            />
            <ul className="flex flex-wrap gap-1.5">
              {preview.existing_programmes.map((p) => (
                <li
                  key={p.id}
                  className="inline-flex items-center gap-1.5 text-xs bg-[var(--bg-surface-2)] border border-[var(--border-default)] rounded-md px-2 py-1"
                >
                  <span className="font-semibold text-[var(--text-primary)]">{p.name}</span>
                  {p.short_code && <span className="font-mono text-[10px] text-[var(--text-tertiary)]">· {p.short_code}</span>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {preview.new_cohorts.length > 0 && (
          <section>
            <SectionHeader
              icon={Layers}
              title={`${preview.new_cohorts.length} new cohort${preview.new_cohorts.length === 1 ? '' : 's'} to create`}
            />
            <ul className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {preview.new_cohorts.map((c, i) => (
                <li
                  key={`${c.programmeSlug}-${c.year}-${c.label}-${i}`}
                  className="text-xs bg-[var(--bg-surface-2)] border border-[var(--border-default)] rounded-md px-2.5 py-1.5"
                >
                  <span className="font-semibold text-[var(--text-primary)]">{c.year}{c.label && ` · ${c.label}`}</span>
                  <span className="block font-mono text-[10px] text-[var(--text-tertiary)] truncate">{c.programmeSlug}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {preview.supervisors.length > 0 && (
          <section>
            <SectionHeader
              icon={Users}
              title={`${preview.supervisors.length} supervisor${preview.supervisors.length === 1 ? '' : 's'} flagged for pre-assignment`}
            />
            <ul className="bg-[var(--bg-surface-2)] border border-[var(--border-default)] rounded-md divide-y divide-[var(--border-default)] max-h-40 overflow-y-auto">
              {preview.supervisors.map((s, i) => (
                <li key={i} className="px-3 py-1.5 text-xs flex items-center gap-3">
                  <span className="font-mono text-[11px] text-[var(--text-primary)] flex-shrink-0">{s.matric}</span>
                  <span className="text-[var(--text-secondary)] truncate">
                    {s.full_name ?? s.email ?? '—'}
                    {s.email && s.full_name && <span className="text-[var(--text-tertiary)]"> · {s.email}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <OutcomeList outcomes={preview.outcomes} />
      </div>

      <footer className="flex items-center justify-between gap-3 px-6 py-3 border-t border-[var(--border-default)] bg-[var(--bg-surface-2)] rounded-b-xl">
        <p className="text-[11px] text-[var(--text-tertiary)]">
          {blockingErrors
            ? 'No rows can be inserted — fix the errors above and re-upload.'
            : 'Nothing is written until you confirm.'}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="text-xs font-semibold px-3 py-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >Cancel</button>
          <button
            onClick={commit}
            disabled={submitting || blockingErrors || sup.will_insert === 0}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-1.5 rounded-md bg-[var(--accent-blue)] text-white hover:bg-[var(--accent-blue-hover)] disabled:opacity-60"
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
            {submitting ? 'Provisioning…' : `Confirm & insert ${sup.will_insert}`}
          </button>
        </div>
      </footer>
    </Shell>
  )
}

// ── Shared bits ───────────────────────────────────────────────────────────

function Shell({
  title, subtitle, onClose, children,
}: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-[var(--bg-surface)] rounded-xl shadow-xl border border-[var(--border-default)] w-full max-w-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-default)]">
          <div>
            <h3 className="text-base font-bold text-[var(--text-primary)]">{title}</h3>
            {subtitle && <p className="text-xs text-[var(--text-tertiary)] mt-0.5 font-mono">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Stat({
  label, value, tone = 'default',
}: { label: string; value: number; tone?: 'default' | 'success' | 'warning' | 'error' | 'accent' }) {
  const toneCls = {
    default: 'bg-[var(--bg-surface-2)] border-[var(--border-default)] text-[var(--text-primary)]',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    accent: 'bg-[var(--accent-blue-subtle)] border-[var(--accent-blue)]/30 text-[var(--accent-blue)]',
  }[tone]
  return (
    <div className={cn('border rounded-lg px-3 py-2.5', toneCls)}>
      <p className="text-[10px] uppercase tracking-wider font-semibold opacity-80">{label}</p>
      <p className="text-xl font-bold tabular-nums">{value}</p>
    </div>
  )
}

function SectionHeader({
  icon: Icon, title, tone = 'default',
}: { icon: React.ElementType; title: string; tone?: 'default' | 'accent' }) {
  return (
    <h4 className={cn(
      'text-xs font-bold tracking-wide uppercase mb-2 flex items-center gap-1.5',
      tone === 'accent' ? 'text-[var(--accent-blue)]' : 'text-[var(--text-secondary)]'
    )}>
      <Icon className="h-3.5 w-3.5" />
      {title}
    </h4>
  )
}

function OutcomeList({ outcomes }: { outcomes: CsvOutcome[] }) {
  const interesting = outcomes.filter(
    (o) => o.status !== 'inserted' || (o.warnings && o.warnings.length > 0)
  )
  if (interesting.length === 0) return null
  const counts = {
    inserted: outcomes.filter((o) => o.status === 'inserted').length,
    skipped: outcomes.filter((o) => o.status === 'skipped').length,
    errors: outcomes.filter((o) => o.status === 'error').length,
  }
  return (
    <section>
      <h4 className="text-xs font-bold tracking-wide uppercase text-[var(--text-secondary)] mb-2 flex items-center gap-3">
        <span>Per-row outcomes</span>
        <span className="inline-flex items-center gap-1 text-emerald-700 text-[11px]">
          <CheckCircle2 className="h-3 w-3" /> {counts.inserted}
        </span>
        <span className="inline-flex items-center gap-1 text-amber-700 text-[11px]">
          <AlertCircle className="h-3 w-3" /> {counts.skipped}
        </span>
        <span className="inline-flex items-center gap-1 text-red-600 text-[11px]">
          <Ban className="h-3 w-3" /> {counts.errors}
        </span>
      </h4>
      <ul className="max-h-40 overflow-y-auto bg-[var(--bg-surface-2)] border border-[var(--border-default)] rounded-md divide-y divide-[var(--border-default)]">
        {interesting.map((o, i) => (
          <li key={i} className={cn(
            'px-3 py-1.5 text-xs flex items-start gap-3',
            o.status === 'error' ? 'text-red-700' : o.status === 'skipped' ? 'text-amber-700' : 'text-amber-600'
          )}>
            <span className="font-mono text-[10px] w-12 flex-shrink-0 pt-0.5">line {o.line}</span>
            {o.matric && <span className="font-mono text-[11px] flex-shrink-0 pt-0.5">{o.matric}</span>}
            <span className="truncate">
              {o.status !== 'inserted' ? o.reason : o.warnings?.join('; ')}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
