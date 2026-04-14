"use client"

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Send, Loader2, AlertTriangle, Trash2,
  History, Users, FileText, Shield, FlaskConical, Languages,
  MoreHorizontal, Share2, Download,
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
import { CollaborativeEditor } from '@/components/document/CollaborativeEditor'
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

  // ── Pillar 2: Abstract ──────────────────────────────────────────────────────
  const [showAbstractModal, setShowAbstractModal] = useState(false)

  // ── Pillar 3: Analysis embed ────────────────────────────────────────────────
  const [showAnalysisModal, setShowAnalysisModal] = useState(false)

  // Refs for editor interaction
  const triggerSaveRef = useRef<(() => Promise<void>) | null>(null)
  const insertContentRef = useRef<((html: string) => void) | null>(null)

  const supabase = createClient()

  // ── Pillar 1: Versions ──────────────────────────────────────────────────────
  const { versions, fetchVersions, restoreVersion } = useDocumentVersions(docId)

  // ── Pillar 5: Authors ───────────────────────────────────────────────────────
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
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--text-tertiary)]" />
      </div>
    )
  }

  const canSubmit = profile?.id === document.created_by && document.status === 'draft'
  const isReadOnly = document.status === 'approved'

  return (
    <div className="flex flex-col h-screen bg-[var(--bg-app)]">
      {/* ── Slim header ────────────────────────────────────────────────────── */}
      <header className="shrink-0 h-12 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] px-4 flex items-center justify-between gap-3 z-10">
        {/* Left: back + title + status */}
        <div className="flex items-center gap-2 min-w-0">
          <Link href={`/projects/${projectId}/documents`}>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-sm font-semibold text-[var(--text-primary)] truncate tracking-tight leading-none">
            {document.title}
          </h1>
          <Badge className={cn('text-[10px] border px-1.5 py-0.5 shrink-0 font-medium', statusColor(document.status))}>
            {statusLabel(document.status)}
          </Badge>
        </div>

        {/* Right: export + ••• menu + submit */}
        <div className="flex items-center gap-1 shrink-0">

          {/* Export */}
          <ExportDropdown
            documentId={docId}
            documentTitle={document.title}
            projectId={projectId}
            documentType={document.document_type}
          />

          {/* ••• — all pillar features */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={() => setShowAbstractModal(true)}>
                <FileText className="h-4 w-4 mr-2 text-[var(--text-tertiary)]" />
                Abstract builder
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowAnalysisModal(true)}>
                <FlaskConical className="h-4 w-4 mr-2 text-[var(--text-tertiary)]" />
                Embed analysis
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => togglePanel('versions')}>
                <History className="h-4 w-4 mr-2 text-[var(--text-tertiary)]" />
                <span>Version history</span>
                {rightPanel === 'versions' && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[var(--accent-blue)]" />
                )}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => togglePanel('authors')}>
                <Users className="h-4 w-4 mr-2 text-[var(--text-tertiary)]" />
                <span>Author contributions</span>
                {rightPanel === 'authors' && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[var(--accent-blue)]" />
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => togglePanel('security')}>
                <Shield className="h-4 w-4 mr-2 text-[var(--text-tertiary)]" />
                <span>Security & ethics</span>
                {rightPanel === 'security' && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[var(--accent-blue)]" />
                )}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => togglePanel('translation')}>
                <Languages className="h-4 w-4 mr-2 text-[var(--text-tertiary)]" />
                <span>Translation</span>
                {rightPanel === 'translation' && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[var(--accent-blue)]" />
                )}
              </DropdownMenuItem>
              {deleteState === 'idle' && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleDelete}
                    className="text-[var(--status-error)] focus:text-[var(--status-error)] focus:bg-[var(--status-error-bg)]"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete document
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Delete confirm inline */}
          {deleteState === 'confirm' && (
            <div className="flex items-center gap-1.5 border border-[var(--border-status-error)] bg-[var(--status-error-bg)] rounded-lg px-2 py-1">
              <AlertTriangle className="h-3.5 w-3.5 text-[var(--status-error)] shrink-0" />
              <span className="text-xs text-[var(--status-error-text)] font-medium">Delete permanently?</span>
              <Button size="sm" className="h-6 text-xs bg-[var(--status-error)] hover:bg-[var(--status-error-hover)] text-white px-2" onClick={handleDelete}>
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

          {/* Submit — primary CTA */}
          {canSubmit && (
            <>
              <div className="h-5 w-px bg-[var(--border-default)] mx-0.5" />
              <Button
                size="sm"
                className="h-7 text-[11px] gap-1.5 bg-[var(--accent-blue)] hover:bg-[var(--accent-blue-hover)] text-white font-semibold"
                onClick={() => setShowSubmitModal(true)}
              >
                <Send className="h-3 w-3" />
                Submit
              </Button>
            </>
          )}
        </div>
      </header>

      {/* ── Body: editor + right panels ────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-hidden">
          <CollaborativeEditor
            documentId={docId}
            projectId={projectId}
            currentProfile={profile}
            initialContent={document.content}
            onSave={handleSaveContent}
            triggerSaveRef={triggerSaveRef}
            insertContentRef={insertContentRef}
            onSubmitForReview={canSubmit ? () => setShowSubmitModal(true) : undefined}
            readOnly={isReadOnly}
            documentType={document.document_type}
          />
        </div>

        {/* Pillar 1: Version history panel */}
        {rightPanel === 'versions' && (
          <VersionHistoryEnhanced
            versions={versions}
            currentVersion={document.current_version || 1}
            currentContent={document.content || null}
            onClose={() => setRightPanel(null)}
            onRestore={handleRestoreVersion}
          />
        )}

        {/* Pillar 5: Authorship panel */}
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

        {/* Pillar 4: Security & ethics panel */}
        {rightPanel === 'security' && (
          <DocumentSecurityPanel
            documentId={docId}
            projectId={projectId}
            onClose={() => setRightPanel(null)}
          />
        )}

        {/* Pillar 6: Translation panel */}
        {rightPanel === 'translation' && (
          <TranslationPanel
            documentId={docId}
            onClose={() => setRightPanel(null)}
            onInsertTranslation={(html) => insertContentRef.current?.(html)}
          />
        )}
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}

      {/* Pillar 2: Structured abstract */}
      <StructuredAbstractModal
        isOpen={showAbstractModal}
        onClose={() => setShowAbstractModal(false)}
        onInsert={(text) => insertContentRef.current?.(text)}
      />

      {/* Pillar 3: Analysis embed picker */}
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
