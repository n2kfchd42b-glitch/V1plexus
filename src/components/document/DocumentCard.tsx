"use client"

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Trash2, AlertTriangle, Loader2, X, Check, MoreVertical,
} from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { logAudit } from '@/lib/audit'
import { cn } from '@/lib/utils'
import type { Document } from '@/lib/types/database'

// ── Label maps ────────────────────────────────────────────────────────────────

const DOC_TYPE_LABELS: Record<string, string> = {
  protocol: 'Protocol',
  manuscript: 'Manuscript',
  thesis_chapter: 'Thesis Chapter',
  ethics_application: 'Ethics Application',
  analysis_plan: 'Analysis Plan',
  general: 'General',
  abstract: 'Abstract',
  introduction: 'Introduction',
  literature_review: 'Literature Review',
  methodology: 'Methodology',
  results: 'Results',
  discussion: 'Discussion',
  conclusion: 'Conclusion',
}

const DOC_TYPE_COLORS: Record<string, string> = {
  protocol:           'bg-blue-50 text-blue-700',
  manuscript:         'bg-purple-50 text-purple-700',
  thesis_chapter:     'bg-indigo-50 text-indigo-700',
  ethics_application: 'bg-slate-100 text-slate-600',
  analysis_plan:      'bg-teal-50 text-teal-700',
  general:            'bg-gray-100 text-gray-500',
  abstract:           'bg-sky-50 text-sky-700',
  introduction:       'bg-violet-50 text-violet-700',
  literature_review:  'bg-fuchsia-50 text-fuchsia-700',
  methodology:        'bg-cyan-50 text-cyan-700',
  results:            'bg-emerald-50 text-emerald-700',
  discussion:         'bg-amber-50 text-amber-700',
  conclusion:         'bg-orange-50 text-orange-700',
}

// ── Completion ring ───────────────────────────────────────────────────────────

const COMPLETION: Record<string, number> = {
  draft:               30,
  in_review:           70,
  revision_requested:  50,
  approved:           100,
  locked:             100,
}

const RING_COLOR: Record<string, string> = {
  draft:              '#3b82f6',  // blue-500
  in_review:          '#f59e0b',  // amber-500
  revision_requested: '#f97316',  // orange-500
  approved:           '#10b981',  // emerald-500
  locked:             '#94a3b8',  // slate-400
}

const RING_R = 18
const RING_C = 2 * Math.PI * RING_R // ≈ 113.1

function CompletionRing({ status }: { status: string }) {
  const pct = COMPLETION[status] ?? 30
  const color = RING_COLOR[status] ?? RING_COLOR.draft
  const offset = RING_C * (1 - pct / 100)

  return (
    <div className="relative w-11 h-11 flex-shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 40 40">
        <circle
          cx="20" cy="20" r={RING_R}
          fill="transparent" stroke="#e2e8f0" strokeWidth="3"
        />
        <circle
          cx="20" cy="20" r={RING_R}
          fill="transparent"
          stroke={color}
          strokeWidth="3"
          strokeDasharray={RING_C}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-slate-600">
        {pct}%
      </span>
    </div>
  )
}

// ── Text excerpt from TipTap JSON ─────────────────────────────────────────────

function extractExcerpt(content: unknown, maxChars = 160): string {
  if (!content || typeof content !== 'object') return ''
  const doc = content as { content?: unknown[] }
  if (!Array.isArray(doc.content)) return ''

  const parts: string[] = []
  for (const node of doc.content) {
    const n = node as { content?: unknown[] }
    if (Array.isArray(n.content)) {
      for (const leaf of n.content) {
        const l = leaf as { text?: string }
        if (l.text) parts.push(l.text)
      }
    }
    if (parts.join(' ').length >= maxChars) break
  }
  const full = parts.join(' ').trim()
  return full.length > maxChars ? full.slice(0, maxChars).trimEnd() + '…' : full
}

// ── Word count display ────────────────────────────────────────────────────────

function fmtWords(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return n > 0 ? `${n}` : '—'
}

// ── Delete state ──────────────────────────────────────────────────────────────

type DeleteState = 'idle' | 'confirm' | 'deleting'

// ── Card ──────────────────────────────────────────────────────────────────────

export function DocumentCard({
  doc,
  projectId,
}: {
  doc: Document
  projectId: string
}) {
  const router = useRouter()
  const [deleteState, setDeleteState] = useState<DeleteState>('idle')
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()
  const href = `/projects/${projectId}/documents/${doc.id}`

  const excerpt = extractExcerpt(doc.content)
  const typeLabel = DOC_TYPE_LABELS[doc.doc_type] ?? doc.doc_type
  const typeColor = DOC_TYPE_COLORS[doc.doc_type] ?? 'bg-gray-100 text-gray-500'
  const version = `v${doc.current_version ?? 1}`

  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setMenuOpen(false)
    if (deleteState === 'idle') { setDeleteState('confirm'); return }
    if (deleteState === 'confirm') {
      setDeleteState('deleting')
      const { error } = await supabase
        .from('documents')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', doc.id)
      if (error) {
        toast.error('Failed to delete document')
        setDeleteState('idle')
      } else {
        logAudit('document.deleted', 'document', doc.id, { title: doc.title }, projectId)
        toast.success('Document deleted')
        router.refresh()
      }
    }
  }

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDeleteState('idle')
  }

  return (
    <div
      className={cn(
        'relative bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,24,72,0.05)] transition-all duration-200 group',
        'hover:shadow-[0_12px_40px_rgba(0,24,72,0.10)] hover:-translate-y-0.5',
        deleteState === 'confirm' && 'ring-2 ring-red-200',
      )}
    >
      {/* Delete confirmation overlay */}
      {deleteState === 'confirm' && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-2xl bg-white/96 backdrop-blur-sm p-6">
          <AlertTriangle className="h-6 w-6 text-red-500" />
          <p className="text-sm font-semibold text-red-700 text-center">Delete "{doc.title}"?</p>
          <p className="text-xs text-gray-400 text-center">This cannot be undone.</p>
          <div className="flex gap-2 mt-1">
            <button
              onClick={handleDelete}
              className="flex items-center gap-1 h-8 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors"
            >
              <Check className="h-3.5 w-3.5" /> Confirm
            </button>
            <button
              onClick={handleCancelDelete}
              className="flex items-center gap-1 h-8 px-4 rounded-lg border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50 transition-colors"
            >
              <X className="h-3.5 w-3.5" /> Cancel
            </button>
          </div>
        </div>
      )}

      {deleteState === 'deleting' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/80">
          <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
        </div>
      )}

      {/* Clickable body */}
      <Link href={href} className="block p-5">

        {/* Top row: badges (left) + ring + menu (right) */}
        <div className="flex items-start justify-between gap-2 mb-4">
          <div className="flex flex-col gap-1.5">
            <span className={cn(
              'text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full w-max',
              typeColor,
            )}>
              {typeLabel}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full w-max bg-slate-100 text-slate-500">
              {doc.status === 'in_review' ? 'In Review'
                : doc.status === 'revision_requested' ? 'Revision'
                : doc.status === 'approved' ? 'Approved'
                : doc.status === 'locked' ? 'Locked'
                : 'Draft'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <CompletionRing status={doc.status} />
            {/* ⋯ menu */}
            <div
              className="relative"
              ref={menuRef}
              onClick={(e) => e.preventDefault()}
            >
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuOpen(v => !v) }}
                className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-all"
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-7 z-20 w-32 bg-white border border-gray-200 rounded-xl shadow-lg py-1 text-xs">
                  <Link
                    href={href}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-1.5 text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Open
                  </Link>
                  <button
                    onClick={handleDelete}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Title */}
        <h3 className="font-bold text-[15px] leading-snug text-gray-900 mb-2.5 group-hover:text-blue-700 transition-colors line-clamp-2">
          {doc.title}
        </h3>

        {/* Excerpt */}
        {excerpt ? (
          <p className="text-xs text-gray-400 leading-relaxed line-clamp-2 mb-4">
            {excerpt}
          </p>
        ) : (
          <p className="text-xs text-gray-300 italic mb-4">No content yet…</p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3.5 border-t border-gray-50 mt-auto">
          <div className="flex items-center gap-2">
            {/* Version pill */}
            <span className="font-mono text-[10px] font-bold bg-slate-900 text-white px-2 py-0.5 rounded-full">
              {version}
            </span>
            <span className="text-[10px] text-gray-400">
              {fmtWords(doc.word_count)} words
            </span>
          </div>
          <span className="text-[10px] text-gray-300">
            {formatRelativeTime(doc.updated_at)}
          </span>
        </div>
      </Link>
    </div>
  )
}
