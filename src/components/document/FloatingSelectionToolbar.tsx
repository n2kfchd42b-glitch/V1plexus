"use client"

import { useEffect, useRef, useState, useCallback } from 'react'
import { Bold, Italic, Underline, Link as LinkIcon, BookOpen, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Editor } from '@tiptap/react'

interface FloatingSelectionToolbarProps {
  editor: Editor | null
  onInsertCitation?: () => void
  onAddComment?: () => void
  commentOnly?: boolean
}

interface ToolbarPosition {
  top: number
  left: number
}

export function FloatingSelectionToolbar({ editor, onInsertCitation, onAddComment, commentOnly = false }: FloatingSelectionToolbarProps) {
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState<ToolbarPosition>({ top: 0, left: 0 })
  const toolbarRef = useRef<HTMLDivElement>(null)
  const isPointerDownRef = useRef(false)

  const updatePosition = useCallback(() => {
    if (!editor) return
    const { from, to, empty } = editor.state.selection
    if (empty) { setVisible(false); return }

    const domFrom = editor.view.coordsAtPos(from)
    const domTo = editor.view.coordsAtPos(to)
    const editorRect = editor.view.dom.getBoundingClientRect()

    const midX = (domFrom.left + domTo.left) / 2 - editorRect.left
    const top = domFrom.top - editorRect.top - 48

    setPosition({
      top: Math.max(4, top),
      left: Math.min(Math.max(0, midX - 160), editorRect.width - 320),
    })
    setVisible(true)
  }, [editor])

  useEffect(() => {
    if (!editor) return

    const editorEl = editor.view.dom

    // Track pointer state — only show toolbar after pointer is released
    const onPointerDown = () => { isPointerDownRef.current = true }
    const onPointerUp = () => {
      isPointerDownRef.current = false
      // Small delay lets the selection finalize
      setTimeout(() => {
        const { empty } = editor.state.selection
        if (!empty) updatePosition()
      }, 30)
    }

    // Keyboard selection (Shift+Arrow) — show immediately since no pointer drag
    const onSelectionUpdate = () => {
      const { empty } = editor.state.selection
      if (empty) {
        setVisible(false)
        return
      }
      // Only auto-show for keyboard selections (not mouse drag)
      if (!isPointerDownRef.current) updatePosition()
    }

    const onBlur = () => {
      setTimeout(() => {
        if (!toolbarRef.current?.contains(document.activeElement)) {
          setVisible(false)
        }
      }, 150)
    }

    editorEl.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointerup', onPointerUp)
    editor.on('selectionUpdate', onSelectionUpdate)
    editor.on('blur', onBlur)

    return () => {
      editorEl.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', onPointerUp)
      editor.off('selectionUpdate', onSelectionUpdate)
      editor.off('blur', onBlur)
    }
  }, [editor, updatePosition])

  if (!visible || !editor) return null

  const setLink = () => {
    const url = window.prompt('URL', editor.getAttributes('link').href ?? '')
    if (url === null) return
    if (url === '') editor.chain().focus().unsetLink().run()
    else editor.chain().focus().setLink({ href: url }).run()
    setVisible(false)
  }

  const isH1 = editor.isActive('heading', { level: 1 })
  const isH2 = editor.isActive('heading', { level: 2 })
  const isH3 = editor.isActive('heading', { level: 3 })
  const isParagraph = !isH1 && !isH2 && !isH3

  if (commentOnly) {
    return (
      <div
        ref={toolbarRef}
        className="absolute z-40 flex items-center gap-0.5 bg-[var(--bg-sidebar)] rounded-lg px-1.5 py-1 shadow-xl"
        style={{ top: position.top, left: position.left }}
        onMouseDown={e => e.preventDefault()}
      >
        {onAddComment && (
          <button
            onClick={() => { onAddComment(); setVisible(false) }}
            className="h-7 flex items-center gap-1.5 px-2 rounded text-white/70 hover:text-white hover:bg-white/10 transition-colors text-[11px] font-medium"
            title="Add comment"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Comment
          </button>
        )}
      </div>
    )
  }

  return (
    <div
      ref={toolbarRef}
      className="absolute z-40 flex items-center gap-0.5 bg-[var(--bg-sidebar)] rounded-lg px-1.5 py-1 shadow-xl"
      style={{ top: position.top, left: position.left }}
      onMouseDown={e => e.preventDefault()}
    >
      {/* Block type — ¶ H1 H2 H3 */}
      <button
        onClick={() => editor.chain().focus().setParagraph().run()}
        className={cn('h-7 w-7 flex items-center justify-center rounded text-[11px] font-bold transition-colors',
          isParagraph ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white hover:bg-white/10')}
        title="Paragraph"
      >¶</button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={cn('h-7 w-7 flex items-center justify-center rounded text-[11px] font-bold transition-colors',
          isH1 ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white hover:bg-white/10')}
        title="Heading 1"
      >H1</button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={cn('h-7 w-7 flex items-center justify-center rounded text-[11px] font-bold transition-colors',
          isH2 ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white hover:bg-white/10')}
        title="Heading 2"
      >H2</button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={cn('h-7 w-7 flex items-center justify-center rounded text-[11px] font-bold transition-colors',
          isH3 ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white hover:bg-white/10')}
        title="Heading 3"
      >H3</button>

      <div className="h-4 w-px bg-white/15 mx-0.5" />

      {/* Inline formatting */}
      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={cn('h-7 w-7 flex items-center justify-center rounded text-white/80 hover:text-white hover:bg-white/10 transition-colors',
          editor.isActive('bold') && 'bg-white/20 text-white')}
        title="Bold (⌘B)"
      >
        <Bold className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={cn('h-7 w-7 flex items-center justify-center rounded text-white/80 hover:text-white hover:bg-white/10 transition-colors',
          editor.isActive('italic') && 'bg-white/20 text-white')}
        title="Italic (⌘I)"
      >
        <Italic className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        className={cn('h-7 w-7 flex items-center justify-center rounded text-white/80 hover:text-white hover:bg-white/10 transition-colors',
          editor.isActive('underline') && 'bg-white/20 text-white')}
        title="Underline (⌘U)"
      >
        <Underline className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={setLink}
        className={cn('h-7 w-7 flex items-center justify-center rounded text-white/80 hover:text-white hover:bg-white/10 transition-colors',
          editor.isActive('link') && 'bg-white/20 text-white')}
        title="Link"
      >
        <LinkIcon className="h-3.5 w-3.5" />
      </button>

      <div className="h-4 w-px bg-white/15 mx-0.5" />

      {/* Citation */}
      {onInsertCitation && (
        <button
          onClick={() => { onInsertCitation(); setVisible(false) }}
          className="h-7 flex items-center gap-1 px-2 rounded text-white/70 hover:text-white hover:bg-white/10 transition-colors text-[11px] font-medium"
          title="Insert citation"
        >
          <BookOpen className="h-3.5 w-3.5" />
          Cite
        </button>
      )}

      {onAddComment && (
        <button
          onClick={() => { onAddComment(); setVisible(false) }}
          className="h-7 w-7 flex items-center justify-center rounded text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          title="Add comment"
        >
          <MessageSquare className="h-3.5 w-3.5" />
        </button>
      )}

    </div>
  )
}
