"use client"

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Highlight from '@tiptap/extension-highlight'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Link from '@tiptap/extension-link'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { createClient } from '@/lib/supabase/client'
import { EditorToolbar } from './EditorToolbar'
import { DocumentOutline } from './DocumentOutline'
import { CitationPanel } from './CitationPanel'
import { DataPanel } from './DataPanel'
import { SlashCommandMenu } from './SlashCommandMenu'
import { FloatingSelectionToolbar } from './FloatingSelectionToolbar'
import { ComplianceStatusBar } from './ComplianceStatusBar'
import { CommentsSidebar } from './CommentsSidebar'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { Profile } from '@/types/database'
import type { CslCitation } from '@/components/publication/CitationSearch'
import { AIAssistPopover } from '@/components/ai/AIAssistPopover'
import { GenerateSectionModal } from '@/components/ai/GenerateSectionModal'
import { GrammarCheckPanel } from '@/components/ai/GrammarCheckPanel'
import { DatasetTableExtension } from './extensions/DatasetTableNode'
import { ChartNodeExtension } from './extensions/ChartNode'
import { TableBlockNodeExtension } from './extensions/TableBlockNode'
import { CitationNodeExtension, buildCitationAttrs } from './extensions/CitationNode'
import {
  BookOpen, BarChart2, MessageSquare, SpellCheck, Sparkles,
  PanelLeftClose, PanelLeftOpen,
} from 'lucide-react'

type RightPanel = 'citations' | 'data' | 'comments' | 'grammar' | null
type ReferenceStyle = 'vancouver' | 'apa7' | 'harvard' | 'numbered'

interface CollaborativeEditorProps {
  documentId: string
  projectId: string
  currentProfile: Profile | null
  initialContent?: Record<string, unknown> | null
  onSave?: (content: Record<string, unknown>) => void
  onSubmitForReview?: () => void
  onSaveStatusChange?: (status: { saving: boolean; lastSaved: Date | null }) => void
  triggerSaveRef?: { current: (() => Promise<void>) | null }
  readOnly?: boolean
  documentType?: string
}

function extractText(node: Record<string, unknown>): string {
  let text = ''
  if (node.type === 'text' && typeof node.text === 'string') text += node.text + ' '
  if (Array.isArray(node.content)) {
    for (const child of node.content as Record<string, unknown>[]) text += extractText(child)
  }
  return text
}

export function CollaborativeEditor({
  documentId,
  projectId,
  currentProfile,
  initialContent,
  onSave,
  onSubmitForReview,
  onSaveStatusChange,
  triggerSaveRef,
  readOnly = false,
  documentType = 'general',
}: CollaborativeEditorProps) {
  const [rightPanel, setRightPanel] = useState<RightPanel>(null)
  const [outlineCollapsed, setOutlineCollapsed] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [wordCount, setWordCount] = useState(0)

  // Citations managed at editor level so all panels stay in sync
  const [citations, setCitations] = useState<CslCitation[]>([])
  const [citationStyle, setCitationStyle] = useState<ReferenceStyle>('vancouver')

  const saveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const handleAutoSaveRef = useRef<((content: Record<string, unknown>) => Promise<void>) | null>(null)
  const supabase = useMemo(() => createClient(), [])

  const handleAutoSave = useCallback(async (content: Record<string, unknown>) => {
    setSaving(true)
    onSaveStatusChange?.({ saving: true, lastSaved: null })
    try {
      const plainText = extractText(content).trim()
      const wc = plainText ? plainText.split(/\s+/).filter(Boolean).length : 0
      setWordCount(wc)
      const { error } = await supabase
        .from('documents')
        .update({ content, word_count: wc, updated_at: new Date().toISOString() })
        .eq('id', documentId)
      if (error) throw error
      const saved = new Date()
      setLastSaved(saved)
      onSave?.(content)
      onSaveStatusChange?.({ saving: false, lastSaved: saved })
    } catch (err) {
      console.error('Document save error:', err)
      toast.error('Failed to save document')
      onSaveStatusChange?.({ saving: false, lastSaved: null })
    } finally {
      setSaving(false)
    }
  }, [documentId, supabase, onSave, onSaveStatusChange]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { handleAutoSaveRef.current = handleAutoSave }, [handleAutoSave])

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Start writing — or press / for commands…' }),
      Highlight,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({ openOnClick: false }),
      TaskList,
      TaskItem.configure({ nested: true }),
      DatasetTableExtension,
      ChartNodeExtension,
      TableBlockNodeExtension,
      CitationNodeExtension,
    ],
    content: (initialContent ?? undefined) as Record<string, unknown> | undefined,
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      if (readOnly) return
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        handleAutoSaveRef.current?.(editor.getJSON())
      }, 3000)
    },
  })

  const handleManualSave = useCallback(async () => {
    if (!editor) return
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null }
    await handleAutoSave(editor.getJSON())
  }, [editor, handleAutoSave])

  useEffect(() => {
    if (triggerSaveRef) triggerSaveRef.current = handleManualSave
    return () => { if (triggerSaveRef) triggerSaveRef.current = null }
  }, [triggerSaveRef, handleManualSave])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const cmd = e.metaKey || e.ctrlKey
      if (cmd && e.key === 's') { e.preventDefault(); handleManualSave() }
      if (cmd && e.key === 'j') { e.preventDefault(); setAiOpen(p => !p) }
      if (cmd && e.key === '\\') { e.preventDefault(); setFocusMode(p => !p) }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleManualSave])

  useEffect(() => () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }, [])

  // Citation helpers
  const insertCitationIntoEditor = useCallback((citation: CslCitation) => {
    if (!editor) return
    setCitations(prev => {
      const exists = prev.find(c => c.DOI && c.DOI === citation.DOI)
      if (exists) {
        const num = prev.indexOf(exists) + 1
        editor.chain().focus().insertContent({
          type: 'citation',
          attrs: buildCitationAttrs(citation, num, citationStyle),
        }).run()
        return prev
      }
      const next = [...prev, citation]
      const num = next.length
      editor.chain().focus().insertContent({
        type: 'citation',
        attrs: buildCitationAttrs(citation, num, citationStyle),
      }).run()
      return next
    })
  }, [editor, citationStyle])

  const removeCitation = useCallback((idx: number) => {
    setCitations(prev => prev.filter((_, i) => i !== idx))
  }, [])

  const togglePanel = (panel: RightPanel) => {
    setRightPanel(p => p === panel ? null : panel)
  }

  const panelActive = (panel: RightPanel) => rightPanel === panel

  // In focus mode, collapse everything
  const showOutline = !focusMode
  const showRight = !focusMode && rightPanel !== null

  return (
    <div className="flex flex-col h-full bg-[var(--bg-app)]">
      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      {!readOnly && (
        <div className="shrink-0 border-b border-[var(--border-default)] bg-white px-3 py-1.5 flex items-center gap-1">
          {/* Outline toggle */}
          <button
            onClick={() => setOutlineCollapsed(p => !p)}
            className="h-7 w-7 flex items-center justify-center rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-app)] transition-colors shrink-0"
            title="Toggle outline"
          >
            {outlineCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>

          <div className="h-5 w-px bg-[var(--border-default)] mx-1" />

          {/* Formatting toolbar */}
          <EditorToolbar editor={editor} onInsertData={() => togglePanel('data')} />

          <div className="flex-1" />

          {/* Right panel toggles */}
          <div className="flex items-center gap-0.5 shrink-0">
            {editor && (
              <AIAssistPopover editor={editor} documentId={documentId} open={aiOpen} onOpenChange={setAiOpen} />
            )}
            <button
              onClick={() => setShowGenerateModal(true)}
              className={cn('h-7 flex items-center gap-1.5 px-2 rounded-md text-xs font-medium transition-colors',
                'text-purple-600 hover:bg-purple-50 hover:text-purple-700'
              )}
              title="Generate section with AI (⌘J)"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Generate
            </button>

            <div className="h-5 w-px bg-[var(--border-default)] mx-1" />

            <button
              onClick={() => togglePanel('citations')}
              className={cn('h-7 flex items-center gap-1.5 px-2 rounded-md text-xs font-medium transition-colors',
                panelActive('citations')
                  ? 'bg-blue-50 text-[var(--color-clinical-blue)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-app)] hover:text-[var(--text-primary)]'
              )}
              title="Citations panel"
            >
              <BookOpen className="h-3.5 w-3.5" />
              Cite
              {citations.length > 0 && (
                <span className="px-1.5 py-px bg-[var(--color-clinical-blue)] text-white rounded-full text-[10px] font-bold leading-none">
                  {citations.length}
                </span>
              )}
            </button>

            <button
              onClick={() => togglePanel('data')}
              className={cn('h-7 flex items-center gap-1.5 px-2 rounded-md text-xs font-medium transition-colors',
                panelActive('data')
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-app)] hover:text-[var(--text-primary)]'
              )}
              title="Data panel"
            >
              <BarChart2 className="h-3.5 w-3.5" />
              Data
            </button>

            <button
              onClick={() => togglePanel('grammar')}
              className={cn('h-7 flex items-center gap-1.5 px-2 rounded-md text-xs font-medium transition-colors',
                panelActive('grammar')
                  ? 'bg-amber-50 text-amber-700'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-app)] hover:text-[var(--text-primary)]'
              )}
              title="Grammar check"
            >
              <SpellCheck className="h-3.5 w-3.5" />
              Check
            </button>

            <button
              onClick={() => togglePanel('comments')}
              className={cn('h-7 flex items-center gap-1.5 px-2 rounded-md text-xs font-medium transition-colors',
                panelActive('comments')
                  ? 'bg-slate-100 text-[var(--text-primary)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-app)] hover:text-[var(--text-primary)]'
              )}
              title="Comments"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Notes
            </button>
          </div>
        </div>
      )}

      {/* ── Three-panel body ─────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: Outline */}
        {showOutline && (
          <DocumentOutline
            editor={editor}
            collapsed={outlineCollapsed}
            onToggle={() => setOutlineCollapsed(p => !p)}
          />
        )}

        {/* Center: Writing surface */}
        <div className="flex-1 overflow-y-auto relative bg-white">
          {/* Slash command menu — positioned relative to editor container */}
          <div className="relative">
            <EditorContent
              editor={editor}
              className={cn(
                'min-h-full',
                '[&_.ProseMirror]:outline-none',
                '[&_.ProseMirror]:min-h-[calc(100vh-200px)]',
                '[&_.ProseMirror]:max-w-[720px]',
                '[&_.ProseMirror]:mx-auto',
                '[&_.ProseMirror]:px-12',
                '[&_.ProseMirror]:py-12',
                '[&_.ProseMirror]:text-[var(--text-primary)]',
                '[&_.ProseMirror]:text-[15px]',
                '[&_.ProseMirror]:leading-[1.8]',
                // Placeholder
                '[&_.ProseMirror_p.is-editor-empty:first-child::before]:text-[var(--text-tertiary)]',
                '[&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]',
                '[&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left',
                '[&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none',
                '[&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0',
                // Headings
                '[&_.ProseMirror_h1]:font-display',
                '[&_.ProseMirror_h1]:text-3xl',
                '[&_.ProseMirror_h1]:font-bold',
                '[&_.ProseMirror_h1]:text-[var(--text-primary)]',
                '[&_.ProseMirror_h1]:mt-10',
                '[&_.ProseMirror_h1]:mb-4',
                '[&_.ProseMirror_h2]:text-xl',
                '[&_.ProseMirror_h2]:font-semibold',
                '[&_.ProseMirror_h2]:text-[var(--text-primary)]',
                '[&_.ProseMirror_h2]:mt-8',
                '[&_.ProseMirror_h2]:mb-3',
                '[&_.ProseMirror_h3]:text-base',
                '[&_.ProseMirror_h3]:font-semibold',
                '[&_.ProseMirror_h3]:text-[var(--text-secondary)]',
                '[&_.ProseMirror_h3]:mt-6',
                '[&_.ProseMirror_h3]:mb-2',
                // Paragraphs
                '[&_.ProseMirror_p]:mb-4',
                // Blockquote
                '[&_.ProseMirror_blockquote]:border-l-4',
                '[&_.ProseMirror_blockquote]:border-[var(--color-clinical-blue)]',
                '[&_.ProseMirror_blockquote]:pl-4',
                '[&_.ProseMirror_blockquote]:text-[var(--text-secondary)]',
                '[&_.ProseMirror_blockquote]:italic',
                '[&_.ProseMirror_blockquote]:my-4',
                // Code
                '[&_.ProseMirror_pre]:bg-[var(--bg-app)]',
                '[&_.ProseMirror_pre]:border',
                '[&_.ProseMirror_pre]:border-[var(--border-default)]',
                '[&_.ProseMirror_pre]:rounded-lg',
                '[&_.ProseMirror_pre]:p-4',
                '[&_.ProseMirror_pre]:text-sm',
                '[&_.ProseMirror_code]:bg-[var(--bg-app)]',
                '[&_.ProseMirror_code]:px-1',
                '[&_.ProseMirror_code]:rounded',
                '[&_.ProseMirror_code]:text-sm',
                '[&_.ProseMirror_code]:text-[var(--color-clinical-blue)]',
                // Lists
                '[&_.ProseMirror_ul]:list-disc',
                '[&_.ProseMirror_ul]:pl-6',
                '[&_.ProseMirror_ul]:mb-4',
                '[&_.ProseMirror_ol]:list-decimal',
                '[&_.ProseMirror_ol]:pl-6',
                '[&_.ProseMirror_ol]:mb-4',
                '[&_.ProseMirror_li]:mb-1',
                // Links
                '[&_.ProseMirror_a]:text-[var(--color-clinical-blue)]',
                '[&_.ProseMirror_a]:underline',
                // HR
                '[&_.ProseMirror_hr]:border-[var(--border-default)]',
                '[&_.ProseMirror_hr]:my-8',
                // Task list
                '[&_.ProseMirror_ul[data-type="taskList"]]:list-none',
                '[&_.ProseMirror_ul[data-type="taskList"]]:pl-0',
                '[&_.ProseMirror_li[data-type="taskItem"]]:flex',
                '[&_.ProseMirror_li[data-type="taskItem"]]:items-start',
                '[&_.ProseMirror_li[data-type="taskItem"]]:gap-2',
                // Highlight
                '[&_.ProseMirror_mark]:bg-yellow-100',
                '[&_.ProseMirror_mark]:rounded',
                '[&_.ProseMirror_mark]:px-0.5',
              )}
            />

            {/* Slash command menu — rendered inside editor scroll container */}
            {!readOnly && (
              <SlashCommandMenu
                editor={editor}
                onInsertData={() => togglePanel('data')}
                onInsertCitation={() => togglePanel('citations')}
                onGenerate={() => setShowGenerateModal(true)}
              />
            )}

            {/* Floating selection toolbar */}
            {!readOnly && (
              <FloatingSelectionToolbar
                editor={editor}
                onInsertCitation={() => togglePanel('citations')}
                onAddComment={() => togglePanel('comments')}
              />
            )}
          </div>
        </div>

        {/* Right: Context panel */}
        {showRight && (
          <div className="w-[300px] shrink-0 border-l border-[var(--border-default)] bg-white flex flex-col overflow-hidden">
            {rightPanel === 'citations' && (
              <CitationPanel
                citations={citations}
                style={citationStyle}
                onStyleChange={setCitationStyle}
                onInsert={insertCitationIntoEditor}
                onRemove={removeCitation}
              />
            )}
            {rightPanel === 'data' && (
              <DataPanel
                projectId={projectId}
                onInsertTable={({ datasetId, versionId, datasetName }) => {
                  editor?.chain().focus().insertContent({
                    type: 'datasetTable',
                    attrs: { datasetId, versionId, datasetName },
                  }).run()
                  togglePanel('data')
                }}
                onInsertChart={({ explorationId, chartTitle, chartType, chartConfig, datasetId, versionId }) => {
                  editor?.chain().focus().insertContent({
                    type: 'chartEmbed',
                    attrs: { explorationId, chartTitle, chartType, chartConfig, datasetId, versionId },
                  }).run()
                  togglePanel('data')
                }}
              />
            )}
            {rightPanel === 'comments' && currentProfile && (
              <CommentsSidebar
                documentId={documentId}
                currentProfile={currentProfile}
                onClose={() => setRightPanel(null)}
              />
            )}
            {rightPanel === 'grammar' && editor && (
              <GrammarCheckPanel
                editor={editor}
                documentId={documentId}
                onClose={() => setRightPanel(null)}
              />
            )}
          </div>
        )}
      </div>

      {/* ── Status bar ──────────────────────────────────────────────────── */}
      <ComplianceStatusBar
        wordCount={wordCount}
        citationCount={citations.length}
        saving={saving}
        lastSaved={lastSaved}
        focusMode={focusMode}
        onToggleFocus={() => setFocusMode(p => !p)}
        documentType={documentType}
      />

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      {showGenerateModal && editor && (
        <GenerateSectionModal
          open={showGenerateModal}
          onClose={() => setShowGenerateModal(false)}
          editor={editor}
          documentId={documentId}
        />
      )}
    </div>
  )
}
