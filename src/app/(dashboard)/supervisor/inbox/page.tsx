'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { Inbox, CheckCircle2, ExternalLink, Loader2, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface InboxItem {
  id: string
  content: string
  anchor: string
  anchor_label: string | null
  artifact_type: 'dataset' | 'analysis' | 'document'
  artifact_id: string
  project_id: string
  is_resolved: boolean
  created_at: string
  student: {
    id: string
    full_name: string | null
    email: string
  }
}

const ARTIFACT_LABELS: Record<string, string> = {
  dataset:  'Dataset',
  analysis: 'Analysis',
  document: 'Document',
}

const ARTIFACT_COLORS: Record<string, string> = {
  dataset:  'bg-violet-50 text-violet-700 border-violet-100',
  analysis: 'bg-pink-50 text-pink-700 border-pink-100',
  document: 'bg-blue-50 text-blue-700 border-blue-100',
}

function artifactHref(item: InboxItem) {
  const base = `/supervisor/projects/${item.project_id}`
  if (item.artifact_type === 'dataset')  return `${base}/datasets/${item.artifact_id}`
  if (item.artifact_type === 'analysis') return `${base}/analyses/${item.artifact_id}`
  return `${base}/documents/${item.artifact_id}`
}

export default function SupervisorInboxPage() {
  const [items, setItems]       = useState<InboxItem[]>([])
  const [loading, setLoading]   = useState(true)
  const [resolving, setResolving] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const res = await fetch('/api/supervision/inbox')
    if (res.ok) setItems(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleResolve(item: InboxItem) {
    setResolving(item.id)
    try {
      const res = await fetch('/api/supervision/annotations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, is_resolved: true }),
      })
      if (res.ok) setItems(prev => prev.filter(i => i.id !== item.id))
    } finally {
      setResolving(null)
    }
  }

  // Group by student
  const byStudent = items.reduce<Record<string, { student: InboxItem['student']; notes: InboxItem[] }>>(
    (acc, item) => {
      if (!acc[item.student.id]) acc[item.student.id] = { student: item.student, notes: [] }
      acc[item.student.id].notes.push(item)
      return acc
    }, {}
  )

  return (
    <div className="min-h-screen bg-[var(--bg-app)] p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[var(--accent-primary)] flex items-center justify-center">
              <Inbox className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[var(--text-primary)]">Feedback Inbox</h1>
              <p className="text-xs text-[var(--text-secondary)]">
                {loading ? 'Loading…' : `${items.length} unresolved note${items.length !== 1 ? 's' : ''} across your students`}
              </p>
            </div>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* Empty */}
        {!loading && items.length === 0 && (
          <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] px-8 py-16 text-center">
            <CheckCircle2 className="h-10 w-10 text-[var(--status-success)] mx-auto mb-3" />
            <p className="text-sm font-semibold text-[var(--text-primary)]">All caught up</p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">No unresolved notes across your students.</p>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 animate-pulse">
                <div className="h-3 w-32 bg-slate-100 rounded mb-3" />
                <div className="h-4 w-full bg-slate-100 rounded mb-2" />
                <div className="h-4 w-2/3 bg-slate-100 rounded" />
              </div>
            ))}
          </div>
        )}

        {/* Groups */}
        {!loading && Object.values(byStudent).map(({ student, notes }) => (
          <div key={student.id} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] overflow-hidden shadow-sm">
            {/* Student header */}
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[var(--border-default)] bg-slate-50/60">
              <div className="h-7 w-7 rounded-full bg-[var(--accent-primary)] flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0">
                {(student.full_name ?? student.email).charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                  {student.full_name ?? student.email}
                </p>
                <p className="text-[10px] text-[var(--text-secondary)]">{student.email}</p>
              </div>
              <span className="text-[10px] font-bold text-[var(--text-secondary)]">
                {notes.length} open
              </span>
              <Link
                href={`/supervisor/students/${student.id}`}
                className="text-[11px] font-semibold text-[var(--accent-blue)] hover:underline"
              >
                View student
              </Link>
            </div>

            {/* Notes */}
            <div className="divide-y divide-[var(--border-default)]">
              {notes.map(item => (
                <div key={item.id} className="flex items-start gap-4 px-5 py-4 hover:bg-slate-50/40 transition-colors">
                  {/* Artifact type badge */}
                  <span className={cn(
                    'mt-0.5 flex-shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                    ARTIFACT_COLORS[item.artifact_type]
                  )}>
                    {ARTIFACT_LABELS[item.artifact_type]}
                  </span>

                  {/* Content */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-[11px] font-semibold text-[var(--text-secondary)] truncate">
                      {item.anchor_label ?? item.anchor}
                    </p>
                    <p className="text-sm text-[var(--text-primary)] line-clamp-2 leading-relaxed">
                      {item.content}
                    </p>
                    <p className="text-[10px] text-[var(--text-secondary)]">
                      {format(new Date(item.created_at), 'dd MMM yyyy · HH:mm')}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Link
                      href={artifactHref(item)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--accent-blue)] hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Open
                    </Link>
                    <button
                      onClick={() => handleResolve(item)}
                      disabled={resolving === item.id}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:text-emerald-800 disabled:opacity-50 transition-colors"
                    >
                      {resolving === item.id
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <CheckCircle2 className="h-3 w-3" />}
                      Resolve
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
