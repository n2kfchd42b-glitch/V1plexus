'use client'

import { useState, useEffect } from 'react'
import { X, Plus, Trash2, FileText, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

// ── TipTap node types ──────────────────────────────────────────────────────────

interface TipTapNode {
  type: string
  attrs?: { level?: number; [key: string]: unknown }
  content?: TipTapNode[]
  text?: string
}

interface TipTapDoc {
  type: 'doc'
  content?: TipTapNode[]
}

// ── Domain types ───────────────────────────────────────────────────────────────

interface AbstractSection {
  id: string
  title: string
  content: string
  wordLimit: number
  wordCount: number
}

// ── Templates ──────────────────────────────────────────────────────────────────

const ABSTRACT_TEMPLATES = {
  default: {
    label: 'Standard (250 words)',
    sections: [
      { title: 'Background', wordLimit: 50 },
      { title: 'Methods', wordLimit: 75 },
      { title: 'Results', wordLimit: 75 },
      { title: 'Conclusions', wordLimit: 50 },
    ],
  },
  imrad: {
    label: 'IMRAD (300 words)',
    sections: [
      { title: 'Introduction', wordLimit: 50 },
      { title: 'Methods', wordLimit: 100 },
      { title: 'Results', wordLimit: 100 },
      { title: 'Analysis & Discussion', wordLimit: 50 },
    ],
  },
  nejm: {
    label: 'NEJM Style (250 words)',
    sections: [
      { title: 'Background', wordLimit: 50 },
      { title: 'Methods', wordLimit: 75 },
      { title: 'Results', wordLimit: 75 },
      { title: 'Conclusions', wordLimit: 50 },
    ],
  },
  plos: {
    label: 'PLOS ONE (300 words)',
    sections: [
      { title: 'Background', wordLimit: 50 },
      { title: 'Methodology', wordLimit: 100 },
      { title: 'Principal Findings', wordLimit: 100 },
      { title: 'Conclusions', wordLimit: 50 },
    ],
  },
} as const

type TemplateKey = keyof typeof ABSTRACT_TEMPLATES

// ── Section → keyword mapping ──────────────────────────────────────────────────
// Each entry maps a normalised section title to the keywords we look for in
// document headings. More-specific keywords rank higher than generic ones.

const SECTION_KEYWORDS: Record<string, string[]> = {
  'background':            ['background', 'rationale', 'context', 'overview', 'introduction', 'intro'],
  'introduction':          ['introduction', 'intro', 'background', 'rationale', 'context'],
  'methods':               ['method', 'methodology', 'approach', 'procedure', 'participant', 'sample', 'study design', 'data collection', 'measures', 'instrument'],
  'methodology':           ['methodology', 'method', 'approach', 'procedure', 'participant', 'sample', 'study design', 'data collection'],
  'results':               ['result', 'finding', 'outcome', 'data analysis'],
  'principal findings':    ['result', 'finding', 'outcome'],
  'discussion':            ['discussion', 'interpretation', 'implication'],
  'analysis & discussion': ['discussion', 'conclusion', 'interpretation', 'implication', 'analysis'],
  'conclusions':           ['conclusion', 'summary', 'implication', 'recommendation'],
}

// ── Deterministic extractor ────────────────────────────────────────────────────

/** Recursively pull all plain text from a TipTap node. */
function extractNodeText(node: TipTapNode): string {
  if (node.type === 'text') return node.text ?? ''
  if (!node.content) return ''
  const childText = node.content.map(extractNodeText).join('')
  // Add trailing space after block nodes so words from adjacent paragraphs
  // don't merge when we concatenate them.
  const isBlock = ['paragraph', 'heading', 'blockquote', 'listItem', 'bulletList', 'orderedList'].includes(node.type)
  return childText + (isBlock ? ' ' : '')
}

/**
 * Walk the top-level content of a TipTap doc and group paragraph text
 * under its nearest preceding heading.
 *
 * Returns a Map<lowercasedHeading, combinedParagraphText>.
 * The empty-string key '' collects text that appears before any heading.
 */
function buildHeadingMap(doc: TipTapDoc): Map<string, string> {
  const map = new Map<string, string>()
  let currentHeading = ''

  for (const node of doc.content ?? []) {
    if (node.type === 'heading') {
      currentHeading = extractNodeText(node).trim().toLowerCase()
      if (!map.has(currentHeading)) map.set(currentHeading, '')
    } else if (node.type === 'paragraph') {
      const text = extractNodeText(node).trim()
      if (text) {
        const existing = map.get(currentHeading) ?? ''
        map.set(currentHeading, existing ? `${existing} ${text}` : text)
      }
    }
  }

  return map
}

/** Truncate text to at most `wordLimit` words. */
function truncateToWordLimit(text: string, wordLimit: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length <= wordLimit) return text.trim()
  return words.slice(0, wordLimit).join(' ')
}

/**
 * Given a normalised section title and the heading map, find the heading whose
 * content best matches — scored by how many keywords appear in the heading text.
 */
function findBestMatch(sectionTitle: string, headingMap: Map<string, string>): string {
  const keywords = SECTION_KEYWORDS[sectionTitle] ?? [sectionTitle]

  // 1. Exact heading match
  const exact = headingMap.get(sectionTitle)
  if (exact) return exact

  // 2. Keyword scoring — pick the heading with the most keyword hits
  let bestScore = 0
  let bestText = ''

  for (const [heading, text] of headingMap) {
    let score = 0
    for (const kw of keywords) {
      if (heading.includes(kw)) score++
    }
    if (score > bestScore) {
      bestScore = score
      bestText = text
    }
  }

  return bestText
}

/**
 * Main extractor.  Given a TipTap document and the current template sections,
 * returns a map of sectionTitle → extracted text (capped at wordLimit).
 */
function extractAbstractFromDocument(
  documentContent: unknown,
  sections: ReadonlyArray<{ title: string; wordLimit: number }>,
): Map<string, string> {
  const result = new Map<string, string>()
  if (!documentContent || typeof documentContent !== 'object') return result

  const doc = documentContent as TipTapDoc
  if (doc.type !== 'doc' || !Array.isArray(doc.content)) return result

  const headingMap = buildHeadingMap(doc)
  if (headingMap.size === 0) return result

  for (const section of sections) {
    const rawText = findBestMatch(section.title.toLowerCase(), headingMap)
    if (rawText) {
      result.set(section.title, truncateToWordLimit(rawText, section.wordLimit))
    }
  }

  return result
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface StructuredAbstractModalProps {
  isOpen: boolean
  onClose: () => void
  onInsert: (abstract: string, sections: AbstractSection[]) => void
  /** The TipTap JSON content of the current document, used for auto-extraction. */
  documentContent?: unknown
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function buildSections(
  template: TemplateKey,
  content: unknown,
): AbstractSection[] {
  const templateSections = ABSTRACT_TEMPLATES[template].sections
  const extracted = extractAbstractFromDocument(content, templateSections)

  return templateSections.map((s, idx) => {
    const text = extracted.get(s.title) ?? ''
    return {
      id: `section-${idx}`,
      title: s.title,
      content: text,
      wordLimit: s.wordLimit,
      wordCount: text ? text.trim().split(/\s+/).filter(Boolean).length : 0,
    }
  })
}

// ── Component ──────────────────────────────────────────────────────────────────

export function StructuredAbstractModal({
  isOpen,
  onClose,
  onInsert,
  documentContent,
}: StructuredAbstractModalProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateKey>('default')
  const [sections, setSections] = useState<AbstractSection[]>(() =>
    buildSections('default', documentContent),
  )
  const [wasExtracted, setWasExtracted] = useState(false)

  // Re-build sections every time the modal opens so they reflect the latest
  // document content and the currently selected template.
  useEffect(() => {
    if (!isOpen) return
    const built = buildSections(selectedTemplate, documentContent)
    setSections(built)
    setWasExtracted(built.some(s => s.content.trim().length > 0))
  // Only re-run when the modal opens or document content changes — not on every
  // template change (that's handled by handleTemplateChange below).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, documentContent])

  const handleTemplateChange = (template: TemplateKey) => {
    setSelectedTemplate(template)
    const built = buildSections(template, documentContent)
    setSections(built)
    setWasExtracted(built.some(s => s.content.trim().length > 0))
  }

  const handleReExtract = () => {
    const built = buildSections(selectedTemplate, documentContent)
    setSections(built)
    const anyFilled = built.some(s => s.content.trim().length > 0)
    setWasExtracted(anyFilled)
    if (anyFilled) {
      toast.success('Re-extracted from document')
    } else {
      toast.info('No matching headings found in document')
    }
  }

  const handleSectionChange = (id: string, value: string) => {
    const wordCount = value.trim().split(/\s+/).filter(Boolean).length
    setSections(prev => prev.map(s => s.id === id ? { ...s, content: value, wordCount } : s))
  }

  const handleAddSection = () => {
    setSections(prev => [
      ...prev,
      { id: `section-${prev.length}`, title: 'New Section', content: '', wordLimit: 100, wordCount: 0 },
    ])
  }

  const handleDeleteSection = (id: string) => {
    if (sections.length <= 1) {
      toast.error('Abstract must have at least one section')
      return
    }
    setSections(prev => prev.filter(s => s.id !== id))
  }

  const handleInsert = () => {
    const hasEmpty = sections.some(s => !s.content.trim())
    if (hasEmpty && !window.confirm('Some sections are empty. Insert anyway?')) return

    const abstractText = sections.map(s => `**${s.title}**\n${s.content}`).join('\n\n')
    onInsert(abstractText, sections)
    toast.success('Abstract inserted')
    onClose()
  }

  if (!isOpen) return null

  const totalWords = sections.reduce((sum, s) => sum + s.wordCount, 0)
  const totalLimit = sections.reduce((sum, s) => sum + s.wordLimit, 0)
  const isWithinLimit = totalWords <= totalLimit

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-[var(--bg-surface)] rounded-lg shadow-[var(--shadow-md)] max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-[var(--border-default)] animate-scale-in">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-default)] shrink-0">
            <h2 className="font-black text-[13px] uppercase tracking-[0.15em] text-[var(--text-primary)]">
              Structured Abstract Builder
            </h2>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Extraction status banner — only shown when document content is present */}
          {!!documentContent && (
            <div className={`px-5 py-2.5 border-b border-[var(--border-default)] flex items-center gap-3 ${
              wasExtracted ? 'bg-[var(--status-success-bg)]' : 'bg-[var(--bg-inset)]'
            }`}>
              <FileText className={`h-3.5 w-3.5 shrink-0 ${
                wasExtracted ? 'text-[var(--status-success-text)]' : 'text-[var(--text-tertiary)]'
              }`} />
              <p className={`text-xs flex-1 ${
                wasExtracted ? 'text-[var(--status-success-text)]' : 'text-[var(--text-secondary)]'
              }`}>
                {wasExtracted
                  ? 'Sections auto-filled from your document — review and edit before inserting.'
                  : 'No matching headings found in your document. Fill sections manually below.'}
              </p>
              <button
                onClick={handleReExtract}
                className="flex items-center gap-1 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors duration-150"
              >
                <RotateCcw className="h-3 w-3" />
                Re-extract
              </button>
            </div>
          )}

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">

            {/* Template selector */}
            <div>
              <label className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider block mb-2">
                Template
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.entries(ABSTRACT_TEMPLATES) as [TemplateKey, typeof ABSTRACT_TEMPLATES[TemplateKey]][]).map(([key, tmpl]) => (
                  <button
                    key={key}
                    onClick={() => handleTemplateChange(key)}
                    className={`p-3 text-xs font-medium border rounded-md transition-colors duration-150 ${
                      selectedTemplate === key
                        ? 'bg-[var(--accent-blue)] text-white border-[var(--accent-blue)]'
                        : 'bg-[var(--bg-surface)] border-[var(--border-default)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]'
                    }`}
                  >
                    {tmpl.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Word count progress */}
            <div className="p-3 bg-[var(--bg-inset)] border border-[var(--border-subtle)] rounded-md">
              <div className="flex justify-between items-center mb-2">
                <p className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
                  Total Word Count
                </p>
                <p className={`text-sm font-bold font-mono tabular-nums ${
                  isWithinLimit ? 'text-[var(--status-success-text)]' : 'text-[var(--status-error-text)]'
                }`}>
                  {totalWords} / {totalLimit}
                </p>
              </div>
              <div className="w-full bg-[var(--border-default)] rounded-full h-1.5">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    isWithinLimit ? 'bg-[var(--status-success)]' : 'bg-[var(--status-error)]'
                  }`}
                  style={{ width: `${Math.min(100, (totalWords / totalLimit) * 100)}%` }}
                />
              </div>
            </div>

            {/* Sections */}
            <div className="space-y-3">
              {sections.map((section) => (
                <div
                  key={section.id}
                  className="border border-[var(--border-default)] rounded-md p-4 space-y-2 bg-[var(--bg-surface)]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Input
                      type="text"
                      value={section.title}
                      onChange={(e) =>
                        setSections(prev =>
                          prev.map(s => s.id === section.id ? { ...s, title: e.target.value } : s)
                        )
                      }
                      className="text-xs font-bold h-8 flex-1"
                    />
                    <p className={`text-xs font-mono tabular-nums whitespace-nowrap ${
                      section.wordCount > section.wordLimit
                        ? 'text-[var(--status-warning-text)]'
                        : 'text-[var(--text-tertiary)]'
                    }`}>
                      {section.wordCount}/{section.wordLimit}
                    </p>
                    {sections.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-[var(--status-error)] hover:text-[var(--status-error-hover)] hover:bg-[var(--status-error-bg)]"
                        onClick={() => handleDeleteSection(section.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>

                  {section.wordCount > section.wordLimit && (
                    <p className="text-xs text-[var(--status-warning-text)] font-medium">
                      Exceeds limit by {section.wordCount - section.wordLimit} word{section.wordCount - section.wordLimit !== 1 ? 's' : ''}
                    </p>
                  )}

                  <Textarea
                    value={section.content}
                    onChange={(e) => handleSectionChange(section.id, e.target.value)}
                    placeholder={`Write your ${section.title.toLowerCase()} (aim for ~${section.wordLimit} words)`}
                    className="text-xs h-24 resize-none"
                  />
                </div>
              ))}

              <Button
                size="sm"
                variant="outline"
                onClick={handleAddSection}
                className="w-full text-xs h-8"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Section
              </Button>
            </div>
          </div>

          {/* Footer */}
          <div className="shrink-0 px-6 py-4 border-t border-[var(--border-default)] flex gap-2 justify-end bg-[var(--bg-inset)]">
            <Button variant="outline" size="sm" onClick={onClose} className="text-xs h-8">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleInsert}
              disabled={sections.every(s => !s.content.trim())}
              className="text-xs h-8"
            >
              Insert Abstract
            </Button>
          </div>

        </div>
      </div>
    </>
  )
}
