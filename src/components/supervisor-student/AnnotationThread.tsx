'use client'

import { useState } from 'react'
import { MessageSquarePlus, CheckCircle2, Trash2, RotateCcw, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

export interface Annotation {
  id: string
  supervisor_id: string
  anchor: string
  anchor_label?: string | null
  content: string
  is_resolved: boolean
  created_at: string
  supervisor?: { id: string; full_name: string | null } | null
}

interface Props {
  annotations: Annotation[]
  anchor: string
  anchorLabel?: string
  // Provided when in supervisor (write) mode — omit for student read-only view
  studentId?: string
  projectId?: string
  artifactType?: 'dataset' | 'analysis' | 'document'
  artifactId?: string
  isSupervisor?: boolean
  onAnnotationAdded?: (a: Annotation) => void
  onAnnotationDeleted?: (id: string) => void
  onAnnotationResolved?: (id: string, resolved: boolean) => void
}

export function AnnotationThread({
  annotations,
  anchor,
  anchorLabel,
  studentId,
  projectId,
  artifactType,
  artifactId,
  isSupervisor = false,
  onAnnotationAdded,
  onAnnotationDeleted,
  onAnnotationResolved,
}: Props) {
  const [composing, setComposing]   = useState(false)
  const [text, setText]             = useState('')
  const [saving, setSaving]         = useState(false)
  const [deleting, setDeleting]     = useState<string | null>(null)

  const forThisAnchor = annotations.filter(a => a.anchor === anchor)

  async function submit() {
    if (!text.trim() || !studentId || !projectId || !artifactType || !artifactId) return
    setSaving(true)
    const res = await fetch('/api/supervision/annotations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id:    studentId,
        project_id:    projectId,
        artifact_type: artifactType,
        artifact_id:   artifactId,
        anchor,
        anchor_label:  anchorLabel ?? anchor,
        content:       text.trim(),
      }),
    })
    if (res.ok) {
      const created: Annotation = await res.json()
      onAnnotationAdded?.(created)
      setText('')
      setComposing(false)
    }
    setSaving(false)
  }

  async function del(id: string) {
    setDeleting(id)
    await fetch(`/api/supervision/annotations/${id}`, { method: 'DELETE' })
    onAnnotationDeleted?.(id)
    setDeleting(null)
  }

  async function toggleResolve(id: string, current: boolean) {
    await fetch(`/api/supervision/annotations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_resolved: !current }),
    })
    onAnnotationResolved?.(id, !current)
  }

  return (
    <div className="space-y-2">
      {forThisAnchor.map(a => (
        <div
          key={a.id}
          className={cn(
            'rounded-xl border px-3.5 py-3 text-xs space-y-1.5 transition-opacity',
            a.is_resolved ? 'opacity-50 bg-slate-50 border-slate-100' : 'bg-white border-slate-200 shadow-sm'
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-[9px] font-bold text-indigo-700 flex-shrink-0">
                {(a.supervisor?.full_name ?? 'S').charAt(0).toUpperCase()}
              </div>
              <span className="font-semibold text-slate-700">{a.supervisor?.full_name ?? 'Supervisor'}</span>
              <span className="text-slate-400">{format(new Date(a.created_at), 'dd MMM · HH:mm')}</span>
            </div>
            {isSupervisor && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => toggleResolve(a.id, a.is_resolved)}
                  className={cn(
                    'h-5 w-5 flex items-center justify-center rounded transition-colors',
                    a.is_resolved
                      ? 'text-slate-400 hover:text-slate-600'
                      : 'text-emerald-500 hover:text-emerald-700'
                  )}
                  title={a.is_resolved ? 'Reopen' : 'Mark resolved'}
                >
                  {a.is_resolved ? <RotateCcw className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                </button>
                <button
                  onClick={() => del(a.id)}
                  disabled={deleting === a.id}
                  className="h-5 w-5 flex items-center justify-center rounded text-slate-300 hover:text-red-500 transition-colors"
                  title="Delete"
                >
                  {deleting === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                </button>
              </div>
            )}
            {a.is_resolved && (
              <span className="text-[10px] font-bold text-emerald-500">Resolved</span>
            )}
          </div>
          <p className="text-slate-700 leading-relaxed pl-6">{a.content}</p>
        </div>
      ))}

      {/* Compose — supervisor only */}
      {isSupervisor && !composing && (
        <button
          onClick={() => setComposing(true)}
          className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-500 hover:text-indigo-700 transition-colors py-1"
        >
          <MessageSquarePlus className="h-3.5 w-3.5" />
          Add feedback on {anchorLabel ?? anchor}
        </button>
      )}

      {isSupervisor && composing && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-3 space-y-2">
          <textarea
            autoFocus
            value={text}
            onChange={e => setText(e.target.value)}
            rows={3}
            placeholder={`Feedback on "${anchorLabel ?? anchor}"…`}
            className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setComposing(false); setText('') }}
              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              <X className="h-3 w-3" /> Cancel
            </button>
            <button
              onClick={submit}
              disabled={saving || !text.trim()}
              className="px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Post feedback'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
