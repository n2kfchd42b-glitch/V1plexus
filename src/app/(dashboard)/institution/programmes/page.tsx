'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { GraduationCap, Plus, Loader2, Users, Layers, ArrowRight, X, Upload } from 'lucide-react'
import type { DegreeLevel, Department } from '@/types/database'
import { RosterUploadDialog } from '@/components/institution/RosterUploadDialog'

interface ProgrammeRow {
  id: string
  name: string
  short_code: string | null
  degree_level: DegreeLevel
  duration_months: number | null
  description: string | null
  active: boolean
  department: { id: string; name: string } | null
  cohort_count: number
  enrolled_count: number
  signed_up_count: number
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

export default function ProgrammesPage() {
  const [programmes, setProgrammes] = useState<ProgrammeRow[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [uploadingRoster, setUploadingRoster] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    const [pRes, dRes] = await Promise.all([
      fetch('/api/institution/programmes', { cache: 'no-store' }),
      fetch('/api/institution/departments', { cache: 'no-store' }).catch(() => null),
    ])
    if (!pRes.ok) {
      const body = await pRes.json().catch(() => ({}))
      setError(body.error ?? 'Could not load programmes')
      setLoading(false)
      return
    }
    const { programmes: p } = await pRes.json() as { programmes: ProgrammeRow[] }
    setProgrammes(p)
    if (dRes && dRes.ok) {
      const { departments: d } = await dRes.json() as { departments: Department[] }
      setDepartments(d ?? [])
    }
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  const grouped = useMemo(() => {
    const order: DegreeLevel[] = ['phd', 'master', 'bachelor', 'postdoc', 'staff', 'other']
    return order
      .map((level) => ({ level, items: programmes.filter((p) => p.degree_level === level) }))
      .filter((g) => g.items.length > 0)
  }, [programmes])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--text-tertiary)]" />
      </div>
    )
  }

  return (
    <div className="px-8 py-8 max-w-5xl mx-auto">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--accent-blue)]/10 flex items-center justify-center flex-shrink-0">
            <GraduationCap className="h-5 w-5 text-[var(--accent-blue)]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)] font-manrope">Programmes</h1>
            <p className="text-sm text-[var(--text-secondary)] mt-0.5">
              Degree programmes your institution offers. Cohorts and enrollments hang off these.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setUploadingRoster(true)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-default)] hover:border-[var(--accent-blue)]/40 text-[var(--text-secondary)] hover:text-[var(--accent-blue)]"
          >
            <Upload className="h-3.5 w-3.5" />
            Upload roster
          </button>
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[var(--accent-blue)] text-white hover:bg-[var(--accent-blue-hover)]"
          >
            <Plus className="h-3.5 w-3.5" />
            New programme
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-4 px-3 py-2 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
      )}

      {programmes.length === 0 ? (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-10 text-center">
          <Layers className="h-8 w-8 mx-auto text-[var(--text-tertiary)] mb-3" />
          <p className="text-sm font-semibold text-[var(--text-primary)]">No programmes yet</p>
          <p className="text-xs text-[var(--text-tertiary)] mt-1 max-w-md mx-auto">
            Programmes group students by degree level and cohort. Either create one by hand, or upload a roster &mdash;
            any programmes and cohorts referenced in the file will be auto-created.
          </p>
          <div className="mt-5 flex items-center justify-center gap-2 flex-wrap">
            <button
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg bg-[var(--accent-blue)] text-white hover:bg-[var(--accent-blue-hover)]"
            >
              <Plus className="h-4 w-4" />
              Create your first programme
            </button>
            <button
              onClick={() => setUploadingRoster(true)}
              className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--accent-blue)]/40 hover:text-[var(--accent-blue)]"
            >
              <Upload className="h-4 w-4" />
              Upload a roster
            </button>
          </div>
          <p className="mt-3 text-[11px] text-[var(--text-tertiary)]">
            A roster upload auto-creates any programmes and cohorts it references.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(({ level, items }) => (
            <section key={level}>
              <h2 className="text-[10px] font-bold tracking-widest text-[var(--text-tertiary)] uppercase mb-2">
                {DEGREE_LABEL[level]}
              </h2>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {items.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/institution/programmes/${p.id}`}
                      className={`group block rounded-xl border bg-[var(--bg-surface)] p-4 transition-colors ${
                        p.active
                          ? 'border-[var(--border-default)] hover:border-[var(--accent-blue)]/40'
                          : 'border-[var(--border-default)] opacity-60 hover:opacity-100'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-[var(--text-primary)] truncate">
                            {p.name}
                            {p.short_code && <span className="ml-1 text-xs font-normal text-[var(--text-tertiary)]">· {p.short_code}</span>}
                          </p>
                          {p.department && (
                            <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5 truncate">{p.department.name}</p>
                          )}
                        </div>
                        <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md flex-shrink-0 ${DEGREE_TONE[level]}`}>
                          {DEGREE_LABEL[level]}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-[var(--text-tertiary)]">
                        <span className="inline-flex items-center gap-1"><Layers className="h-3 w-3" />{p.cohort_count} cohorts</span>
                        <span
                          className="inline-flex items-center gap-1"
                          title={`${p.enrolled_count} on roster, ${p.signed_up_count} signed up to Plexus`}
                        >
                          <Users className="h-3 w-3" />
                          <span className="font-semibold text-[var(--text-secondary)]">{p.enrolled_count}</span>
                          <span>enrolled</span>
                          {p.enrolled_count > 0 && (
                            <span className="text-[10px] text-[var(--text-tertiary)] ml-0.5">
                              · {p.signed_up_count} signed up
                            </span>
                          )}
                        </span>
                        {!p.active && <span className="ml-auto text-[10px] font-semibold uppercase">Inactive</span>}
                        <ArrowRight className="ml-auto h-3.5 w-3.5 text-[var(--text-tertiary)] group-hover:text-[var(--accent-blue)]" />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {creating && (
        <CreateProgrammeModal
          departments={departments}
          onClose={() => setCreating(false)}
          onCreated={async () => { setCreating(false); await load(); toast.success('Programme created') }}
        />
      )}

      {uploadingRoster && (
        <RosterUploadDialog
          onClose={() => setUploadingRoster(false)}
          onCommitted={async () => { await load() }}
        />
      )}
    </div>
  )
}

function CreateProgrammeModal({
  departments, onClose, onCreated,
}: { departments: Department[]; onClose: () => void; onCreated: () => Promise<void> }) {
  const [name, setName] = useState('')
  const [shortCode, setShortCode] = useState('')
  const [degreeLevel, setDegreeLevel] = useState<DegreeLevel>('master')
  const [duration, setDuration] = useState<string>('')
  const [departmentId, setDepartmentId] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit() {
    if (!name.trim()) { toast.error('Name is required'); return }
    setSubmitting(true)
    const res = await fetch('/api/institution/programmes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        short_code: shortCode.trim() || undefined,
        degree_level: degreeLevel,
        duration_months: duration ? Number(duration) : null,
        department_id: departmentId || null,
        description: description.trim() || undefined,
      }),
    })
    setSubmitting(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      toast.error(body.error ?? 'Could not create programme')
      return
    }
    await onCreated()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-[var(--bg-surface)] rounded-xl shadow-xl border border-[var(--border-default)] w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-default)]">
          <h3 className="text-base font-bold text-[var(--text-primary)]">New programme</h3>
          <button onClick={onClose} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">Name <span className="text-red-500">*</span></label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="MSc Computer Science"
              className="w-full px-3 py-2 text-sm bg-[var(--bg-app)] border border-[var(--border-default)] rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">Short code</label>
              <input
                value={shortCode}
                onChange={(e) => setShortCode(e.target.value)}
                placeholder="MSc-CS"
                className="w-full px-3 py-2 text-sm bg-[var(--bg-app)] border border-[var(--border-default)] rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">Degree level <span className="text-red-500">*</span></label>
              <select
                value={degreeLevel}
                onChange={(e) => setDegreeLevel(e.target.value as DegreeLevel)}
                className="w-full px-3 py-2 text-sm bg-[var(--bg-app)] border border-[var(--border-default)] rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
              >
                <option value="bachelor">Bachelor&apos;s</option>
                <option value="master">Master&apos;s</option>
                <option value="phd">PhD</option>
                <option value="postdoc">Postdoc</option>
                <option value="staff">Staff</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">Duration (months)</label>
              <input
                type="number" min={1} max={240}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="24"
                className="w-full px-3 py-2 text-sm bg-[var(--bg-app)] border border-[var(--border-default)] rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">Department</label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[var(--bg-app)] border border-[var(--border-default)] rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
              >
                <option value="">— None —</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[var(--bg-app)] border border-[var(--border-default)] rounded-md resize-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
              maxLength={2000}
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--border-default)] bg-[var(--bg-surface-2)] rounded-b-xl">
          <button
            onClick={onClose}
            className="text-xs font-semibold px-3 py-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >Cancel</button>
          <button
            onClick={submit}
            disabled={submitting}
            className="text-xs font-semibold px-3 py-1.5 rounded-md bg-[var(--accent-blue)] text-white hover:bg-[var(--accent-blue-hover)] disabled:opacity-60"
          >{submitting ? 'Creating…' : 'Create programme'}</button>
        </div>
      </div>
    </div>
  )
}
