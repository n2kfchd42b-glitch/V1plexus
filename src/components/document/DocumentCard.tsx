"use client"

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FileText, Clock, Pencil, Trash2, AlertTriangle, Loader2, X, Check } from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'
import { DocumentStatusBadge } from './DocumentStatusBadge'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Document } from '@/lib/types/database'

const DOC_TYPE_LABELS: Record<string, string> = {
  protocol: 'Protocol',
  manuscript: 'Manuscript',
  thesis_chapter: 'Thesis Chapter',
  ethics_application: 'Ethics Application',
  analysis_plan: 'Analysis Plan',
  general: 'General',
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
  const supabase = createClient()

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
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

  const href = `/projects/${projectId}/documents/${doc.id}`

  return (
    <div className={cn(
      'bg-white border border-gray-200 rounded-xl transition-all',
      deleteState === 'confirm'
        ? 'border-red-200 shadow-sm'
        : 'hover:border-blue-300 hover:shadow-sm'
    )}>
      {/* Main clickable area */}
      <Link href={href} className="block p-5">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="bg-blue-50 rounded-lg p-1.5 flex-shrink-0">
              <FileText className="h-4 w-4 text-blue-600" />
            </div>
            <h3 className="font-semibold text-gray-900 line-clamp-1">{doc.title}</h3>
          </div>
          <DocumentStatusBadge status={doc.status} />
        </div>

        <div className="flex items-center justify-between mt-3">
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
            {DOC_TYPE_LABELS[doc.doc_type] ?? doc.doc_type}
          </span>
          <div className="flex items-center gap-3 text-xs text-gray-400">
            {doc.word_count > 0 && (
              <span>{doc.word_count.toLocaleString()} words</span>
            )}
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatRelativeTime(doc.updated_at)}
            </div>
          </div>
        </div>
      </Link>

      {/* Action bar — always visible */}
      <div className="border-t border-gray-100 px-4 py-2 flex items-center gap-2">
        {deleteState === 'idle' && (
          <>
            <Link
              href={href}
              onClick={e => e.stopPropagation()}
              className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-xs font-medium text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Link>
            <button
              onClick={handleDelete}
              className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-xs font-medium text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors ml-auto"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          </>
        )}

        {deleteState === 'confirm' && (
          <>
            <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
            <span className="text-xs text-red-700 font-medium flex-1">Delete this document?</span>
            <button
              onClick={handleDelete}
              className="flex items-center gap-1 h-7 px-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-medium transition-colors"
            >
              <Check className="h-3.5 w-3.5" />
              Confirm
            </button>
            <button
              onClick={handleCancelDelete}
              className="flex items-center gap-1 h-7 px-2.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </button>
          </>
        )}

        {deleteState === 'deleting' && (
          <span className="flex items-center gap-1.5 text-xs text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Deleting…
          </span>
        )}
      </div>
    </div>
  )
}
