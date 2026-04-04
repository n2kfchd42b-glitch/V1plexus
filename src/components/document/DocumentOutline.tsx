"use client"

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight, AlignLeft } from 'lucide-react'
import type { Editor } from '@tiptap/react'

interface HeadingItem {
  id: string
  level: number
  text: string
  pos: number
}

interface DocumentOutlineProps {
  editor: Editor | null
  collapsed: boolean
  onToggle: () => void
}

export function DocumentOutline({ editor, collapsed, onToggle }: DocumentOutlineProps) {
  const [headings, setHeadings] = useState<HeadingItem[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    if (!editor) return

    const update = () => {
      const items: HeadingItem[] = []
      editor.state.doc.forEach((node, offset) => {
        if (node.type.name === 'heading') {
          items.push({
            id: `h-${offset}`,
            level: node.attrs.level as number,
            text: node.textContent,
            pos: offset,
          })
        }
      })
      setHeadings(items)
    }

    update()
    editor.on('update', update)
    return () => { editor.off('update', update) }
  }, [editor])

  const scrollToHeading = (pos: number, id: string) => {
    if (!editor) return
    editor.commands.setTextSelection(pos + 1)
    editor.commands.scrollIntoView()
    setActiveId(id)
  }

  return (
    <div
      className={cn(
        'flex flex-col border-r border-[var(--border-default)] bg-[var(--bg-app)] shrink-0 transition-all duration-200',
        collapsed ? 'w-10' : 'w-52'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-3 border-b border-[var(--border-default)]">
        {!collapsed && (
          <div className="flex items-center gap-1.5 pl-1">
            <AlignLeft className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
            <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">Outline</span>
          </div>
        )}
        <button
          onClick={onToggle}
          className={cn(
            'h-6 w-6 flex items-center justify-center rounded-md hover:bg-[var(--border-default)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors',
            collapsed && 'mx-auto'
          )}
          title={collapsed ? 'Expand outline' : 'Collapse outline'}
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Headings */}
      {!collapsed && (
        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {headings.length === 0 ? (
            <p className="text-[10px] text-[var(--text-tertiary)] text-center pt-6 leading-relaxed px-2">
              Headings appear here as you write
            </p>
          ) : (
            headings.map((h) => (
              <button
                key={h.id}
                onClick={() => scrollToHeading(h.pos, h.id)}
                className={cn(
                  'w-full text-left text-xs py-1 px-2 rounded-md transition-colors truncate leading-snug',
                  h.level === 1 && 'font-semibold text-[var(--text-primary)] pl-2',
                  h.level === 2 && 'font-medium text-[var(--text-secondary)] pl-4',
                  h.level === 3 && 'font-normal text-[var(--text-tertiary)] pl-6',
                  activeId === h.id
                    ? 'bg-blue-50 text-[var(--color-clinical-blue)]'
                    : 'hover:bg-[var(--border-default)]'
                )}
                title={h.text}
              >
                {h.text || <span className="italic opacity-50">Untitled</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
