"use client"

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Send, Loader2, AlertTriangle, Trash2,
  History, Users, FileText, Shield, FlaskConical, Languages,
  MoreHorizontal,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MinimalEditor } from '@/components/document/MinimalEditor'
import { SubmitForReviewModal } from '@/components/review/SubmitForReviewModal'
import { ExportDropdown } from '@/components/export/ExportDropdown'

// ── Pillar 1 & 5 ──────────────────────────────────────────────────────────────
import { VersionHistory as VersionHistoryEnhanced } from '@/components/document/VersionHistoryEnhanced'
import { AuthorshipPanel } from '@/components/document/AuthorshipPanel'
import { StructuredAbstractModal } from '@/components/document/StructuredAbstractModal'
import { useDocumentAuthors, useDocumentVersions } from '@/hooks/useDocumentEditorPillars'

// ── Pillar 3 ──────────────────────────────────────────────────────────────────
import { AnalysisEmbedModal } from '@/components/document/AnalysisEmbedModal'

// ── Pillar 4 ──────────────────────────────────────────────────────────────────
import { DocumentSecurityPanel } from '@/components/document/DocumentSecurityPanel'

// ── Pillar 6 ──────────────────────────────────────────────────────────────────
import { TranslationPanel } from '@/components/document/TranslationPanel'

import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { cn, statusColor, statusLabel } from '@/lib/utils'
import { toast } from 'sonner'
import type { Document } from '@/types/database'
import type { DocumentVersion } from '@/types/document-editor-pillars'

type DeleteState = 'idle' | 'confirm' | 'deleting'
type RightPanel = 'versions' | 'authors' | 'security' | 'translation' | null

export default function DocumentPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string
  const docId = params.docId as string
  const { profile } = useAuth()
  const [document, setDocument] = useState<Document | null>(null)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [deleteState, setDeleteState] = useState<DeleteState>('idle')
  const [rightPanel, setRightPanel] = useState<RightPanel>(null)
  const [showAbstractModal, setShowAbstractModal] = useState(false)
  const [showAnalysisModal, setShowAnalysisModal] = useState(false)

  const triggerSaveRef = useRef<(() => Promise<void>) | null>(null)
  const insertContentRef = useRef<((html: string) => void) | null>(null)

  const supabase = createClient()

  const { versions, fetchVersions, restoreVersion } = useDocumentVersions(docId)
  const { authors, fetchAuthors } = useDocumentAuthors(docId)

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
    fetchVersions()
    fetchAuthors()
  }, [docId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveContent = (content: Record<string, unknown>) => {
    setDocument(prev => prev ? { ...prev, content } : prev)
  }

  const handleTitleSave = (title: string) => {
    setDocument(prev => prev ? { ...prev, title } : prev)
  }

  const handleSubmitted = async () => {
    const { data } = await supabase
      .from('documents')
      .select('*')
      .eq('id', docId)
      .single()
    if (data) setDocument(data)
  }

  const handleRestoreVersion = async (version: DocumentVersion) => {
    const restored = await restoreVersion(version.id)
    if (restored) {
      const { data } = await supabase.from('documents').select('*').eq('id', docId).single()
      if (data) setDocument(data)
      await fetchVersions()
    }
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

  const togglePanel = (panel: RightPanel) =>
    setRightPanel(prev => (prev === panel ? null : panel))

  if (!document) {
    return (
      <div className="flex items-center justify-center min-h-[400px] bg-bg-app">
        <Loader2 className="h-5 w-5 animate-spin text-text-tertiary" />
      </div>
    )
  }

  const canSubmit = profile?.id === document.created_by && document.status === 'draft'
  const isReadOnly = document.status === 'approved'

  return (
    <div className="flex flex-col h-screen bg-bg-app">

      {/* ── Slim nav bar ─────────────────────────────────────────────────── */}
      <nav className="shrink-0 h-12 bg-bg-app flex items-center justify-between px-6 z-50">

        {/* Left: back + truncated title */}
        <div className="flex items-center gap-2 min-w-0">
          <Link href={`/projects/${projectId}/documents`}>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-text-tertiary hover:text-text-primary"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <span className="text-sm font-semibold text-text-primary truncate tracking-tight leading-none font-manrope">
            {document.title || 'Untitled'}
          </span>
          <Badge className={cn('text-[10px] border px-1.5 py-0.5 shrink-0 font-medium', statusColor(document.status))}>
            {statusLabel(document.status)}
          </Badge>
        </div>

        {/* Right: export + ••• + submit */}
        <div className="flex items-center gap-1 shrink-0">

          <ExportDropdown
            documentId={docId}
            documentTitle={document.title}
            projectId={projectId}
            documentType={document.document_type}
          />

          {/* ••• menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-text-secondary hover:text-text-primary"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={() => setShowAbstractModal(true)}>
                <FileText className="h-4 w-4 mr-2 text-text-tertiary" />
                Abstract builder
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowAnalysisModal(true)}>
                <FlaskConical className="h-4 w-4 mr-2 text-text-tertiary" />
                Embed analysis
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => togglePanel('versions')}>
                <History className="h-4 w-4 mr-2 text-text-tertiary" />
                <span>Version history</span>
                {rightPanel === 'versions' && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent-blue" />
                )}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => togglePanel('authors')}>
                <Users className="h-4 w-4 mr-2 text-text-tertiary" />
                <span>Author contributions</span>
                {rightPanel === 'authors' && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent-blue" />
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => togglePanel('security')}>
                <Shield className="h-4 w-4 mr-2 text-text-tertiary" />
                <span>Security & ethics</span>
                {rightPanel === 'security' && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent-blue" />
                )}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => togglePanel('translation')}>
                <Languages className="h-4 w-4 mr-2 text-text-tertiary" />
                <span>Translation</span>
                {rightPanel === 'translation' && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent-blue" />
                )}
              </DropdownMenuItem>
              {deleteState === 'idle' && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleDelete}
                    className="text-status-error focus:text-status-error focus:bg-status-error-bg"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete document
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Delete confirm — inline */}
          {deleteState === 'confirm' && (
            <div className="flex items-center gap-1.5 border border-status-error/30 bg-status-error-bg rounded-lg px-2 py-1">
              <AlertTriangle className="h-3.5 w-3.5 text-status-error shrink-0" />
              <span className="text-xs text-status-error-text font-medium">Delete permanently?</span>
              <Button size="sm" className="h-6 text-xs bg-status-error hover:bg-red-600 text-white px-2" onClick={handleDelete}>
                Delete
              </Button>
              <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => setDeleteState('idle')}>
                Cancel
              </Button>
            </div>
          )}
          {deleteState === 'deleting' && (
            <span className="text-xs text-text-tertiary flex items-center gap-1">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Deleting…
            </span>
          )}

          {canSubmit && (
            <>
              <div className="h-4 w-px bg-border-default mx-0.5" />
              <Button
                size="sm"
                className="h-7 text-[11px] gap-1.5 bg-accent-blue hover:bg-blue-600 text-white font-semibold"
                onClick={() => setShowSubmitModal(true)}
              >
                <Send className="h-3 w-3" />
                Submit
              </Button>
            </>
          )}
        </div>
      </nav>

      {/* ── Body: editor + pillar right panels ───────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Editor */}
        <div className="flex-1 overflow-hidden">
          <MinimalEditor
            documentId={docId}
            projectId={projectId}
            initialTitle={document.title}
            initialContent={document.content}
            onSave={handleSaveContent}
            onTitleSave={handleTitleSave}
            triggerSaveRef={triggerSaveRef}
            insertContentRef={insertContentRef}
            readOnly={isReadOnly}
          />
        </div>

        {/* Pillar right panels */}
        {rightPanel === 'versions' && (
          <VersionHistoryEnhanced
            versions={versions}
            currentVersion={document.current_version || 1}
            currentContent={document.content || null}
            onClose={() => setRightPanel(null)}
            onRestore={handleRestoreVersion}
          />
        )}
        {rightPanel === 'authors' && (
          <AuthorshipPanel
            documentId={docId}
            authors={authors.map(a => ({
              id: a.id,
              userId: a.user_id,
              displayName: a.display_name,
              email: a.email,
              orcid: a.orcid,
              institution: a.institution,
              creditRoles: a.credit_roles,
              contributionOrder: a.contribution_order,
              isCorresponding: a.is_corresponding,
              confirmedAt: a.confirmed_at ?? undefined,
              createdAt: a.created_at,
            }))}
            onAuthorsChange={() => {}}
            onSave={fetchAuthors}
          />
        )}
        {rightPanel === 'security' && (
          <DocumentSecurityPanel
            documentId={docId}
            projectId={projectId}
            onClose={() => setRightPanel(null)}
          />
        )}
        {rightPanel === 'translation' && (
          <TranslationPanel
            documentId={docId}
            onClose={() => setRightPanel(null)}
            onInsertTranslation={(html) => insertContentRef.current?.(html)}
          />
        )}
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      <StructuredAbstractModal
        isOpen={showAbstractModal}
        onClose={() => setShowAbstractModal(false)}
        onInsert={(text) => insertContentRef.current?.(text)}
      />
      <AnalysisEmbedModal
        open={showAnalysisModal}
        onClose={() => setShowAnalysisModal(false)}
        documentId={docId}
        projectId={projectId}
        onInsert={(html) => insertContentRef.current?.(html)}
      />
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
