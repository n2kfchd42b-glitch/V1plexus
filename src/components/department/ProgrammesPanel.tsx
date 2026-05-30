'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  GraduationCap, Plus, Pencil, Archive, ArchiveRestore, Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

type DegreeLevel = 'bachelor' | 'master' | 'phd' | 'postdoc' | 'staff' | 'other'

const DEGREE_OPTIONS: { value: DegreeLevel; label: string }[] = [
  { value: 'bachelor', label: 'Bachelor' },
  { value: 'master',   label: 'Master' },
  { value: 'phd',      label: 'PhD' },
  { value: 'postdoc',  label: 'Postdoc' },
  { value: 'staff',    label: 'Staff' },
  { value: 'other',    label: 'Other' },
]

const DEGREE_TONE: Record<DegreeLevel, string> = {
  bachelor: 'bg-emerald-50 text-emerald-700',
  master:   'bg-blue-50 text-blue-700',
  phd:      'bg-violet-50 text-violet-700',
  postdoc:  'bg-indigo-50 text-indigo-700',
  staff:    'bg-slate-100 text-slate-700',
  other:    'bg-slate-100 text-slate-700',
}

interface Programme {
  id: string
  name: string
  short_code: string | null
  degree_level: DegreeLevel
  duration_months: number | null
  description: string | null
  active: boolean
  enrolled_count: number
  signed_up_count: number
}

type FormState = {
  name: string
  short_code: string
  degree_level: DegreeLevel
  duration_months: string
  description: string
}

const EMPTY_FORM: FormState = {
  name: '',
  short_code: '',
  degree_level: 'master',
  duration_months: '',
  description: '',
}

function ProgrammeModal({
  open, onClose, initial, mode, busy, onSubmit,
}: {
  open: boolean
  onClose: () => void
  initial: FormState
  mode: 'create' | 'edit'
  busy: boolean
  onSubmit: (p: FormState) => void
}) {
  const [form, setForm] = useState<FormState>(initial)

  useEffect(() => { if (open) setForm(initial) }, [open, initial])

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'New programme' : 'Edit programme'}</DialogTitle>
          <DialogDescription>
            Programmes group cohorts and roster entries. Students are enrolled in one programme per dept.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => { e.preventDefault(); if (!form.name.trim()) return; onSubmit(form) }}
          className="space-y-3"
        >
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Name</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="MSc Computer Science"
              className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Short code</label>
              <input
                type="text"
                value={form.short_code}
                onChange={(e) => setForm(f => ({ ...f, short_code: e.target.value }))}
                placeholder="MSc-CS"
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Level</label>
              <select
                value={form.degree_level}
                onChange={(e) => setForm(f => ({ ...f, degree_level: e.target.value as DegreeLevel }))}
                className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200"
              >
                {DEGREE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Duration (months, optional)</label>
            <input
              type="number"
              min={1}
              max={240}
              value={form.duration_months}
              onChange={(e) => setForm(f => ({ ...f, duration_months: e.target.value }))}
              placeholder="24"
              className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Description (optional)</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2}
              className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md resize-none focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200"
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose} className="text-xs font-semibold text-slate-500 px-3 py-1.5 rounded hover:bg-slate-50">Cancel</button>
            <button
              type="submit"
              disabled={busy || !form.name.trim()}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-3 py-1.5 rounded-md"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {mode === 'create' ? 'Create' : 'Save'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function ProgrammesPanel({ deptId }: { deptId: string }) {
  const [programmes, setProgrammes] = useState<Programme[] | null>(null)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Programme | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [submitBusy, setSubmitBusy] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/department/${deptId}/programmes`, { cache: 'no-store' })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      toast.error(body.error ?? 'Could not load programmes')
      return
    }
    const body = await res.json()
    setProgrammes(body.programmes ?? [])
  }, [deptId])

  useEffect(() => { void load() }, [load])

  function formToPayload(f: FormState) {
    return {
      name: f.name.trim(),
      short_code: f.short_code.trim() || undefined,
      degree_level: f.degree_level,
      duration_months: f.duration_months.trim() ? Number(f.duration_months) : null,
      description: f.description.trim() || undefined,
    }
  }

  async function createOne(f: FormState) {
    setSubmitBusy(true)
    const res = await fetch(`/api/department/${deptId}/programmes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(formToPayload(f)),
    })
    setSubmitBusy(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      toast.error(body.error ?? 'Could not create')
      return
    }
    toast.success(`Added "${f.name.trim()}"`)
    setCreating(false)
    void load()
  }

  async function updateOne(p: Programme, f: FormState) {
    setSubmitBusy(true)
    const res = await fetch(`/api/department/${deptId}/programmes/${p.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(formToPayload(f)),
    })
    setSubmitBusy(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      toast.error(body.error ?? 'Could not save')
      return
    }
    toast.success('Programme updated')
    setEditing(null)
    void load()
  }

  async function toggleActive(p: Programme) {
    setBusyId(p.id)
    const res = await fetch(`/api/department/${deptId}/programmes/${p.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ active: !p.active }),
    })
    setBusyId(null)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      toast.error(body.error ?? 'Could not update')
      return
    }
    toast.success(p.active ? 'Archived' : 'Reactivated')
    void load()
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm mb-6">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-slate-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Programmes</h2>
            {programmes !== null && (
              <span className="text-[10px] text-slate-400">· {programmes.filter(p => p.active).length} active</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 hover:text-indigo-800 px-2 py-1 rounded hover:bg-indigo-50"
          >
            <Plus className="h-3.5 w-3.5" /> Add programme
          </button>
        </div>

        {programmes === null ? (
          <p className="text-xs text-slate-400 px-5 py-4">Loading…</p>
        ) : programmes.length === 0 ? (
          <p className="text-xs text-slate-400 px-5 py-6 italic text-center">
            No programmes in this department yet. Add the degree programmes this dept offers.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {programmes.map(p => (
              <li key={p.id} className="flex items-start gap-3 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={cn('text-sm font-semibold truncate', p.active ? 'text-slate-800' : 'text-slate-400 line-through')}>{p.name}</p>
                    {p.short_code && (
                      <span className="text-[10px] font-semibold text-slate-500 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5">{p.short_code}</span>
                    )}
                    <span className={cn('text-[10px] font-semibold uppercase tracking-wide rounded px-1.5 py-0.5', DEGREE_TONE[p.degree_level])}>
                      {p.degree_level}
                    </span>
                    {!p.active && (
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 bg-slate-100 rounded px-1.5 py-0.5">archived</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-1 flex items-center gap-3">
                    <span>{p.signed_up_count}/{p.enrolled_count} signed up</span>
                    {p.duration_months && <span>· {p.duration_months} mo</span>}
                  </div>
                  {p.description && <p className="text-xs text-slate-400 mt-1 truncate">{p.description}</p>}
                </div>
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setEditing(p)}
                    title="Edit"
                    className="rounded p-1 text-slate-400 hover:text-indigo-700 hover:bg-indigo-50"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleActive(p)}
                    disabled={busyId === p.id}
                    title={p.active ? 'Archive' : 'Reactivate'}
                    className="rounded p-1 text-slate-400 hover:text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                  >
                    {busyId === p.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : p.active ? <Archive className="h-3.5 w-3.5" /> : <ArchiveRestore className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ProgrammeModal
        open={creating}
        onClose={() => setCreating(false)}
        initial={EMPTY_FORM}
        mode="create"
        busy={submitBusy}
        onSubmit={createOne}
      />

      <ProgrammeModal
        open={editing !== null}
        onClose={() => setEditing(null)}
        initial={editing ? {
          name: editing.name,
          short_code: editing.short_code ?? '',
          degree_level: editing.degree_level,
          duration_months: editing.duration_months ? String(editing.duration_months) : '',
          description: editing.description ?? '',
        } : EMPTY_FORM}
        mode="edit"
        busy={submitBusy}
        onSubmit={(f) => editing && updateOne(editing, f)}
      />
    </>
  )
}
