'use client'

import { useEffect, useState, useCallback } from 'react'
import { MessageSquare, CheckCircle2, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import type { Annotation } from './AnnotationThread'

interface Props {
  artifactId: string
  artifactType: 'dataset' | 'analysis' | 'document'
  anchorFilter?: string
  anchorLabel?: string
  variant?: 'panel' | 'inline'
}

function NoteCard({
  a,
  onResolve,
}: {
  a: Annotation
  onResolve: (id: string, resolved: boolean) => void
}) {
  const [resolving, setResolving] = useState(false)

  async function handleResolve() {
    setResolving(true)
    try {
      const res = await fetch('/api/supervision/annotations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: a.id, is_resolved: !a.is_resolved }),
      })
      if (res.ok) onResolve(a.id, !a.is_resolved)
    } finally {
      setResolving(false)
    }
  }

  return (
    <div className={cn(
      'rounded-xl border px-3.5 py-3 text-xs space-y-1.5 transition-opacity',
      a.is_resolved
        ? 'opacity-50 bg-slate-50 border-slate-100'
        : 'bg-white border-indigo-100 shadow-sm'
    )}>
      <div className="flex items-center gap-1.5">
        <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-[9px] font-bold text-indigo-700 flex-shrink-0">
          {(a.supervisor?.full_name ?? 'S').charAt(0).toUpperCase()}
        </div>
        <span className="font-semibold text-slate-700">{a.supervisor?.full_name ?? 'Supervisor'}</span>
        <span className="text-slate-400">{format(new Date(a.created_at), 'dd MMM · HH:mm')}</span>
        {a.is_resolved && (
          <span className="ml-auto flex items-center gap-1 text-[10px] font-bold text-emerald-500">
            <CheckCircle2 className="h-3 w-3" /> Resolved
          </span>
        )}
      </div>
      <p className="text-slate-700 leading-relaxed pl-6">{a.content}</p>

      {/* Student action */}
      {!a.is_resolved && (
        <div className="pl-6 pt-0.5">
          <button
            onClick={handleResolve}
            disabled={resolving}
            className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 hover:text-emerald-800 disabled:opacity-50 transition-colors"
          >
            {resolving
              ? <Loader2 className="h-3 w-3 animate-spin" />
              : <CheckCircle2 className="h-3 w-3" />}
            Mark resolved
          </button>
        </div>
      )}
      {a.is_resolved && (
        <div className="pl-6 pt-0.5">
          <button
            onClick={handleResolve}
            disabled={resolving}
            className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400 hover:text-slate-600 disabled:opacity-50 transition-colors"
          >
            {resolving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            Reopen
          </button>
        </div>
      )}
    </div>
  )
}

interface GroupedNotes {
  anchor: string
  anchorLabel: string | null
  notes: Annotation[]
}

export function StudentSupervisorNotes({
  artifactId,
  artifactType,
  anchorFilter,
  anchorLabel,
  variant = 'panel',
}: Props) {
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [loading, setLoading]         = useState(true)
  const [open, setOpen]               = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(
      `/api/supervision/annotations?artifactId=${artifactId}&artifactType=${artifactType}`
    )
    if (res.ok) {
      const data: Annotation[] = await res.json()
      setAnnotations(data)
      if (data.some(a => !a.is_resolved)) setOpen(true)
    }
    setLoading(false)
  }, [artifactId, artifactType])

  useEffect(() => { load() }, [load])

  const handleResolve = useCallback((id: string, resolved: boolean) => {
    setAnnotations(prev =>
      prev.map(a => a.id === id ? { ...a, is_resolved: resolved } : a)
    )
  }, [])

  const filtered = anchorFilter
    ? annotations.filter(a => a.anchor === anchorFilter)
    : annotations

  const openCount     = filtered.filter(a => !a.is_resolved).length
  const resolvedCount = filtered.filter(a => a.is_resolved).length
  const total         = filtered.length

  if (loading) return null
  if (total === 0) return null

  const groups: GroupedNotes[] = anchorFilter
    ? [{ anchor: anchorFilter, anchorLabel: anchorLabel ?? anchorFilter, notes: filtered }]
    : Object.values(
        filtered.reduce<Record<string, GroupedNotes>>((acc, a) => {
          if (!acc[a.anchor]) {
            acc[a.anchor] = { anchor: a.anchor, anchorLabel: a.anchor_label ?? a.anchor, notes: [] }
          }
          acc[a.anchor].notes.push(a)
          return acc
        }, {})
      )

  if (variant === 'inline') {
    return (
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
      >
        <MessageSquare className="h-3.5 w-3.5" />
        {openCount > 0
          ? `${openCount} supervisor note${openCount !== 1 ? 's' : ''}`
          : `${resolvedCount} resolved note${resolvedCount !== 1 ? 's' : ''}`}
      </button>
    )
  }

  return (
    <div className="rounded-2xl border border-indigo-100 bg-white shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-indigo-50/30 transition-colors"
      >
        <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
          <MessageSquare className="h-4 w-4 text-indigo-500" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-semibold text-slate-800">Supervisor Feedback</p>
          <p className="text-[11px] text-slate-400">
            {openCount > 0 && `${openCount} open`}
            {openCount > 0 && resolvedCount > 0 && ' · '}
            {resolvedCount > 0 && `${resolvedCount} resolved`}
            {` · ${groups.length} section${groups.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        {open
          ? <ChevronUp className="h-4 w-4 text-slate-400 flex-shrink-0" />
          : <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" />}
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-5 border-t border-indigo-50">
          {groups.map(group => (
            <div key={group.anchor} className="pt-4">
              {!anchorFilter && (
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  {group.anchorLabel}
                </p>
              )}
              <div className="space-y-2">
                {group.notes.map(a => (
                  <NoteCard key={a.id} a={a} onResolve={handleResolve} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
