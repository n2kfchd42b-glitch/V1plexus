"use client"

import { useEffect, useRef, useState, useCallback } from 'react'
import { Bold, Italic, Underline, Link as LinkIcon, BookOpen, Sparkles, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Editor } from '@tiptap/react'

interface FloatingSelectionToolbarProps {
  editor: Editor | null
  onInsertCitation?: () => void
  onAddComment?: () => void
}

interface ToolbarPosition {
  top: number
  left: number
}

export function FloatingSelectionToolbar({ editor, onInsertCitation, onAddComment }: FloatingSelectionToolbarProps) {
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState<ToolbarPosition>({ top: 0, left: 0 })
  const [aiLoading, setAiLoading] = useState<string | null>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)

  const updatePosition = useCallback(() => {
    if (!editor) return
    const { from, to, empty } = editor.state.selection
    if (empty) { setVisible(false); return }

    const domFrom = editor.view.coordsAtPos(from)
    const domTo = editor.view.coordsAtPos(to)
    const editorRect = editor.view.dom.getBoundingClientRect()

    const midX = (domFrom.left + domTo.left) / 2 - editorRect.left
    const top = domFrom.top - editorRect.top - 44

    setPosition({
      top: Math.max(4, top),
      left: Math.min(Math.max(0, midX - 140), editorRect.width - 280),
    })
    setVisible(true)
  }, [editor])

  useEffect(() => {
    if (!editor) return
    const handler = () => {
      const { empty } = editor.state.selection
      if (empty) { setVisible(false) } else { updatePosition() }
    }
    editor.on('selectionUpdate', handler)
    editor.on('blur', () => setTimeout(() => {
      if (!toolbarRef.current?.contains(document.activeElement)) setVisible(false)
    }, 150))
    return () => { editor.off('selectionUpdate', handler) }
  }, [editor, updatePosition])

  async function handleAiAction(action: 'rephrase' | 'shorten' | 'expand') {
    if (!editor) return
    const { from, to } = editor.state.selection
    const selectedText = editor.state.doc.textBetween(from, to)
    if (!selectedText.trim()) return

    setAiLoading(action)
    try {
      const prompts: Record<string, string> = {
        rephrase: `Rephrase the following text for clarity and scientific precision, keeping the same meaning:\n\n"${selectedText}"\n\nReturn only the rephrased text.`,
        shorten: `Shorten the following text while preserving the key scientific meaning:\n\n"${selectedText}"\n\nReturn only the shortened text.`,
        expand: `Expand the following text with more scientific detail and context, appropriate for a research document:\n\n"${selectedText}"\n\nReturn only the expanded text.`,
      }

      const res = await fetch('/api/ai/transform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompts[action] }),
      })

      if (res.ok) {
        const { text } = await res.json()
        if (text) {
          editor.chain().focus().deleteRange({ from, to }).insertContentAt(from, text).run()
        }
      }
    } catch {
      // Silently fail — keep original text
    } finally {
      setAiLoading(null)
      setVisible(false)
    }
  }

  if (!visible || !editor) return null

  const isLinkActive = editor.isActive('link')

  const setLink = () => {
    const url = window.prompt('URL', editor.getAttributes('link').href ?? '')
    if (url === null) return
    if (url === '') {
      editor.chain().focus().unsetLink().run()
    } else {
      editor.chain().focus().setLink({ href: url }).run()
    }
    setVisible(false)
  }

  return (
    <div
      ref={toolbarRef}
      className="absolute z-40 flex items-center gap-0.5 bg-[#18181B] rounded-lg px-1.5 py-1 shadow-xl border border-white/10"
      style={{ top: position.top, left: position.left }}
      onMouseDown={e => e.preventDefault()}
    >
      {/* Formatting */}
      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={cn('h-7 w-7 flex items-center justify-center rounded text-white/80 hover:text-white hover:bg-white/10 transition-colors', editor.isActive('bold') && 'bg-white/20 text-white')}
        title="Bold"
      >
        <Bold className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={cn('h-7 w-7 flex items-center justify-center rounded text-white/80 hover:text-white hover:bg-white/10 transition-colors', editor.isActive('italic') && 'bg-white/20 text-white')}
        title="Italic"
      >
        <Italic className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        className={cn('h-7 w-7 flex items-center justify-center rounded text-white/80 hover:text-white hover:bg-white/10 transition-colors', editor.isActive('underline') && 'bg-white/20 text-white')}
        title="Underline"
      >
        <Underline className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={setLink}
        className={cn('h-7 w-7 flex items-center justify-center rounded text-white/80 hover:text-white hover:bg-white/10 transition-colors', isLinkActive && 'bg-white/20 text-white')}
        title="Link"
      >
        <LinkIcon className="h-3.5 w-3.5" />
      </button>

      {/* Divider */}
      <div className="h-4 w-px bg-white/20 mx-1" />

      {/* Citation */}
      {onInsertCitation && (
        <button
          onClick={() => { onInsertCitation(); setVisible(false) }}
          className="h-7 flex items-center gap-1 px-2 rounded text-white/80 hover:text-white hover:bg-white/10 transition-colors text-[11px] font-medium"
          title="Insert citation at cursor"
        >
          <BookOpen className="h-3.5 w-3.5" />
          Cite
        </button>
      )}

      {/* Comment */}
      {onAddComment && (
        <button
          onClick={() => { onAddComment(); setVisible(false) }}
          className="h-7 flex items-center gap-1 px-2 rounded text-white/80 hover:text-white hover:bg-white/10 transition-colors text-[11px] font-medium"
          title="Add comment"
        >
          <MessageSquare className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Divider */}
      <div className="h-4 w-px bg-white/20 mx-1" />

      {/* AI actions */}
      {(['rephrase', 'shorten', 'expand'] as const).map(action => (
        <button
          key={action}
          onClick={() => handleAiAction(action)}
          disabled={!!aiLoading}
          className="h-7 flex items-center gap-1 px-2 rounded text-purple-300 hover:text-purple-100 hover:bg-white/10 transition-colors text-[11px] font-medium disabled:opacity-50 capitalize"
          title={`AI: ${action} selection`}
        >
          {aiLoading === action ? (
            <span className="h-3.5 w-3.5 rounded-full border-2 border-purple-300 border-t-transparent animate-spin" />
          ) : (
            <Sparkles className="h-3 w-3" />
          )}
          {action}
        </button>
      ))}
    </div>
  )
}
