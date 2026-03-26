"use client"

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Send, Save, Trash2, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
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
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
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

  const handleSaveStatus = ({ saving: s, lastSaved: ls }: { saving: boolean; lastSaved: Date | null }) => {
    setSaving(s)
    if (ls) setLastSaved(ls)
  }

  const handleHeaderSave = async () => {
    await triggerSaveRef.current?.()
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
        <p className="text-muted-foreground text-sm">Loading document…</p>
      </div>
    )
  }

  const canSubmit = profile?.id === document.created_by && document.status === 'draft'
  const isApproved = document.status === 'approved'

  // Save status label
  const saveLabel = saving
    ? 'Saving…'
    : lastSaved
      ? `Saved ${lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      : 'Not saved yet'

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="border-b bg-card px-6 py-3 flex items-center justify-between gap-4 shrink-0">
        {/* Left: back + title */}
        <div className="flex items-center gap-3 min-w-0">
          <Link href={`/projects/${projectId}/documents`}>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="min-w-0">
            <h1 className="font-semibold text-base truncate">{document.title}</h1>
            <p className="text-xs text-muted-foreground">v{document.current_version}</p>
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Save status + button */}
          {!isApproved && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground hidden sm:inline">
                {saving ? (
                  <span className="flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Saving…
                  </span>
                ) : lastSaved ? (
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircle2 className="h-3 w-3" /> {saveLabel}
                  </span>
                ) : (
                  saveLabel
                )}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={handleHeaderSave}
                disabled={saving}
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save
              </Button>
            </div>
          )}

          <Badge className={cn('text-xs border', statusColor(document.status))}>
            {statusLabel(document.status)}
          </Badge>

          <ExportDropdown documentId={docId} documentTitle={document.title} />

          {/* Submit for review — only after doc is in draft */}
          {canSubmit && (
            <Button size="sm" className="h-7 text-xs gap-1.5" onClick={() => setShowSubmitModal(true)}>
              <Send className="h-3.5 w-3.5" />
              Submit for Review
            </Button>
          )}

          {/* Delete — two-step */}
          {deleteState === 'idle' && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-slate-400 hover:text-red-600 hover:bg-red-50"
              onClick={handleDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
          {deleteState === 'confirm' && (
            <div className="flex items-center gap-1.5 border border-red-200 bg-red-50 rounded-lg px-2 py-1">
              <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
              <span className="text-xs text-red-700 font-medium">Delete permanently?</span>
              <Button
                size="sm"
                className="h-6 text-xs bg-red-600 hover:bg-red-700 text-white px-2"
                onClick={handleDelete}
              >
                Delete
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs px-2"
                onClick={() => setDeleteState('idle')}
              >
                Cancel
              </Button>
            </div>
          )}
          {deleteState === 'deleting' && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Deleting…
            </span>
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        <CollaborativeEditor
          documentId={docId}
          projectId={projectId}
          currentProfile={profile}
          initialContent={document.content}
          onSave={handleSaveContent}
          onSaveStatusChange={handleSaveStatus}
          triggerSaveRef={triggerSaveRef}
          onSubmitForReview={canSubmit ? () => setShowSubmitModal(true) : undefined}
          readOnly={isApproved}
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
