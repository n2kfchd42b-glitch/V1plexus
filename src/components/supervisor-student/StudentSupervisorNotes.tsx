'use client'

import { useEffect, useState } from 'react'
import { MessageSquare, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import type { Annotation } from './AnnotationThread'

interface Props {
  artifactId: string
  artifactType: 'dataset' | 'analysis' | 'document'
  // Optional: scope to a single anchor (e.g. one column or one block)
  anchorFilter?: string
  anchorLabel?: string
  // Compact = inline strip; full = expandable panel
  variant?: 'panel' | 'inline'
}

function NoteCard({ a }: { a: Annotation }) {
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

  useEffect(() => {
    async function load() {
      const res = await fetch(
        `/api/supervision/annotations?artifactId=${artifactId}&artifactType=${artifactType}`
      )
      if (res.ok) {
        const data: Annotation[] = await res.json()
        setAnnotations(data)
        // Auto-open if there are any unresolved notes
        if (data.some(a => !a.is_resolved)) setOpen(true)
      }
      setLoading(false)
    }
    load()
  }, [artifactId, artifactType])

  const filtered = anchorFilter
    ? annotations.filter(a => a.anchor === anchorFilter)
    : annotations

  const openCount     = filtered.filter(a => !a.is_resolved).length
  const resolvedCount = filtered.filter(a => a.is_resolved).length
  const total         = filtered.length

  if (loading) return null
  if (total === 0) return null

  // Group by anchor when showing all notes (no filter)
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
      {/* Header — always visible */}
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

      {/* Expanded notes */}
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
                {group.notes.map(a => <NoteCard key={a.id} a={a} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
