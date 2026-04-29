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
import { DocumentOutline } from './DocumentOutline'
import { CitationPanel } from './CitationPanel'
import { SlashCommandMenu } from './SlashCommandMenu'
import { FloatingSelectionToolbar } from './FloatingSelectionToolbar'
import { ComplianceStatusBar } from './ComplianceStatusBar'
import { CommentsSidebar } from './CommentsSidebar'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { Profile } from '@/types/database'
import type { CslCitation } from '@/components/publication/CitationSearch'
import { DatasetTableExtension } from './extensions/DatasetTableNode'
import { ChartNodeExtension } from './extensions/ChartNode'
import { CitationNodeExtension, buildCitationAttrs } from './extensions/CitationNode'
import {
  BookOpen, MessageSquare,
  PanelLeftClose, PanelLeftOpen,
} from 'lucide-react'

type RightPanel = 'citations' | 'data' | 'comments' | null
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
  insertContentRef?: { current: ((html: string) => void) | null }
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
  insertContentRef,
  readOnly = false,
  documentType = 'general',
}: CollaborativeEditorProps) {
  const [rightPanel, setRightPanel] = useState<RightPanel>(null)
  const [outlineCollapsed, setOutlineCollapsed] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
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

  useEffect(() => {
    if (!insertContentRef) return
    insertContentRef.current = (html: string) => {
      editor?.chain().focus().insertContent(html).run()
    }
    return () => { insertContentRef.current = null }
  }, [insertContentRef, editor])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const cmd = e.metaKey || e.ctrlKey
      if (cmd && e.key === 's') { e.preventDefault(); handleManualSave() }
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
      {/* ── Minimal icon strip ──────────────────────────────────────────── */}
      {!readOnly && !focusMode && (
        <div className="shrink-0 h-9 flex items-center px-3 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)]">
          {/* Left: outline toggle */}
          <button
            onClick={() => setOutlineCollapsed(p => !p)}
            className="h-6 w-6 flex items-center justify-center rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors"
            title={outlineCollapsed ? 'Show outline' : 'Hide outline'}
          >
            {outlineCollapsed ? <PanelLeftOpen className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}
          </button>

          <div className="flex-1" />

          {/* Right: panel toggles + AI assist */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => togglePanel('citations')}
              className={cn(
                'h-6 w-6 flex items-center justify-center rounded transition-colors relative',
                panelActive('citations')
                  ? 'bg-[var(--accent-blue-subtle)] text-[var(--accent-blue)]'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]'
              )}
              title="Citations"
            >
              <BookOpen className="h-3.5 w-3.5" />
              {citations.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-[var(--accent-blue)] text-white text-[8px] font-black flex items-center justify-center leading-none">
                  {citations.length}
                </span>
              )}
            </button>
            <button
              onClick={() => togglePanel('comments')}
              className={cn(
                'h-6 w-6 flex items-center justify-center rounded transition-colors',
                panelActive('comments')
                  ? 'bg-[var(--accent-blue-subtle)] text-[var(--accent-blue)]'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]'
              )}
              title="Comments"
            >
              <MessageSquare className="h-3.5 w-3.5" />
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

        {/* Center: Writing surface — paper-on-canvas */}
        <div className="flex-1 overflow-y-auto relative bg-[var(--bg-app)]">
          {/* Paper card */}
          <div className="max-w-[794px] mx-auto my-10 mb-20 bg-[var(--bg-surface)] rounded-sm shadow-[var(--shadow-md)]">
          {/* Slash command menu — positioned relative to editor container */}
          <div className="relative">
            <EditorContent
              editor={editor}
              className={cn(
                'min-h-full',
                '[&_.ProseMirror]:outline-none',
                '[&_.ProseMirror]:min-h-[calc(100vh-180px)]',
                '[&_.ProseMirror]:px-[96px]',
                '[&_.ProseMirror]:py-[80px]',
                '[&_.ProseMirror]:text-slate-800',
                '[&_.ProseMirror]:text-[17px]',
                '[&_.ProseMirror]:leading-[1.9]',
                // Placeholder
                '[&_.ProseMirror_p.is-editor-empty:first-child::before]:text-[var(--text-tertiary)]',
                '[&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]',
                '[&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left',
                '[&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none',
                '[&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0',
                // Headings
                '[&_.ProseMirror_h1]:font-black',
                '[&_.ProseMirror_h1]:text-4xl',
                '[&_.ProseMirror_h1]:tracking-tight',
                '[&_.ProseMirror_h1]:text-slate-900',
                '[&_.ProseMirror_h1]:mt-12',
                '[&_.ProseMirror_h1]:mb-6',
                '[&_.ProseMirror_h1]:leading-[1.1]',
                '[&_.ProseMirror_h2]:text-2xl',
                '[&_.ProseMirror_h2]:font-bold',
                '[&_.ProseMirror_h2]:text-slate-900',
                '[&_.ProseMirror_h2]:tracking-tight',
                '[&_.ProseMirror_h2]:mt-10',
                '[&_.ProseMirror_h2]:mb-4',
                '[&_.ProseMirror_h3]:text-lg',
                '[&_.ProseMirror_h3]:font-bold',
                '[&_.ProseMirror_h3]:text-slate-700',
                '[&_.ProseMirror_h3]:mt-8',
                '[&_.ProseMirror_h3]:mb-3',
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
                onInsertCitation={() => togglePanel('citations')}
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
          </div>{/* end paper card */}
        </div>

        {/* Right: Context panel */}
        {showRight && (
          <div className="w-[260px] shrink-0 bg-[var(--bg-surface)] flex flex-col overflow-hidden shadow-[var(--shadow-xl)]">
            {rightPanel === 'citations' && (
              <CitationPanel
                citations={citations}
                style={citationStyle}
                onStyleChange={setCitationStyle}
                onInsert={insertCitationIntoEditor}
                onRemove={removeCitation}
              />
            )}
            {rightPanel === 'comments' && currentProfile && (
              <CommentsSidebar
                documentId={documentId}
                currentProfile={currentProfile}
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

    </div>
  )
}
