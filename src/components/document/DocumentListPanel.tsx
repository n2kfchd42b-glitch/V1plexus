"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Plus, ChevronLeft, ChevronRight, FileText, Loader2,
  MoreVertical, Trash2, AlertTriangle, Check, X,
} from 'lucide-react'
import { cn, formatRelativeTime, statusColor, statusLabel } from '@/lib/utils'
import type { Document } from '@/lib/types/database'

// ── Filter chips ──────────────────────────────────────────────────────────────

const FILTERS = [
  { label: 'All',       value: 'all' },
  { label: 'Draft',     value: 'draft' },
  { label: 'Review',    value: 'in_review' },
  { label: 'Approved',  value: 'approved' },
] as const
type FilterValue = (typeof FILTERS)[number]['value']

// ── Status dot ────────────────────────────────────────────────────────────────

const STATUS_DOT: Record<string, string> = {
  draft:               'bg-text-tertiary',
  in_review:           'bg-status-warning',
  revision_requested:  'bg-status-error',
  approved:            'bg-status-success',
  locked:              'bg-text-tertiary',
}

// ── Document list panel ───────────────────────────────────────────────────────

interface DocumentListPanelProps {
  projectId: string
  selectedDocId: string
  triggerSaveRef?: { current: (() => Promise<void>) | null }
}

export function DocumentListPanel({
  projectId,
  selectedDocId,
  triggerSaveRef,
}: DocumentListPanelProps) {
  const router = useRouter()
  const supabase = createClient()

  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState(false)
  const [filter, setFilter] = useState<FilterValue>('all')
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)

  const fetchDocs = async () => {
    const { data } = await supabase
      .from('documents')
      .select('*')
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
    if (data) setDocuments(data as Document[])
    setLoading(false)
  }

  useEffect(() => { fetchDocs() }, [projectId]) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = filter === 'all' ? documents : documents.filter(d => d.status === filter)

  const handleSelect = async (docId: string) => {
    if (docId === selectedDocId) return
    // Save current doc before switching
    if (triggerSaveRef?.current) {
      try { await triggerSaveRef.current() } catch { /* ignore */ }
    }
    router.push(`/projects/${projectId}/documents/${docId}`)
  }

  const handleNew = async () => {
    if (creating) return
    setCreating(true)
    const { data, error } = await supabase
      .from('documents')
      .insert({
        project_id: projectId,
        title: 'Untitled document',
        content: null,
        status: 'draft',
        doc_type: 'general',
        current_version: 1,
      })
      .select()
      .single()

    if (error || !data) {
      toast.error('Failed to create document')
      setCreating(false)
      return
    }
    await fetchDocs()
    setCreating(false)
    router.push(`/projects/${projectId}/documents/${data.id}`)
  }

  const handleDelete = async (docId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirmId !== docId) { setConfirmId(docId); setMenuOpenId(null); return }
    setDeletingId(docId)
    const { error } = await supabase
      .from('documents')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', docId)
    if (error) {
      toast.error('Failed to delete document')
    } else {
      toast.success('Document deleted')
      await fetchDocs()
      if (docId === selectedDocId) {
        const remaining = documents.filter(d => d.id !== docId)
        if (remaining.length > 0) {
          router.push(`/projects/${projectId}/documents/${remaining[0].id}`)
        } else {
          router.push(`/projects/${projectId}/documents`)
        }
      }
    }
    setDeletingId(null)
    setConfirmId(null)
  }

  // Collapsed pill
  if (collapsed) {
    return (
      <div className="w-10 shrink-0 flex flex-col items-center pt-3 border-r border-border-subtle bg-bg-app">
        <button
          onClick={() => setCollapsed(false)}
          className="h-7 w-7 flex items-center justify-center rounded text-text-tertiary hover:text-text-primary hover:bg-bg-surface-hover transition-colors"
          title="Expand document list"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
        <div className="mt-3 flex flex-col gap-1 items-center">
          {documents.slice(0, 8).map(doc => (
            <button
              key={doc.id}
              onClick={() => handleSelect(doc.id)}
              title={doc.title}
              className={cn(
                'w-2 h-2 rounded-full transition-colors',
                doc.id === selectedDocId
                  ? 'bg-accent-blue'
                  : 'bg-border-default hover:bg-text-tertiary'
              )}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="w-[220px] shrink-0 flex flex-col border-r border-border-subtle bg-bg-app overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border-subtle shrink-0">
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-text-tertiary">
          Documents
        </span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={handleNew}
            disabled={creating}
            className="h-6 w-6 flex items-center justify-center rounded text-text-tertiary hover:text-text-primary hover:bg-bg-surface-hover transition-colors"
            title="New document"
          >
            {creating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            onClick={() => setCollapsed(true)}
            className="h-6 w-6 flex items-center justify-center rounded text-text-tertiary hover:text-text-primary hover:bg-bg-surface-hover transition-colors"
            title="Collapse"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-1 px-3 py-2 flex-wrap shrink-0">
        {FILTERS.map(f => {
          const count = f.value === 'all'
            ? documents.length
            : documents.filter(d => d.status === f.value).length
          return (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                'text-[10px] font-semibold px-2 py-0.5 rounded-full transition-colors',
                filter === f.value
                  ? 'bg-accent-blue text-white'
                  : 'bg-bg-surface-active text-text-tertiary hover:text-text-secondary'
              )}
            >
              {f.label} {count > 0 && <span className="opacity-70">{count}</span>}
            </button>
          )
        })}
      </div>

      {/* Document rows */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin text-text-tertiary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-4 text-center gap-2">
            <FileText className="h-6 w-6 text-text-tertiary opacity-40" />
            <p className="text-[11px] text-text-tertiary">
              {filter === 'all' ? 'No documents yet' : `No ${filter} documents`}
            </p>
            {filter === 'all' && (
              <button
                onClick={handleNew}
                disabled={creating}
                className="text-[11px] text-accent-blue hover:underline"
              >
                Create your first
              </button>
            )}
          </div>
        ) : (
          <div className="py-1">
            {filtered.map(doc => {
              const isSelected = doc.id === selectedDocId
              const isConfirming = confirmId === doc.id
              const isDeleting = deletingId === doc.id
              const dot = STATUS_DOT[doc.status] ?? 'bg-text-tertiary'

              return (
                <div
                  key={doc.id}
                  className={cn(
                    'group relative flex items-start gap-2 px-3 py-2.5 cursor-pointer transition-colors',
                    isSelected
                      ? 'bg-accent-blue-subtle'
                      : 'hover:bg-bg-row-hover',
                    isConfirming && 'bg-status-error-bg'
                  )}
                  onClick={() => !isConfirming && !isDeleting && handleSelect(doc.id)}
                >
                  {/* Left accent */}
                  {isSelected && (
                    <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-accent-blue rounded-full" />
                  )}

                  {/* Status dot */}
                  <div className={cn('w-1.5 h-1.5 rounded-full mt-1.5 shrink-0', dot)} />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {isConfirming ? (
                      <div className="flex flex-col gap-1.5">
                        <p className="text-[11px] font-medium text-status-error-text truncate">
                          Delete &ldquo;{doc.title}&rdquo;?
                        </p>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => handleDelete(doc.id, e)}
                            disabled={isDeleting}
                            className="flex items-center gap-0.5 h-5 px-2 rounded bg-status-error text-white text-[10px] font-semibold transition-colors hover:bg-status-error-hover"
                          >
                            {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                            Delete
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setConfirmId(null) }}
                            className="h-5 px-2 rounded border border-border-default text-text-secondary text-[10px] font-semibold hover:bg-bg-surface-hover transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className={cn(
                          'text-[12px] font-medium leading-snug truncate',
                          isSelected ? 'text-accent-blue' : 'text-text-primary'
                        )}>
                          {doc.title || 'Untitled'}
                        </p>
                        <p className="text-[10px] text-text-tertiary mt-0.5 truncate">
                          {formatRelativeTime(doc.updated_at)}
                        </p>
                      </>
                    )}
                  </div>

                  {/* Context menu — only when not confirming */}
                  {!isConfirming && !isDeleting && (
                    <div className="relative shrink-0" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setMenuOpenId(v => v === doc.id ? null : doc.id)}
                        className="opacity-0 group-hover:opacity-100 h-5 w-5 flex items-center justify-center rounded text-text-tertiary hover:text-text-primary hover:bg-bg-surface-active transition-all"
                      >
                        <MoreVertical className="h-3 w-3" />
                      </button>

                      {menuOpenId === doc.id && (
                        <div className="absolute right-0 top-6 z-30 w-28 bg-bg-surface border border-border-default rounded-lg shadow-md py-1 text-[11px]">
                          <button
                            onClick={() => { handleSelect(doc.id); setMenuOpenId(null) }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-text-secondary hover:bg-bg-row-hover transition-colors"
                          >
                            Open
                          </button>
                          <button
                            onClick={(e) => { setMenuOpenId(null); handleDelete(doc.id, e) }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-status-error hover:bg-status-error-bg transition-colors"
                          >
                            <Trash2 className="h-3 w-3" />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer: new doc */}
      <div className="shrink-0 border-t border-border-subtle px-3 py-2">
        <button
          onClick={handleNew}
          disabled={creating}
          className="w-full flex items-center gap-2 h-7 px-2 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-surface-hover transition-colors text-[11px]"
        >
          {creating
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Plus className="h-3.5 w-3.5" />
          }
          New document
        </button>
      </div>
    </div>
  )
}
