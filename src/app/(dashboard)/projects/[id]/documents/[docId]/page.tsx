"use client"

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Send, Loader2, AlertTriangle, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CollaborativeEditor } from '@/components/document/CollaborativeEditor'
import { SubmitForReviewModal } from '@/components/review/SubmitForReviewModal'
import { ExportDropdown } from '@/components/export/ExportDropdown'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { cn, statusColor, statusLabel } from '@/lib/utils'
import { toast } from 'sonner'
import type { Document } from '@/types/database'

type DeleteState = 'idle' | 'confirm' | 'deleting'

export default function DocumentPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string
  const docId = params.docId as string
  const { profile } = useAuth()
  const [document, setDocument] = useState<Document | null>(null)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [deleteState, setDeleteState] = useState<DeleteState>('idle')
  const triggerSaveRef = useRef<(() => Promise<void>) | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const fetchDoc = async () => {
      const { data } = await supabase
        .from('documents')
        .select('*')
        .eq('id', docId)
        .single()
      if (data) setDocument(data)
    }
    fetchDoc()
  }, [docId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveContent = (content: Record<string, unknown>) => {
    setDocument(prev => prev ? { ...prev, content } : prev)
  }

  const handleSubmitted = async () => {
    const { data } = await supabase
      .from('documents')
      .select('*')
      .eq('id', docId)
      .single()
    if (data) setDocument(data)
  }

  const handleDelete = async () => {
    if (deleteState === 'idle') { setDeleteState('confirm'); return }
    if (deleteState === 'confirm') {
      setDeleteState('deleting')
      const { error } = await supabase
        .from('documents')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', docId)
      if (error) {
        toast.error('Failed to delete document')
        setDeleteState('idle')
      } else {
        toast.success('Document deleted')
        router.push(`/projects/${projectId}/documents`)
      }
    }
  }

  if (!document) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--text-tertiary)]" />
      </div>
    )
  }

  const canSubmit = profile?.id === document.created_by && document.status === 'draft'
  const isApproved = document.status === 'approved'

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* ── Slim header ─────────────────────────────────────────────────── */}
      <header className="shrink-0 h-12 border-b border-[var(--border-default)] bg-white px-4 flex items-center justify-between gap-3">
        {/* Left: back + title */}
        <div className="flex items-center gap-2 min-w-0">
          <Link href={`/projects/${projectId}/documents`}>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-[var(--text-primary)] truncate leading-none">{document.title}</h1>
            <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">v{document.current_version}</p>
          </div>
          <Badge className={cn('text-[10px] border px-1.5 py-0.5 shrink-0', statusColor(document.status))}>
            {statusLabel(document.status)}
          </Badge>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <ExportDropdown documentId={docId} documentTitle={document.title} />

          {canSubmit && (
            <Button
              size="sm"
              className="h-7 text-xs gap-1.5 bg-[var(--color-clinical-blue)] hover:bg-[var(--color-clinical-deep)]"
              onClick={() => setShowSubmitModal(true)}
            >
              <Send className="h-3.5 w-3.5" />
              Submit for Review
            </Button>
          )}

          {deleteState === 'idle' && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-[var(--text-tertiary)] hover:text-red-500 hover:bg-red-50"
              onClick={handleDelete}
              title="Delete document"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
          {deleteState === 'confirm' && (
            <div className="flex items-center gap-1.5 border border-red-200 bg-red-50 rounded-lg px-2 py-1">
              <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
              <span className="text-xs text-red-700 font-medium">Delete permanently?</span>
              <Button size="sm" className="h-6 text-xs bg-red-600 hover:bg-red-700 text-white px-2" onClick={handleDelete}>
                Delete
              </Button>
              <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => setDeleteState('idle')}>
                Cancel
              </Button>
            </div>
          )}
          {deleteState === 'deleting' && (
            <span className="text-xs text-[var(--text-tertiary)] flex items-center gap-1">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Deleting…
            </span>
          )}
        </div>
      </header>

      {/* ── Editor fills remaining height ───────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        <CollaborativeEditor
          documentId={docId}
          projectId={projectId}
          currentProfile={profile}
          initialContent={document.content}
          onSave={handleSaveContent}
          triggerSaveRef={triggerSaveRef}
          onSubmitForReview={canSubmit ? () => setShowSubmitModal(true) : undefined}
          readOnly={isApproved}
          documentType={document.document_type}
        />
      </div>

      <SubmitForReviewModal
        open={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        documentId={docId}
        documentVersion={document.current_version}
        currentProfile={profile}
        onSubmitted={handleSubmitted}
      />
    </div>
  )
}
