"use client"

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Highlight from '@tiptap/extension-highlight'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Link from '@tiptap/extension-link'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableCell } from '@tiptap/extension-table-cell'
import { createClient } from '@/lib/supabase/client'
import { saveDocumentContent, updateDocumentTitle } from '@/lib/data'
import { SlashCommandMenu } from './SlashCommandMenu'
import { FloatingSelectionToolbar } from './FloatingSelectionToolbar'
import { DocumentOutline } from './DocumentOutline'
import { CitationPanel } from './CitationPanel'
import { DatasetTableExtension } from './extensions/DatasetTableNode'
import { ChartNodeExtension } from './extensions/ChartNode'
import { CitationNodeExtension, buildCitationAttrs } from './extensions/CitationNode'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Plus, Loader2, X, BookOpen,
  AlignLeft, Maximize2, Minimize2, MessageSquare,
} from 'lucide-react'
import { CommentsSidebar } from './CommentsSidebar'
import type { Profile } from '@/types/database'
import type { CslCitation } from '@/components/publication/CitationSearch'

type RightPanel = 'citations' | 'comments' | null
type ReferenceStyle = 'vancouver' | 'apa7' | 'harvard' | 'numbered'

function extractText(node: Record<string, unknown>): string {
  let text = ''
  if (node.type === 'text' && typeof node.text === 'string') text += node.text + ' '
  if (Array.isArray(node.content)) {
    for (const child of node.content as Record<string, unknown>[]) text += extractText(child)
  }
  return text
}

function extractCitationsFromContent(content: Record<string, unknown> | null | undefined): CslCitation[] {
  const found: Array<{ num: number; citation: CslCitation }> = []
  function walk(node: Record<string, unknown>) {
    if (node.type === 'citation') {
      const attrs = node.attrs as Record<string, unknown> | undefined
      if (attrs?.citationData) {
        try {
          const citation = JSON.parse(attrs.citationData as string) as CslCitation
          found.push({ num: (attrs.num as number) ?? found.length + 1, citation })
        } catch { /* skip malformed */ }
      }
    }
    if (Array.isArray(node.content)) {
      for (const child of node.content as Record<string, unknown>[]) walk(child)
    }
  }
  if (content) walk(content)
  const seen = new Set<string>()
  const unique: CslCitation[] = []
  for (const { citation } of found.sort((a, b) => a.num - b.num)) {
    const key = citation.DOI ?? citation.title
    if (!seen.has(key)) { seen.add(key); unique.push(citation) }
  }
  return unique
}

function readingTime(words: number): string {
  return `${Math.max(1, Math.round(words / 200))} min`
}

interface MinimalEditorProps {
  documentId: string
  projectId: string
  initialTitle: string
  initialContent?: Record<string, unknown> | null
  onSave?: (content: Record<string, unknown>) => void
  onTitleSave?: (title: string) => void
  triggerSaveRef?: { current: (() => Promise<void>) | null }
  insertContentRef?: { current: ((html: string) => void) | null }
  closeEditorPanelRef?: { current: (() => void) | null }
  readOnly?: boolean
  canComment?: boolean
  canReadComments?: boolean
  onFocusModeChange?: (active: boolean) => void
  onEditorPanelOpen?: () => void
}

export function MinimalEditor({
  documentId,
  projectId,
  initialTitle,
  initialContent,
  onSave,
  onTitleSave,
  triggerSaveRef,
  insertContentRef,
  closeEditorPanelRef,
  readOnly = false,
  canComment = false,
  canReadComments = false,
  onFocusModeChange,
  onEditorPanelOpen,
}: MinimalEditorProps) {
  const [title, setTitle] = useState(initialTitle)
  const [titleFocused, setTitleFocused] = useState(false)
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [wordCount, setWordCount] = useState(0)
  const [rightPanel, setRightPanel] = useState<RightPanel>(null)
  const [outlineOpen, setOutlineOpen] = useState(false)
  const [outlineCollapsed, setOutlineCollapsed] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
  const [citations, setCitations] = useState<CslCitation[]>(() => extractCitationsFromContent(initialContent))
  const [citationStyle, setCitationStyle] = useState<ReferenceStyle>('vancouver')

  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null)
  const [pendingAnchor, setPendingAnchor] = useState<string | null>(null)

  const saveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const handleAutoSaveRef = useRef<((content: Record<string, unknown>) => Promise<void>) | null>(null)
  const supabase = useMemo(() => createClient(), [])

  const handleAutoSave = useCallback(async (content: Record<string, unknown>) => {
    setSaving(true)
    try {
      const plain = extractText(content).trim()
      const wc = plain ? plain.split(/\s+/).filter(Boolean).length : 0
      setWordCount(wc)
      const result = await saveDocumentContent(supabase, documentId, content, wc)
      if (result.status === 'error') throw new Error(result.error ?? 'Save failed')
      setLastSaved(new Date())
      onSave?.(content)
    } catch {
      toast.error('Failed to save document')
    } finally {
      setSaving(false)
    }
  }, [documentId, supabase, onSave])

  useEffect(() => { handleAutoSaveRef.current = handleAutoSave }, [handleAutoSave])

  useEffect(() => {
    if (!canComment) return
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('*').eq('id', user.id).single()
        .then(({ data }) => { if (data) setCurrentProfile(data as Profile) })
    })
  }, [canComment, supabase])

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
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
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
    const onKey = (e: KeyboardEvent) => {
      const cmd = e.metaKey || e.ctrlKey
      if (cmd && e.key === 's') { e.preventDefault(); handleManualSave() }
      if (cmd && e.key === '\\') { e.preventDefault(); toggleFocus() }
      if (e.key === 'Escape' && focusMode) { e.preventDefault(); toggleFocus() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleManualSave, focusMode]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }, [])

  const toggleFocus = () => {
    setFocusMode(p => {
      const next = !p
      onFocusModeChange?.(next)
      if (next) {
        setRightPanel(null)
        setOutlineOpen(false)
      }
      return next
    })
  }

  const handleTitleBlur = async () => {
    setTitleFocused(false)
    if (title !== initialTitle) {
      await updateDocumentTitle(supabase, documentId, title)
      onTitleSave?.(title)
    }
  }

  const insertCitation = useCallback((citation: CslCitation) => {
    if (!editor) return
    const exists = citations.find(c => c.DOI && c.DOI === citation.DOI)
    if (exists) {
      const num = citations.indexOf(exists) + 1
      editor.chain().focus().insertContent({
        type: 'citation',
        attrs: buildCitationAttrs(citation, num, citationStyle),
      }).run()
    } else {
      const next = [...citations, citation]
      editor.chain().focus().insertContent({
        type: 'citation',
        attrs: buildCitationAttrs(citation, next.length, citationStyle),
      }).run()
      setCitations(next)
    }
  }, [editor, citationStyle, citations])

  const toggleRightPanel = (panel: RightPanel) => {
    setRightPanel(p => {
      const next = p === panel ? null : panel
      if (next !== null) onEditorPanelOpen?.()
      return next
    })
    setOutlineOpen(false)
  }

  useEffect(() => {
    if (!closeEditorPanelRef) return
    closeEditorPanelRef.current = () => setRightPanel(null)
    return () => { closeEditorPanelRef.current = null }
  }, [closeEditorPanelRef])

  return (
    <div className="flex h-full bg-bg-app overflow-hidden">

      {/* ── Writing area ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto relative min-w-0">

        <main className={cn('pb-48 px-6', focusMode ? 'pt-10' : 'pt-10')}>
          <div className="max-w-[720px] mx-auto relative">
            <article className="relative">

              {/* Floating + gutter button */}
              {!readOnly && !focusMode && (
                <div className="absolute -left-10 top-1">
                  <button
                    className="w-7 h-7 rounded-full flex items-center justify-center text-text-tertiary hover:text-text-secondary hover:bg-bg-surface-hover transition-all duration-fast"
                    title="Insert block (/)"
                    onClick={() => editor?.chain().focus().insertContent('/').run()}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {/* Ghost editable title */}
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                onFocus={() => setTitleFocused(true)}
                onBlur={handleTitleBlur}
                placeholder="Untitled"
                readOnly={readOnly}
                className={cn(
                  'w-full bg-transparent border-none outline-none ring-0 focus:ring-0',
                  'font-manrope text-[2.5rem] font-extrabold tracking-tight leading-tight',
                  'text-text-primary mb-10 block',
                  'transition-opacity duration-300',
                  !title && !titleFocused ? 'opacity-[0.15]' : 'opacity-100',
                  'placeholder:text-text-primary placeholder:opacity-[0.15]',
                )}
              />

              {/* Editor body */}
              <div className="relative">
                <EditorContent
                  editor={editor}
                  className={cn(
                    '[&_.ProseMirror]:min-h-[40vh]',
                    '[&_.ProseMirror]:text-[16px]',
                    '[&_.ProseMirror]:leading-[1.8]',
                    '[&_.ProseMirror]:[font-family:var(--font-document)]',
                    '[&_.ProseMirror]:text-text-primary',
                    '[&_.ProseMirror_p]:mb-3',
                    '[&_.ProseMirror_h1]:font-manrope [&_.ProseMirror_h1]:font-extrabold [&_.ProseMirror_h1]:tracking-tight [&_.ProseMirror_h1]:mt-8 [&_.ProseMirror_h1]:mb-3',
                    '[&_.ProseMirror_h2]:font-manrope [&_.ProseMirror_h2]:font-bold [&_.ProseMirror_h2]:tracking-tight [&_.ProseMirror_h2]:mt-6 [&_.ProseMirror_h2]:mb-2',
                    '[&_.ProseMirror_h3]:font-manrope [&_.ProseMirror_h3]:font-semibold [&_.ProseMirror_h3]:mt-4 [&_.ProseMirror_h3]:mb-1.5',
                    // Table styles
                    '[&_.ProseMirror_table]:w-full [&_.ProseMirror_table]:border-collapse [&_.ProseMirror_table]:my-4 [&_.ProseMirror_table]:font-sans [&_.ProseMirror_table]:text-sm',
                    '[&_.ProseMirror_th]:border [&_.ProseMirror_th]:border-border-default [&_.ProseMirror_th]:px-3 [&_.ProseMirror_th]:py-2 [&_.ProseMirror_th]:bg-bg-inset [&_.ProseMirror_th]:text-left [&_.ProseMirror_th]:font-semibold [&_.ProseMirror_th]:text-text-secondary [&_.ProseMirror_th]:text-xs [&_.ProseMirror_th]:uppercase [&_.ProseMirror_th]:tracking-wide',
                    '[&_.ProseMirror_td]:border [&_.ProseMirror_td]:border-border-default [&_.ProseMirror_td]:px-3 [&_.ProseMirror_td]:py-1.5 [&_.ProseMirror_td]:text-text-primary [&_.ProseMirror_td]:text-[14px] [&_.ProseMirror_td]:font-mono [&_.ProseMirror_td]:tabular-nums',
                    '[&_.ProseMirror_tr:nth-child(even)]:bg-bg-app',
                  )}
                />

                {!readOnly && (
                  <>
                    <SlashCommandMenu
                      editor={editor}
                      onInsertCitation={() => { setRightPanel('citations'); setOutlineOpen(false) }}
                    />
                    <FloatingSelectionToolbar
                      editor={editor}
                      onInsertCitation={() => setRightPanel('citations')}
                      onAddComment={() => {}}
                    />
                  </>
                )}
                {readOnly && canComment && (
                  <FloatingSelectionToolbar
                    editor={editor}
                    commentOnly
                    onAddComment={() => {
                      const sel = editor?.state.selection
                      if (sel && !sel.empty) {
                        const text = editor.state.doc.textBetween(sel.from, sel.to, ' ')
                        setPendingAnchor(text || null)
                      }
                      setRightPanel('comments')
                      setOutlineOpen(false)
                    }}
                  />
                )}
              </div>
            </article>

          </div>
        </main>

        {/* Focus mode exit hint */}
        {focusMode && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
            <button
              onClick={toggleFocus}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-sidebar)] text-white/60 text-[11px] font-manrope uppercase tracking-widest hover:text-white transition-colors"
            >
              <Minimize2 className="h-3 w-3" />
              ESC — exit focus
            </button>
          </div>
        )}
      </div>

      {/* ── Outline sidebar — right side ────────────────────────────────── */}
      {outlineOpen && !focusMode && (
        <DocumentOutline
          editor={editor}
          collapsed={outlineCollapsed}
          onToggle={() => setOutlineCollapsed(p => !p)}
        />
      )}

      {/* ── Right strip + panels ─────────────────────────────────────────── */}
      {!focusMode && (
        rightPanel ? (
          /* Expanded panel */
          <div className="w-[280px] shrink-0 bg-bg-surface flex flex-col overflow-hidden border-l border-border-subtle animate-slide-in-right">
            {rightPanel !== 'comments' && (
              <div className="h-10 flex items-center justify-between px-4 border-b border-border-subtle shrink-0">
                <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                  {rightPanel === 'citations' ? `Citations${citations.length > 0 ? ` · ${citations.length}` : ''}` : 'Panel'}
                </span>
                <button
                  onClick={() => setRightPanel(null)}
                  className="h-6 w-6 flex items-center justify-center rounded text-text-tertiary hover:text-text-primary hover:bg-bg-surface-hover transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <div className="flex-1 overflow-hidden">
              {rightPanel === 'citations' && (
                <CitationPanel
                  citations={citations}
                  style={citationStyle}
                  onStyleChange={setCitationStyle}
                  onInsert={insertCitation}
                  onRemove={(idx) => setCitations(prev => prev.filter((_, i) => i !== idx))}
                />
              )}
              {rightPanel === 'comments' && (
                <CommentsSidebar
                  documentId={documentId}
                  currentProfile={currentProfile}
                  onClose={() => setRightPanel(null)}
                  pendingAnchorText={pendingAnchor}
                  onClearPending={() => setPendingAnchor(null)}
                />
              )}
            </div>
          </div>
        ) : (
          /* Collapsed icon strip */
          <div className="w-10 shrink-0 flex flex-col items-center py-4 gap-1 border-l border-border-subtle bg-bg-app">
            {!readOnly && (
              <button
                onClick={() => toggleRightPanel('citations')}
                className="relative h-7 w-7 flex items-center justify-center rounded text-text-tertiary/50 hover:text-text-primary hover:bg-bg-surface-hover transition-colors"
                title="Citations (⌘+/)"
              >
                <BookOpen className="h-3.5 w-3.5" />
                {citations.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-accent-blue text-white text-[8px] font-black flex items-center justify-center leading-none">
                    {citations.length}
                  </span>
                )}
              </button>
            )}
            {(canComment || canReadComments) && (
              <button
                onClick={() => toggleRightPanel('comments')}
                className="h-7 w-7 flex items-center justify-center rounded text-text-tertiary/50 hover:text-text-primary hover:bg-bg-surface-hover transition-colors"
                title={canComment ? 'Comments' : 'Supervisor Comments'}
              >
                <MessageSquare className="h-3.5 w-3.5" />
              </button>
            )}
            <div className="flex-1" />

            <button
              onClick={() => {
                setOutlineOpen(p => !p)
                setRightPanel(null)
              }}
              className={cn(
                'h-7 w-7 flex items-center justify-center rounded transition-colors',
                outlineOpen ? 'text-accent-blue bg-accent-blue-subtle' : 'text-text-tertiary/50 hover:text-text-primary hover:bg-bg-surface-hover'
              )}
              title="Outline"
            >
              <AlignLeft className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={toggleFocus}
              className="h-7 w-7 flex items-center justify-center rounded text-text-tertiary/50 hover:text-text-primary hover:bg-bg-surface-hover transition-colors"
              title="Focus mode (⌘\\)"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )
      )}

      {/* ── Minimal footer ──────────────────────────────────────────────── */}
      {!focusMode && (
        <footer className="absolute bottom-6 right-4 z-40 flex items-center gap-3 text-text-tertiary text-[10px] font-manrope uppercase tracking-widest pointer-events-none">
          <span>{wordCount.toLocaleString()} words</span>
          <span className="w-[3px] h-[3px] rounded-full bg-border-default" />
          <span>{readingTime(wordCount)} read</span>
          {(saving || lastSaved) && (
            <>
              <span className="w-[3px] h-[3px] rounded-full bg-border-default" />
              <span className={cn(
                'font-bold flex items-center gap-1 transition-colors',
                saving ? 'text-text-tertiary' : 'text-phase-data'
              )}>
                {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                {saving ? 'Saving…' : 'Autosaved'}
              </span>
            </>
          )}
        </footer>
      )}

    </div>
  )
}
