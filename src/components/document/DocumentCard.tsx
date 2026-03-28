"use client"

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  FileText, Clock, Pencil, Trash2, AlertTriangle,
  Loader2, X, Check, MoreVertical,
} from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'
import { DocumentStatusBadge } from './DocumentStatusBadge'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { logAudit } from '@/lib/audit'
import { cn } from '@/lib/utils'
import type { Document } from '@/lib/types/database'

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

type DeleteState = 'idle' | 'confirm' | 'deleting'

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

  // Close menu on outside click
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
        logAudit('delete', 'document', doc.id, { title: doc.title }, projectId)
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
        'relative bg-white rounded-xl border transition-all group',
        deleteState === 'confirm'
          ? 'border-red-200 shadow-sm'
          : 'border-gray-200 hover:border-blue-300 hover:shadow-sm'
      )}
    >
      {/* Delete confirmation overlay */}
      {deleteState === 'confirm' && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2.5 rounded-xl bg-white/95 backdrop-blur-sm p-4">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          <p className="text-xs font-medium text-red-700 text-center">Delete this document?</p>
          <div className="flex gap-2">
            <button
              onClick={handleDelete}
              className="flex items-center gap-1 h-7 px-3 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-medium transition-colors"
            >
              <Check className="h-3.5 w-3.5" />
              Confirm
            </button>
            <button
              onClick={handleCancelDelete}
              className="flex items-center gap-1 h-7 px-3 rounded-lg border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-50 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </button>
          </div>
        </div>
      )}

      {deleteState === 'deleting' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/80">
          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
        </div>
      )}

      {/* Card body */}
      <Link href={href} className="block p-4">
        {/* Top row: icon + title + menu */}
        <div className="flex items-start gap-2 mb-2.5">
          <div className="bg-blue-50 rounded-lg p-1.5 flex-shrink-0 mt-0.5">
            <FileText className="h-3.5 w-3.5 text-blue-600" />
          </div>
          <h3 className="font-medium text-gray-900 text-sm leading-snug line-clamp-2 flex-1 min-w-0">
            {doc.title}
          </h3>
          {/* ⋯ menu — stop propagation so link doesn't fire */}
          <div
            className="relative flex-shrink-0"
            ref={menuRef}
            onClick={(e) => e.preventDefault()}
          >
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuOpen(v => !v) }}
              className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-all"
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-7 z-20 w-32 bg-white border border-gray-200 rounded-lg shadow-lg py-1 text-xs">
                <Link
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-1.5 text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Pencil className="h-3 w-3" />
                  Edit
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

        {/* Bottom row: type + status + meta */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-medium">
            {DOC_TYPE_LABELS[doc.doc_type] ?? doc.doc_type}
          </span>
          <DocumentStatusBadge status={doc.status} className="text-[10px] px-1.5 py-0.5" />
        </div>

        <div className="flex items-center gap-2 mt-2.5 text-[10px] text-gray-400">
          {doc.word_count > 0 && (
            <span>{doc.word_count.toLocaleString()} words</span>
          )}
          <div className="flex items-center gap-0.5 ml-auto">
            <Clock className="h-2.5 w-2.5" />
            {formatRelativeTime(doc.updated_at)}
          </div>
        </div>
      </Link>
    </div>
  )
}
