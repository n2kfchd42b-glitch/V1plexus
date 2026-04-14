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
import { SlashCommandMenu } from './SlashCommandMenu'
import { FloatingSelectionToolbar } from './FloatingSelectionToolbar'
import { DocumentOutline } from './DocumentOutline'
import { CitationPanel } from './CitationPanel'
import { DataPanel } from './DataPanel'
import { DatasetTableExtension } from './extensions/DatasetTableNode'
import { ChartNodeExtension } from './extensions/ChartNode'
import { TableBlockNodeExtension } from './extensions/TableBlockNode'
import { CitationNodeExtension, buildCitationAttrs } from './extensions/CitationNode'
import { GenerateSectionModal } from '@/components/ai/GenerateSectionModal'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Plus, Loader2, X, BookOpen, BarChart2, Sparkles,
  AlignLeft, Maximize2, Minimize2,
} from 'lucide-react'
import type { CslCitation } from '@/components/publication/CitationSearch'

type RightPanel = 'citations' | 'data' | null
type ReferenceStyle = 'vancouver' | 'apa7' | 'harvard' | 'numbered'

function extractText(node: Record<string, unknown>): string {
  let text = ''
  if (node.type === 'text' && typeof node.text === 'string') text += node.text + ' '
  if (Array.isArray(node.content)) {
    for (const child of node.content as Record<string, unknown>[]) text += extractText(child)
  }
  return text
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
  readOnly?: boolean
  onFocusModeChange?: (active: boolean) => void
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
  readOnly = false,
  onFocusModeChange,
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
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [citations, setCitations] = useState<CslCitation[]>([])
  const [citationStyle, setCitationStyle] = useState<ReferenceStyle>('vancouver')

  const saveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const handleAutoSaveRef = useRef<((content: Record<string, unknown>) => Promise<void>) | null>(null)
  const supabase = useMemo(() => createClient(), [])

  const handleAutoSave = useCallback(async (content: Record<string, unknown>) => {
    setSaving(true)
    try {
      const plain = extractText(content).trim()
      const wc = plain ? plain.split(/\s+/).filter(Boolean).length : 0
      setWordCount(wc)
      const { error } = await supabase
        .from('documents')
        .update({ content, word_count: wc, updated_at: new Date().toISOString() })
        .eq('id', documentId)
      if (error) throw error
      setLastSaved(new Date())
      onSave?.(content)
    } catch {
      toast.error('Failed to save document')
    } finally {
      setSaving(false)
    }
  }, [documentId, supabase, onSave])

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
      await supabase.from('documents').update({ title }).eq('id', documentId)
      onTitleSave?.(title)
    }
  }

  const insertCitation = useCallback((citation: CslCitation) => {
    if (!editor) return
    setCitations(prev => {
      const exists = prev.find(c => c.DOI && c.DOI === citation.DOI)
      if (exists) {
        editor.chain().focus().insertContent({
          type: 'citation',
          attrs: buildCitationAttrs(citation, prev.indexOf(exists) + 1, citationStyle),
        }).run()
        return prev
      }
      const next = [...prev, citation]
      editor.chain().focus().insertContent({
        type: 'citation',
        attrs: buildCitationAttrs(citation, next.length, citationStyle),
      }).run()
      return next
    })
  }, [editor, citationStyle])

  const toggleRightPanel = (panel: RightPanel) =>
    setRightPanel(p => p === panel ? null : panel)

  return (
    <div className="flex h-full bg-bg-app overflow-hidden">

      {/* ── Outline sidebar ─────────────────────────────────────────────── */}
      {outlineOpen && !focusMode && (
        <DocumentOutline
          editor={editor}
          collapsed={outlineCollapsed}
          onToggle={() => setOutlineCollapsed(p => !p)}
        />
      )}

      {/* ── Writing area ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto relative min-w-0">

        {/* Outline toggle — left gutter button */}
        {!focusMode && (
          <button
            onClick={() => setOutlineOpen(p => !p)}
            className={cn(
              'fixed left-6 top-1/2 -translate-y-1/2 z-30 hidden lg:flex flex-col gap-[5px] py-2 px-1 rounded transition-colors group',
              outlineOpen ? 'text-accent-blue' : 'text-text-tertiary/40 hover:text-text-secondary'
            )}
            title="Toggle outline (⌘\\)"
          >
            <div className={cn('h-[1.5px] rounded-full transition-all bg-current', outlineOpen ? 'w-4' : 'w-4')} />
            <div className={cn('h-[1.5px] rounded-full transition-all bg-current', outlineOpen ? 'w-4' : 'w-3')} />
            <div className={cn('h-[1.5px] rounded-full transition-all bg-current', outlineOpen ? 'w-4' : 'w-2')} />
          </button>
        )}

        <main className={cn('pb-48 px-6', focusMode ? 'pt-16' : 'pt-28')}>
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
                    '[&_.ProseMirror]:text-[17px]',
                    '[&_.ProseMirror]:leading-[1.9]',
                    '[&_.ProseMirror]:font-serif',
                    '[&_.ProseMirror]:text-text-primary',
                    '[&_.ProseMirror_h1]:font-manrope [&_.ProseMirror_h1]:font-extrabold [&_.ProseMirror_h1]:tracking-tight',
                    '[&_.ProseMirror_h2]:font-manrope [&_.ProseMirror_h2]:font-bold [&_.ProseMirror_h2]:tracking-tight',
                    '[&_.ProseMirror_h3]:font-manrope [&_.ProseMirror_h3]:font-semibold',
                  )}
                />

                {!readOnly && (
                  <>
                    <SlashCommandMenu
                      editor={editor}
                      onInsertData={() => { setRightPanel('data'); setOutlineOpen(false) }}
                      onInsertCitation={() => { setRightPanel('citations'); setOutlineOpen(false) }}
                      onGenerate={() => setShowGenerateModal(true)}
                    />
                    <FloatingSelectionToolbar
                      editor={editor}
                      onInsertCitation={() => setRightPanel('citations')}
                      onAddComment={() => {}}
                    />
                  </>
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
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#18181B] text-white/60 text-[11px] font-manrope uppercase tracking-widest hover:text-white transition-colors"
            >
              <Minimize2 className="h-3 w-3" />
              ESC — exit focus
            </button>
          </div>
        )}
      </div>

      {/* ── Right strip + panels ─────────────────────────────────────────── */}
      {!focusMode && (
        rightPanel ? (
          /* Expanded panel */
          <div className="w-[280px] shrink-0 bg-bg-surface flex flex-col overflow-hidden border-l border-border-subtle animate-slide-in-right">
            <div className="h-10 flex items-center justify-between px-4 border-b border-border-subtle shrink-0">
              <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                {rightPanel === 'citations' ? `Citations${citations.length > 0 ? ` · ${citations.length}` : ''}` : 'Data'}
              </span>
              <button
                onClick={() => setRightPanel(null)}
                className="h-6 w-6 flex items-center justify-center rounded text-text-tertiary hover:text-text-primary hover:bg-bg-surface-hover transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
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
              {rightPanel === 'data' && (
                <DataPanel
                  projectId={projectId}
                  onInsertTable={({ datasetId, versionId, datasetName }) => {
                    editor?.chain().focus().insertContent({
                      type: 'datasetTable',
                      attrs: { datasetId, versionId, datasetName },
                    }).run()
                    setRightPanel(null)
                  }}
                  onInsertChart={({ explorationId, chartTitle, chartType, chartConfig, datasetId, versionId }) => {
                    editor?.chain().focus().insertContent({
                      type: 'chartEmbed',
                      attrs: { explorationId, chartTitle, chartType, chartConfig, datasetId, versionId },
                    }).run()
                    setRightPanel(null)
                  }}
                />
              )}
            </div>
          </div>
        ) : (
          /* Collapsed icon strip */
          <div className="w-10 shrink-0 flex flex-col items-center py-4 gap-1 border-l border-border-subtle bg-bg-app">
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
            <button
              onClick={() => toggleRightPanel('data')}
              className="h-7 w-7 flex items-center justify-center rounded text-text-tertiary/50 hover:text-text-primary hover:bg-bg-surface-hover transition-colors"
              title="Data & charts"
            >
              <BarChart2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setShowGenerateModal(true)}
              className="h-7 w-7 flex items-center justify-center rounded text-text-tertiary/50 hover:text-phase-data hover:bg-bg-surface-hover transition-colors"
              title="AI Generate (⌘J)"
            >
              <Sparkles className="h-3.5 w-3.5" />
            </button>

            <div className="flex-1" />

            <button
              onClick={() => setOutlineOpen(p => !p)}
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
        <footer className="fixed bottom-6 right-14 z-40 flex items-center gap-3 text-text-tertiary text-[10px] font-manrope uppercase tracking-widest pointer-events-none">
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

      {/* ── Generate modal ──────────────────────────────────────────────── */}
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
