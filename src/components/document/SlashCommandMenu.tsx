"use client"

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  Heading1, Heading2, Heading3, List, ListOrdered, Quote,
  Minus, Code, CheckSquare, BookOpen, Table2, BarChart2,
  Sparkles, FileText, Microscope, FlaskConical, PenLine, ClipboardList,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Editor } from '@tiptap/react'

interface SlashCommand {
  id: string
  label: string
  description: string
  icon: React.ReactNode
  category: string
  keywords: string[]
  action: (editor: Editor, onInsertData?: () => void, onInsertCitation?: () => void, onGenerate?: () => void) => void
}

const COMMANDS: SlashCommand[] = [
  // Structure
  {
    id: 'h1', label: 'Heading 1', description: 'Large section heading', icon: <Heading1 className="h-4 w-4" />,
    category: 'Structure', keywords: ['heading', 'h1', 'title'],
    action: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    id: 'h2', label: 'Heading 2', description: 'Subsection heading', icon: <Heading2 className="h-4 w-4" />,
    category: 'Structure', keywords: ['heading', 'h2', 'subtitle'],
    action: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    id: 'h3', label: 'Heading 3', description: 'Minor heading', icon: <Heading3 className="h-4 w-4" />,
    category: 'Structure', keywords: ['heading', 'h3'],
    action: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    id: 'bullet', label: 'Bullet List', description: 'Unordered list', icon: <List className="h-4 w-4" />,
    category: 'Structure', keywords: ['list', 'bullet', 'ul', 'unordered'],
    action: (e) => e.chain().focus().toggleBulletList().run(),
  },
  {
    id: 'ordered', label: 'Numbered List', description: 'Ordered list', icon: <ListOrdered className="h-4 w-4" />,
    category: 'Structure', keywords: ['list', 'numbered', 'ol', 'ordered'],
    action: (e) => e.chain().focus().toggleOrderedList().run(),
  },
  {
    id: 'quote', label: 'Blockquote', description: 'Quote or callout', icon: <Quote className="h-4 w-4" />,
    category: 'Structure', keywords: ['quote', 'blockquote', 'callout'],
    action: (e) => e.chain().focus().toggleBlockquote().run(),
  },
  {
    id: 'code', label: 'Code Block', description: 'Monospace code block', icon: <Code className="h-4 w-4" />,
    category: 'Structure', keywords: ['code', 'codeblock', 'mono'],
    action: (e) => e.chain().focus().toggleCodeBlock().run(),
  },
  {
    id: 'divider', label: 'Divider', description: 'Horizontal rule', icon: <Minus className="h-4 w-4" />,
    category: 'Structure', keywords: ['divider', 'hr', 'separator', 'rule'],
    action: (e) => e.chain().focus().setHorizontalRule().run(),
  },
  {
    id: 'task', label: 'Task List', description: 'Checkbox list', icon: <CheckSquare className="h-4 w-4" />,
    category: 'Structure', keywords: ['task', 'todo', 'checkbox', 'checklist'],
    action: (e) => e.chain().focus().toggleTaskList().run(),
  },
  // Research
  {
    id: 'cite', label: 'Insert Citation', description: 'Search CrossRef or import DOI', icon: <BookOpen className="h-4 w-4" />,
    category: 'Research', keywords: ['cite', 'citation', 'reference', 'doi', 'pubmed'],
    action: (_e, _od, onInsertCitation) => onInsertCitation?.(),
  },
  {
    id: 'table', label: 'Insert Data Table', description: 'Embed dataset from project', icon: <Table2 className="h-4 w-4" />,
    category: 'Research', keywords: ['table', 'data', 'dataset', 'insert'],
    action: (_e, onInsertData) => onInsertData?.(),
  },
  {
    id: 'chart', label: 'Insert Chart', description: 'Embed saved analysis chart', icon: <BarChart2 className="h-4 w-4" />,
    category: 'Research', keywords: ['chart', 'figure', 'graph', 'plot', 'analysis'],
    action: (_e, onInsertData) => onInsertData?.(),
  },
  {
    id: 'generate', label: 'AI Generate', description: 'Generate section with AI', icon: <Sparkles className="h-4 w-4" />,
    category: 'Research', keywords: ['ai', 'generate', 'write', 'assist'],
    action: (_e, _od, _oc, onGenerate) => onGenerate?.(),
  },
  // IMRAD Templates
  {
    id: 'introduction', label: 'Introduction', description: 'Scaffold introduction section', icon: <FileText className="h-4 w-4" />,
    category: 'Templates', keywords: ['introduction', 'intro', 'background', 'imrad'],
    action: (e) => {
      e.chain().focus()
        .insertContent([
          { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Introduction' }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Background' }] },
          { type: 'paragraph', content: [{ type: 'text', text: '' }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Rationale' }] },
          { type: 'paragraph', content: [{ type: 'text', text: '' }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Objectives' }] },
          { type: 'paragraph', content: [{ type: 'text', text: '' }] },
        ]).run()
    },
  },
  {
    id: 'methods', label: 'Methods', description: 'Scaffold methods section', icon: <Microscope className="h-4 w-4" />,
    category: 'Templates', keywords: ['methods', 'methodology', 'procedures', 'imrad'],
    action: (e) => {
      e.chain().focus()
        .insertContent([
          { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Methods' }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Study Design' }] },
          { type: 'paragraph', content: [{ type: 'text', text: '' }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Study Population' }] },
          { type: 'paragraph', content: [{ type: 'text', text: '' }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Data Collection' }] },
          { type: 'paragraph', content: [{ type: 'text', text: '' }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Statistical Analysis' }] },
          { type: 'paragraph', content: [{ type: 'text', text: '' }] },
        ]).run()
    },
  },
  {
    id: 'results', label: 'Results', description: 'Scaffold results section', icon: <FlaskConical className="h-4 w-4" />,
    category: 'Templates', keywords: ['results', 'findings', 'outcomes', 'imrad'],
    action: (e) => {
      e.chain().focus()
        .insertContent([
          { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Results' }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Participant Characteristics' }] },
          { type: 'paragraph', content: [{ type: 'text', text: '' }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Primary Outcomes' }] },
          { type: 'paragraph', content: [{ type: 'text', text: '' }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Secondary Outcomes' }] },
          { type: 'paragraph', content: [{ type: 'text', text: '' }] },
        ]).run()
    },
  },
  {
    id: 'discussion', label: 'Discussion', description: 'Scaffold discussion section', icon: <PenLine className="h-4 w-4" />,
    category: 'Templates', keywords: ['discussion', 'conclusion', 'limitations', 'imrad'],
    action: (e) => {
      e.chain().focus()
        .insertContent([
          { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Discussion' }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Summary of Findings' }] },
          { type: 'paragraph', content: [{ type: 'text', text: '' }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Interpretation' }] },
          { type: 'paragraph', content: [{ type: 'text', text: '' }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Limitations' }] },
          { type: 'paragraph', content: [{ type: 'text', text: '' }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Conclusion' }] },
          { type: 'paragraph', content: [{ type: 'text', text: '' }] },
        ]).run()
    },
  },
  {
    id: 'protocol', label: 'Protocol Template', description: 'Full research protocol outline', icon: <ClipboardList className="h-4 w-4" />,
    category: 'Templates', keywords: ['protocol', 'template', 'full', 'research'],
    action: (e) => {
      e.chain().focus()
        .insertContent([
          { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Research Protocol' }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '1. Background & Rationale' }] },
          { type: 'paragraph', content: [{ type: 'text', text: '' }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '2. Objectives' }] },
          { type: 'paragraph', content: [{ type: 'text', text: '' }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '3. Study Design' }] },
          { type: 'paragraph', content: [{ type: 'text', text: '' }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '4. Eligibility Criteria' }] },
          { type: 'paragraph', content: [{ type: 'text', text: '' }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '5. Interventions' }] },
          { type: 'paragraph', content: [{ type: 'text', text: '' }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '6. Outcomes' }] },
          { type: 'paragraph', content: [{ type: 'text', text: '' }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '7. Sample Size & Power' }] },
          { type: 'paragraph', content: [{ type: 'text', text: '' }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '8. Statistical Analysis' }] },
          { type: 'paragraph', content: [{ type: 'text', text: '' }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '9. Ethics & Consent' }] },
          { type: 'paragraph', content: [{ type: 'text', text: '' }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '10. References' }] },
          { type: 'paragraph', content: [{ type: 'text', text: '' }] },
        ]).run()
    },
  },
]

const CATEGORIES = ['Structure', 'Research', 'Templates']

interface SlashCommandMenuProps {
  editor: Editor | null
  onInsertData?: () => void
  onInsertCitation?: () => void
  onGenerate?: () => void
}

export function SlashCommandMenu({ editor, onInsertData, onInsertCitation, onGenerate }: SlashCommandMenuProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const menuRef = useRef<HTMLDivElement>(null)
  const slashPosRef = useRef<number | null>(null)

  const filtered = query
    ? COMMANDS.filter(c =>
        c.label.toLowerCase().includes(query.toLowerCase()) ||
        c.keywords.some(k => k.includes(query.toLowerCase()))
      )
    : COMMANDS

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!editor) return

    if (e.key === '/' && !open) {
      // Small delay to let the character appear in editor
      setTimeout(() => {
        const { from } = editor.state.selection
        slashPosRef.current = from - 1

        // Get cursor position for menu placement
        const domPos = editor.view.coordsAtPos(from)
        const editorRect = editor.view.dom.getBoundingClientRect()

        setPosition({
          top: domPos.bottom - editorRect.top + 8,
          left: Math.min(domPos.left - editorRect.left, editorRect.width - 320),
        })
        setQuery('')
        setSelectedIndex(0)
        setOpen(true)
      }, 10)
      return
    }

    if (!open) return

    if (e.key === 'Escape') {
      setOpen(false)
      slashPosRef.current = null
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(i => (i + 1) % filtered.length)
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(i => (i - 1 + filtered.length) % filtered.length)
      return
    }

    if (e.key === 'Enter' && filtered.length > 0) {
      e.preventDefault()
      executeCommand(filtered[selectedIndex])
      return
    }

    if (e.key === 'Backspace') {
      const { from } = editor.state.selection
      if (slashPosRef.current !== null && from <= slashPosRef.current + 1) {
        setOpen(false)
        slashPosRef.current = null
      }
    }
  }, [open, filtered, selectedIndex, editor]) // eslint-disable-line react-hooks/exhaustive-deps

  // Listen to editor input to update query
  useEffect(() => {
    if (!editor || !open) return

    const handler = () => {
      if (slashPosRef.current === null) return
      const { from } = editor.state.selection
      const textFrom = slashPosRef.current + 1
      if (from < textFrom) { setOpen(false); return }
      const text = editor.state.doc.textBetween(textFrom, from)
      setQuery(text)
      setSelectedIndex(0)
    }

    editor.on('update', handler)
    return () => { editor.off('update', handler) }
  }, [editor, open])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [handleKeyDown])

  // Close on click outside
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function executeCommand(cmd: SlashCommand) {
    if (!editor) return
    setOpen(false)

    // Delete the slash + query text
    if (slashPosRef.current !== null) {
      const { from } = editor.state.selection
      editor.chain().focus()
        .deleteRange({ from: slashPosRef.current, to: from })
        .run()
    }
    slashPosRef.current = null

    cmd.action(editor, onInsertData, onInsertCitation, onGenerate)
  }

  if (!open || filtered.length === 0) return null

  const grouped = CATEGORIES.map(cat => ({
    cat,
    items: filtered.filter(c => c.category === cat),
  })).filter(g => g.items.length > 0)

  return (
    <div
      ref={menuRef}
      className="absolute z-50 w-72 bg-white rounded-xl shadow-lg border border-[var(--border-default)] overflow-hidden"
      style={{ top: position.top, left: Math.max(0, position.left) }}
    >
      <div className="px-3 py-2 border-b border-[var(--border-default)]">
        <p className="text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
          {query ? `Commands matching "${query}"` : 'Insert block — type to filter'}
        </p>
      </div>
      <div className="max-h-72 overflow-y-auto py-1">
        {grouped.map(({ cat, items }) => (
          <div key={cat}>
            <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">{cat}</p>
            {items.map(cmd => {
              const globalIdx = filtered.indexOf(cmd)
              return (
                <button
                  key={cmd.id}
                  onMouseEnter={() => setSelectedIndex(globalIdx)}
                  onMouseDown={(e) => { e.preventDefault(); executeCommand(cmd) }}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 text-left transition-colors',
                    selectedIndex === globalIdx
                      ? 'bg-blue-50 text-[var(--color-clinical-blue)]'
                      : 'text-[var(--text-primary)] hover:bg-[var(--bg-app)]'
                  )}
                >
                  <span className={cn(
                    'shrink-0 p-1.5 rounded-md',
                    selectedIndex === globalIdx ? 'bg-blue-100 text-[var(--color-clinical-blue)]' : 'bg-[var(--bg-app)] text-[var(--text-secondary)]'
                  )}>
                    {cmd.icon}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium leading-none">{cmd.label}</p>
                    <p className={cn('text-[11px] mt-0.5', selectedIndex === globalIdx ? 'text-blue-400' : 'text-[var(--text-tertiary)]')}>
                      {cmd.description}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
