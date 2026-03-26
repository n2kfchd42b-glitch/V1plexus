"use client"

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FileText, Clock, Pencil, Trash2, AlertTriangle, Loader2 } from 'lucide-react'
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
      'group relative bg-white border border-gray-200 rounded-xl p-5 transition-all',
      deleteState === 'confirm'
        ? 'border-red-200 shadow-sm'
        : 'hover:border-blue-300 hover:shadow-sm'
    )}>
      {/* Main clickable area */}
      <Link href={href} className="block">
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

      {/* Action buttons — shown on hover or during delete confirm */}
      <div className={cn(
        'absolute top-3 right-3 flex items-center gap-1 transition-opacity',
        deleteState !== 'idle' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
      )}>
        {deleteState === 'idle' && (
          <>
            <Link
              href={href}
              onClick={e => e.stopPropagation()}
              className="flex items-center gap-1 h-7 px-2 rounded-md text-xs font-medium text-slate-500 bg-white border border-slate-200 hover:border-blue-300 hover:text-blue-600 transition-colors shadow-sm"
            >
              <Pencil className="h-3 w-3" />
              Edit
            </Link>
            <button
              onClick={handleDelete}
              className="flex items-center justify-center h-7 w-7 rounded-md text-slate-400 bg-white border border-slate-200 hover:border-red-200 hover:text-red-500 transition-colors shadow-sm"
              title="Delete document"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        )}

        {deleteState === 'confirm' && (
          <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-lg px-2 py-1 shadow-sm">
            <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
            <span className="text-xs text-red-700 font-medium">Delete?</span>
            <button
              onClick={handleDelete}
              className="h-6 px-2 rounded-md bg-red-600 hover:bg-red-700 text-white text-xs font-medium transition-colors"
            >
              Confirm
            </button>
            <button
              onClick={handleCancelDelete}
              className="h-6 px-2 rounded-md border border-slate-200 bg-white text-xs text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {deleteState === 'deleting' && (
          <span className="flex items-center gap-1 text-xs text-slate-500 bg-white border border-slate-200 rounded-lg px-2 py-1 shadow-sm">
            <Loader2 className="h-3 w-3 animate-spin" /> Deleting…
          </span>
        )}
      </div>
    </div>
  )
}
