'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Inbox, CalendarCheck, Loader2, GraduationCap, Gavel,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { cn, getInitials, formatDate } from '@/lib/utils'

interface ProfileLite {
  id: string
  full_name: string | null
  email: string
  avatar_url: string | null
}

interface IntakeThesis {
  thesis_id: string
  project_id: string
  title: string
  degree_type: string
  submitted_at: string
  student: ProfileLite | null
  supervisor: ProfileLite | null
  programme: { id: string; name: string; short_code: string | null } | null
}

interface ScheduledDefense {
  defense_id: string
  project_id: string
  title: string
  degree_type: string | null
  scheduled_date: string
  scheduled_time: string | null
  location: string | null
  meeting_link: string | null
  notes: string | null
  student: ProfileLite | null
  supervisor: ProfileLite | null
  programme: { id: string; name: string; short_code: string | null } | null
}

type Outcome = 'pass' | 'pass_with_corrections' | 'revise_resubmit' | 'fail'

const DEGREE_TONE: Record<string, string> = {
  bachelor: 'bg-emerald-50 text-emerald-700',
  msc:      'bg-blue-50 text-blue-700',
  mphil:    'bg-violet-50 text-violet-700',
  phd:      'bg-indigo-50 text-indigo-700',
  drph:     'bg-indigo-50 text-indigo-700',
  md:       'bg-indigo-50 text-indigo-700',
  other:    'bg-slate-100 text-slate-700',
}

const OUTCOME_OPTIONS: Array<{ value: Outcome; label: string; tone: string }> = [
  { value: 'pass',                  label: 'Pass',                    tone: 'border-emerald-300 bg-emerald-50 text-emerald-800' },
  { value: 'pass_with_corrections', label: 'Pass with corrections',   tone: 'border-blue-300 bg-blue-50 text-blue-800' },
  { value: 'revise_resubmit',       label: 'Revise & resubmit',       tone: 'border-amber-300 bg-amber-50 text-amber-800' },
  { value: 'fail',                  label: 'Fail',                    tone: 'border-red-300 bg-red-50 text-red-800' },
]

function Avatar({ name, url }: { name: string | null; url: string | null }) {
  return (
    <div className="rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center flex-shrink-0 h-8 w-8 text-xs overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url ? <img src={url} alt="" className="h-8 w-8 object-cover" /> : getInitials(name)}
    </div>
  )
}

function ScheduleModal({
  open, onClose, deptId, thesis, busy, setBusy, onScheduled,
}: {
  open: boolean
  onClose: () => void
  deptId: string
  thesis: IntakeThesis | null
  busy: boolean
  setBusy: (b: boolean) => void
  onScheduled: () => void
}) {
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [location, setLocation] = useState('')
  const [meetingLink, setMeetingLink] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (open) {
      setDate(''); setTime(''); setLocation(''); setMeetingLink(''); setNotes('')
    }
  }, [open])

  if (!thesis) return null

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!thesis || !date) return
    setBusy(true)
    const res = await fetch(`/api/department/${deptId}/intake/${thesis.thesis_id}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        scheduled_date: date,
        scheduled_time: time || undefined,
        location: location || undefined,
        meeting_link: meetingLink || undefined,
        notes: notes || undefined,
      }),
    })
    setBusy(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      toast.error(body.error ?? 'Could not schedule defense')
      return
    }
    toast.success('Defense scheduled')
    onScheduled()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule defense</DialogTitle>
          <DialogDescription>
            <span className="font-semibold text-slate-700">{thesis.title}</span>
            {thesis.student && <> · {thesis.student.full_name ?? thesis.student.email}</>}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Date</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Time (optional)</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Location (optional)</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Senate Hall, Floor 3"
              className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Meeting link (optional)</label>
            <input
              type="url"
              value={meetingLink}
              onChange={(e) => setMeetingLink(e.target.value)}
              placeholder="https://…"
              className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Committee notes, special instructions, etc."
              className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md resize-none focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200"
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose} className="text-xs font-semibold text-slate-500 px-3 py-1.5 rounded hover:bg-slate-50">Cancel</button>
            <button
              type="submit"
              disabled={busy || !date}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-3 py-1.5 rounded-md"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarCheck className="h-3.5 w-3.5" />}
              Schedule
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function OutcomeModal({
  open, onClose, deptId, defense, busy, setBusy, onRecorded,
}: {
  open: boolean
  onClose: () => void
  deptId: string
  defense: ScheduledDefense | null
  busy: boolean
  setBusy: (b: boolean) => void
  onRecorded: () => void
}) {
  const [outcome, setOutcome] = useState<Outcome | ''>('')
  const [correctionsDeadline, setCorrectionsDeadline] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (open) {
      setOutcome(''); setCorrectionsDeadline(''); setNotes('')
    }
  }, [open])

  if (!defense) return null

  const needsDeadline = outcome === 'pass_with_corrections' || outcome === 'revise_resubmit'

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!defense || !outcome) return
    setBusy(true)
    const res = await fetch(`/api/department/${deptId}/defenses/${defense.defense_id}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        outcome,
        corrections_deadline: needsDeadline ? (correctionsDeadline || undefined) : undefined,
        notes: notes || undefined,
      }),
    })
    setBusy(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      toast.error(body.error ?? 'Could not record outcome')
      return
    }
    const body = await res.json() as { lifecycle_state: string }
    toast.success(`Outcome recorded · thesis now ${body.lifecycle_state}`)
    onRecorded()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record defense outcome</DialogTitle>
          <DialogDescription>
            <span className="font-semibold text-slate-700">{defense.title}</span>
            {defense.student && <> · {defense.student.full_name ?? defense.student.email}</>}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Outcome</label>
            <div className="grid grid-cols-2 gap-2">
              {OUTCOME_OPTIONS.map(o => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setOutcome(o.value)}
                  className={cn(
                    'text-xs font-semibold py-2 rounded-md border-2 transition-colors',
                    outcome === o.value
                      ? o.tone
                      : 'border-slate-200 text-slate-500 hover:border-slate-300 bg-white',
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {needsDeadline && (
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Corrections deadline (optional)
              </label>
              <input
                type="date"
                value={correctionsDeadline}
                onChange={(e) => setCorrectionsDeadline(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200"
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Committee remarks, conditions, etc."
              className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md resize-none focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose} className="text-xs font-semibold text-slate-500 px-3 py-1.5 rounded hover:bg-slate-50">Cancel</button>
            <button
              type="submit"
              disabled={busy || !outcome}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-3 py-1.5 rounded-md"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Gavel className="h-3.5 w-3.5" />}
              Record outcome
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function ThesisIntakePanel({ deptId }: { deptId: string }) {
  const [theses, setTheses] = useState<IntakeThesis[] | null>(null)
  const [defenses, setDefenses] = useState<ScheduledDefense[] | null>(null)
  const [scheduling, setScheduling] = useState<IntakeThesis | null>(null)
  const [recording, setRecording] = useState<ScheduledDefense | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const [intakeRes, defRes] = await Promise.all([
      fetch(`/api/department/${deptId}/intake`, { cache: 'no-store' }),
      fetch(`/api/department/${deptId}/defenses`, { cache: 'no-store' }),
    ])
    if (intakeRes.ok) {
      const body = await intakeRes.json()
      setTheses(body.theses ?? [])
    } else {
      const body = await intakeRes.json().catch(() => ({}))
      toast.error(body.error ?? 'Could not load intake')
      setTheses([])
    }
    if (defRes.ok) {
      const body = await defRes.json()
      setDefenses(body.defenses ?? [])
    } else {
      setDefenses([])
    }
  }, [deptId])

  useEffect(() => { void load() }, [load])

  if (theses === null || defenses === null) {
    return (
      <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    )
  }

  const allEmpty = theses.length === 0 && defenses.length === 0

  if (allEmpty) {
    return (
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-12 text-center">
        <div className="w-12 h-12 mx-auto rounded-full bg-slate-50 flex items-center justify-center mb-3">
          <Inbox className="h-6 w-6 text-slate-400" />
        </div>
        <p className="text-sm font-bold text-slate-700">Nothing to action</p>
        <p className="text-xs text-slate-500 mt-1">
          Submitted theses appear here for scheduling, then for recording the defense outcome.
        </p>
      </div>
    )
  }

  return (
    <>
      {/* Awaiting defense */}
      {theses.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden mb-5">
          <div className="flex items-center gap-2 px-5 py-3 bg-slate-50 border-b border-slate-100">
            <Inbox className="h-4 w-4 text-slate-500" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600">
              Awaiting defense · {theses.length}
            </h2>
            <span className="text-[10px] text-slate-500 ml-auto">submitted by supervisor &amp; student, ready for the institution</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {theses.map(t => (
              <li key={t.thesis_id} className="flex items-start gap-3 px-5 py-4">
                {t.student && <Avatar name={t.student.full_name} url={t.student.avatar_url} />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-slate-900 truncate">{t.title}</p>
                    <span className={cn('text-[10px] font-semibold uppercase tracking-wide rounded px-1.5 py-0.5', DEGREE_TONE[t.degree_type] ?? DEGREE_TONE.other)}>
                      {t.degree_type}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {t.student?.full_name ?? t.student?.email ?? '—'}
                    {t.programme && (
                      <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-slate-400">
                        <GraduationCap className="h-2.5 w-2.5" />
                        {t.programme.short_code ?? t.programme.name}
                      </span>
                    )}
                  </p>
                  {t.supervisor && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      Supervised by {t.supervisor.full_name ?? t.supervisor.email}
                    </p>
                  )}
                  <p className="text-[10px] text-slate-400 mt-1">Submitted {formatDate(t.submitted_at)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setScheduling(t)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-2.5 py-1.5 rounded-md flex-shrink-0"
                >
                  <CalendarCheck className="h-3.5 w-3.5" /> Schedule defense
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Scheduled defenses awaiting outcome */}
      {defenses.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden mb-5">
          <div className="flex items-center gap-2 px-5 py-3 bg-indigo-50 border-b border-indigo-100">
            <Gavel className="h-4 w-4 text-indigo-700" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-700">
              Scheduled defenses · {defenses.length}
            </h2>
            <span className="text-[10px] text-indigo-600 ml-auto">record the outcome to close the thesis</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {defenses.map(d => (
              <li key={d.defense_id} className="flex items-start gap-3 px-5 py-4">
                {d.student && <Avatar name={d.student.full_name} url={d.student.avatar_url} />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-slate-900 truncate">{d.title}</p>
                    {d.degree_type && (
                      <span className={cn('text-[10px] font-semibold uppercase tracking-wide rounded px-1.5 py-0.5', DEGREE_TONE[d.degree_type] ?? DEGREE_TONE.other)}>
                        {d.degree_type}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {d.student?.full_name ?? d.student?.email ?? '—'}
                    {d.programme && (
                      <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-slate-400">
                        <GraduationCap className="h-2.5 w-2.5" />
                        {d.programme.short_code ?? d.programme.name}
                      </span>
                    )}
                  </p>
                  {d.supervisor && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      Supervised by {d.supervisor.full_name ?? d.supervisor.email}
                    </p>
                  )}
                  <p className="text-[10px] text-slate-500 mt-1">
                    <CalendarCheck className="inline h-2.5 w-2.5 mr-0.5 align-[-1px]" />
                    {formatDate(d.scheduled_date)}
                    {d.scheduled_time && ` · ${d.scheduled_time.slice(0, 5)}`}
                    {d.location && ` · ${d.location}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRecording(d)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-2.5 py-1.5 rounded-md flex-shrink-0"
                >
                  <Gavel className="h-3.5 w-3.5" /> Record outcome
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ScheduleModal
        open={scheduling !== null}
        onClose={() => setScheduling(null)}
        deptId={deptId}
        thesis={scheduling}
        busy={busy}
        setBusy={setBusy}
        onScheduled={() => { void load() }}
      />

      <OutcomeModal
        open={recording !== null}
        onClose={() => setRecording(null)}
        deptId={deptId}
        defense={recording}
        busy={busy}
        setBusy={setBusy}
        onRecorded={() => { void load() }}
      />
    </>
  )
}
