'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ClipboardList, Plus, CheckCircle2, Clock, Ban, Loader2, X,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { cn, getInitials } from '@/lib/utils'

type EntryStatus = 'unclaimed' | 'claimed' | 'invalidated'

interface RosterEntry {
  id: string
  matriculation_number: string
  programme_id: string | null
  cohort_id: string | null
  intended_role: string
  full_name_hint: string | null
  email_hint: string | null
  status: EntryStatus
  claimed_at: string | null
  created_at: string
  programme: { id: string; name: string; short_code: string | null; degree_level: string } | null
  cohort: { id: string; year: number; label: string | null } | null
  claimed_user: { id: string; full_name: string | null; email: string; avatar_url: string | null } | null
}

interface ProgrammeOption {
  id: string
  name: string
  short_code: string | null
}

const STATUS_TONE: Record<EntryStatus, { tone: string; icon: typeof Clock; label: string }> = {
  unclaimed:   { tone: 'bg-amber-50 text-amber-700 border-amber-200',     icon: Clock,        label: 'unclaimed' },
  claimed:     { tone: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2, label: 'signed up' },
  invalidated: { tone: 'bg-slate-100 text-slate-500 border-slate-200',    icon: Ban,          label: 'invalidated' },
}

function AddEntryModal({
  open, onClose, programmes, busy, onSubmit,
}: {
  open: boolean
  onClose: () => void
  programmes: ProgrammeOption[]
  busy: boolean
  onSubmit: (p: { programme_id: string; matriculation_number: string; full_name_hint: string; email_hint: string }) => void
}) {
  const [programmeId, setProgrammeId] = useState('')
  const [matric, setMatric] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')

  useEffect(() => {
    if (open) {
      setProgrammeId(programmes[0]?.id ?? '')
      setMatric('')
      setName('')
      setEmail('')
    }
  }, [open, programmes])

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add roster seat</DialogTitle>
          <DialogDescription>
            Reserve a matriculation number. When that student claims it on Plexus, they&apos;re auto-enrolled in the programme.
          </DialogDescription>
        </DialogHeader>
        {programmes.length === 0 ? (
          <p className="text-sm text-slate-500 italic">
            You need at least one programme in this department before adding roster seats.
          </p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!programmeId || !matric.trim()) return
              onSubmit({
                programme_id: programmeId,
                matriculation_number: matric.trim(),
                full_name_hint: name.trim(),
                email_hint: email.trim(),
              })
            }}
            className="space-y-3"
          >
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Programme</label>
              <select
                required
                value={programmeId}
                onChange={(e) => setProgrammeId(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200"
              >
                {programmes.map(p => (
                  <option key={p.id} value={p.id}>{p.short_code ? `${p.short_code} — ${p.name}` : p.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Matriculation number</label>
              <input
                type="text"
                required
                value={matric}
                onChange={(e) => setMatric(e.target.value)}
                placeholder="2026-CS-001"
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Name hint (optional)</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ada Lovelace"
                  className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Email hint (optional)</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ada@uni.edu"
                  className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={onClose} className="text-xs font-semibold text-slate-500 px-3 py-1.5 rounded hover:bg-slate-50">Cancel</button>
              <button
                type="submit"
                disabled={busy || !programmeId || !matric.trim()}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-3 py-1.5 rounded-md"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Add seat
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function RosterPanel({ deptId }: { deptId: string }) {
  const [entries, setEntries] = useState<RosterEntry[] | null>(null)
  const [programmes, setProgrammes] = useState<ProgrammeOption[]>([])
  const [statusFilter, setStatusFilter] = useState<EntryStatus | ''>('')
  const [programmeFilter, setProgrammeFilter] = useState<string>('')
  const [adding, setAdding] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [submitBusy, setSubmitBusy] = useState(false)

  const load = useCallback(async () => {
    const qs = new URLSearchParams()
    if (statusFilter) qs.set('status', statusFilter)
    if (programmeFilter) qs.set('programme_id', programmeFilter)
    const [rosterRes, progRes] = await Promise.all([
      fetch(`/api/department/${deptId}/roster?${qs.toString()}`, { cache: 'no-store' }),
      fetch(`/api/department/${deptId}/programmes`, { cache: 'no-store' }),
    ])
    if (!rosterRes.ok) {
      const body = await rosterRes.json().catch(() => ({}))
      toast.error(body.error ?? 'Could not load roster')
      return
    }
    const rosterBody = await rosterRes.json()
    setEntries(rosterBody.entries ?? [])
    if (progRes.ok) {
      const progBody = await progRes.json()
      // Active programmes only for the add dropdown.
      type ProgRow = { id: string; name: string; short_code: string | null; active: boolean }
      setProgrammes((progBody.programmes ?? [])
        .filter((p: ProgRow) => p.active !== false)
        .map((p: ProgRow) => ({ id: p.id, name: p.name, short_code: p.short_code })))
    }
  }, [deptId, statusFilter, programmeFilter])

  useEffect(() => { void load() }, [load])

  async function addEntry(payload: { programme_id: string; matriculation_number: string; full_name_hint: string; email_hint: string }) {
    setSubmitBusy(true)
    const res = await fetch(`/api/department/${deptId}/roster`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        programme_id: payload.programme_id,
        matriculation_number: payload.matriculation_number,
        full_name_hint: payload.full_name_hint || null,
        email_hint: payload.email_hint || null,
        intended_role: 'student',
      }),
    })
    setSubmitBusy(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      toast.error(body.error ?? 'Could not add seat')
      return
    }
    toast.success(`Added ${payload.matriculation_number}`)
    setAdding(false)
    void load()
  }

  async function invalidate(entry: RosterEntry) {
    if (!confirm(`Invalidate seat ${entry.matriculation_number}? It can no longer be claimed.`)) return
    setBusyId(entry.id)
    const res = await fetch(`/api/department/${deptId}/roster/${entry.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'invalidate' }),
    })
    setBusyId(null)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      toast.error(body.error ?? 'Could not invalidate')
      return
    }
    toast.success('Seat invalidated')
    void load()
  }

  const counts = useMemo(() => {
    const c = { unclaimed: 0, claimed: 0, invalidated: 0 }
    for (const e of entries ?? []) c[e.status] += 1
    return c
  }, [entries])

  return (
    <>
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm mb-6">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-slate-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Roster</h2>
            {entries !== null && (
              <span className="text-[10px] text-slate-400">
                · {counts.unclaimed} unclaimed · {counts.claimed} signed up · {counts.invalidated} invalidated
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 hover:text-indigo-800 px-2 py-1 rounded hover:bg-indigo-50"
          >
            <Plus className="h-3.5 w-3.5" /> Add seat
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 px-5 py-2 border-b border-slate-50">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as EntryStatus | '')}
            className="px-2 py-1 text-xs border border-slate-200 rounded bg-white"
          >
            <option value="">All statuses</option>
            <option value="unclaimed">Unclaimed</option>
            <option value="claimed">Signed up</option>
            <option value="invalidated">Invalidated</option>
          </select>
          <select
            value={programmeFilter}
            onChange={(e) => setProgrammeFilter(e.target.value)}
            className="px-2 py-1 text-xs border border-slate-200 rounded bg-white max-w-[200px]"
          >
            <option value="">All programmes</option>
            {programmes.map(p => (
              <option key={p.id} value={p.id}>{p.short_code ?? p.name}</option>
            ))}
          </select>
        </div>

        {entries === null ? (
          <p className="text-xs text-slate-400 px-5 py-4">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="text-xs text-slate-400 px-5 py-6 italic text-center">
            {programmes.length === 0
              ? 'Add a programme first, then you can populate the roster.'
              : 'No roster entries match these filters.'}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {entries.map(e => {
              const meta = STATUS_TONE[e.status]
              const StatusIcon = meta.icon
              return (
                <li key={e.id} className="flex items-center gap-3 px-5 py-3">
                  {e.claimed_user ? (
                    <div className="rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center flex-shrink-0 h-7 w-7 text-[10px] overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {e.claimed_user.avatar_url
                        ? <img src={e.claimed_user.avatar_url} alt="" className="h-7 w-7 object-cover" />
                        : getInitials(e.claimed_user.full_name)}
                    </div>
                  ) : (
                    <div className="h-7 w-7 rounded-full bg-slate-50 border border-dashed border-slate-200 flex items-center justify-center flex-shrink-0">
                      <span className="text-[9px] font-bold text-slate-400">—</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-slate-800 truncate">{e.matriculation_number}</p>
                      {e.programme && (
                        <span className="text-[10px] font-semibold text-slate-500 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5">
                          {e.programme.short_code ?? e.programme.name}
                        </span>
                      )}
                      <span className={cn(
                        'inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide rounded px-1.5 py-0.5 border',
                        meta.tone,
                      )}>
                        <StatusIcon className="h-2.5 w-2.5" /> {meta.label}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      {e.claimed_user
                        ? <>{e.claimed_user.full_name ?? e.claimed_user.email}</>
                        : <>{e.full_name_hint ?? '—'}{e.email_hint && <span className="ml-1 text-slate-400">· {e.email_hint}</span>}</>}
                    </p>
                  </div>
                  {e.status === 'unclaimed' && (
                    <button
                      type="button"
                      onClick={() => invalidate(e)}
                      disabled={busyId === e.id}
                      title="Invalidate"
                      className="text-slate-300 hover:text-red-600 hover:bg-red-50 disabled:opacity-50 rounded p-1 flex-shrink-0"
                    >
                      {busyId === e.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <AddEntryModal
        open={adding}
        onClose={() => setAdding(false)}
        programmes={programmes}
        busy={submitBusy}
        onSubmit={addEntry}
      />
    </>
  )
}
