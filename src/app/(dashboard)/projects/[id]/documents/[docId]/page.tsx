"use client"

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CollaborativeEditor } from '@/components/document/CollaborativeEditor'
import { SubmitForReviewModal } from '@/components/review/SubmitForReviewModal'
import { ExportDropdown } from '@/components/export/ExportDropdown'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { cn, statusColor, statusLabel } from '@/lib/utils'
import type { Document } from '@/types/database'

export default function DocumentPage() {
  const params = useParams()
  const projectId = params.id as string
  const docId = params.docId as string
  const { profile } = useAuth()
  const [document, setDocument] = useState<Document | null>(null)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
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
  }, [docId, supabase])

  const handleSave = (content: Record<string, unknown>) => {
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

  if (!document) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground text-sm">Loading document...</p>
      </div>
    )
  }

  const canSubmit = profile?.id === document.created_by && document.status === 'draft'

  return (
    <div className="flex flex-col h-screen">
      <div className="border-b bg-card px-6 py-3 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link href={`/projects/${projectId}`}>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="min-w-0">
            <h1 className="font-semibold text-base truncate">{document.title}</h1>
            <p className="text-xs text-muted-foreground">v{document.current_version}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge className={cn('text-xs border', statusColor(document.status))}>
            {statusLabel(document.status)}
          </Badge>
          <ExportDropdown documentId={docId} documentTitle={document.title} />
          {canSubmit && (
            <Button size="sm" className="h-7 text-xs" onClick={() => setShowSubmitModal(true)}>
              <Send className="h-3.5 w-3.5 mr-1" />
              Submit for Review
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <CollaborativeEditor
          documentId={docId}
          projectId={projectId}
          currentProfile={profile}
          initialContent={document.content}
          onSave={handleSave}
          onSubmitForReview={canSubmit ? () => setShowSubmitModal(true) : undefined}
          readOnly={document.status === 'approved'}
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
