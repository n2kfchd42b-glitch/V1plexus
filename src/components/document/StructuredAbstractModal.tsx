'use client'

import { useState } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

interface AbstractSection {
  id: string
  title: string
  content: string
  wordLimit: number
  wordCount: number
}

interface StructuredAbstractModalProps {
  isOpen: boolean
  onClose: () => void
  onInsert: (abstract: string, sections: AbstractSection[]) => void
  initialContent?: string
}

/**
 * Journal abstract templates
 */
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

export function StructuredAbstractModal({
  isOpen,
  onClose,
  onInsert,
  initialContent,
}: StructuredAbstractModalProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateKey>('default')
  const [sections, setSections] = useState<AbstractSection[]>(() => {
    return ABSTRACT_TEMPLATES.default.sections.map((s, idx) => ({
      id: `section-${idx}`,
      title: s.title,
      content: '',
      wordLimit: s.wordLimit,
      wordCount: 0,
    }))
  })

  const handleTemplateChange = (template: TemplateKey) => {
    setSelectedTemplate(template)
    setSections(
      ABSTRACT_TEMPLATES[template].sections.map((s, idx) => ({
        id: `section-${idx}`,
        title: s.title,
        content: '',
        wordLimit: s.wordLimit,
        wordCount: 0,
      }))
    )
  }

  const handleSectionChange = (id: string, content: string) => {
    const wordCount = content.trim().split(/\s+/).filter(Boolean).length
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, content, wordCount } : s))
    )
  }

  const handleAddSection = () => {
    const newSection: AbstractSection = {
      id: `section-${sections.length}`,
      title: 'New Section',
      content: '',
      wordLimit: 100,
      wordCount: 0,
    }
    setSections([...sections, newSection])
  }

  const handleDeleteSection = (id: string) => {
    if (sections.length <= 1) {
      toast.error('Abstract must have at least one section')
      return
    }
    setSections(sections.filter((s) => s.id !== id))
  }

  const handleInsert = () => {
    // Validation
    let hasEmptySection = false
    for (const section of sections) {
      if (!section.content.trim()) {
        hasEmptySection = true
        break
      }
    }

    if (hasEmptySection) {
      const confirm = window.confirm(
        'Some sections are empty. Insert anyway?'
      )
      if (!confirm) return
    }

    // Generate formatted abstract
    let abstractText = ''
    for (const section of sections) {
      abstractText += `**${section.title}**\n${section.content}\n\n`
    }

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
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
            <h2 className="font-black text-[13px] uppercase tracking-[0.15em] text-slate-900">
              Structured Abstract Builder
            </h2>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 hover:text-blue-600 transition-colors"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Template selector */}
            <div>
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-2">
                Select Template
              </label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(ABSTRACT_TEMPLATES).map(([key, template]) => (
                  <button
                    key={key}
                    onClick={() =>
                      handleTemplateChange(key as TemplateKey)
                    }
                    className={`p-3 text-xs font-medium border rounded transition-colors ${
                      selectedTemplate === key
                        ? 'bg-blue-600 text-white border-blue-600 font-semibold'
                        : 'bg-white border-slate-300 text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    {template.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Word count indicator */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded">
              <div className="flex justify-between items-center mb-2">
                <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  Word Count
                </p>
                <p
                  className={`text-sm font-bold ${
                    isWithinLimit ? 'text-green-700' : 'text-red-700'
                  }`}
                >
                  {totalWords} / {totalLimit} words
                </p>
              </div>
              <div className="w-full bg-slate-200 rounded h-2">
                <div
                  className={`h-full rounded transition-colors ${
                    isWithinLimit ? 'bg-green-600' : 'bg-red-600'
                  }`}
                  style={{ width: `${Math.min(100, (totalWords / totalLimit) * 100)}%` }}
                />
              </div>
            </div>

            {/* Sections */}
            <div className="space-y-3">
              {sections.map((section, idx) => (
                <div
                  key={section.id}
                  className="border border-slate-200 rounded p-4 space-y-2 bg-white hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Input
                      type="text"
                      value={section.title}
                      onChange={(e) =>
                        setSections((prev) =>
                          prev.map((s) =>
                            s.id === section.id
                              ? { ...s, title: e.target.value }
                              : s
                          )
                        )
                      }
                      className="text-xs font-bold h-8 flex-1 border-slate-300 text-slate-900"
                    />
                    <p className="text-xs text-slate-500 whitespace-nowrap font-medium">
                      {section.wordCount}/{section.wordLimit} words
                    </p>
                    {sections.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDeleteSection(section.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>

                  {/* Word limit warning */}
                  {section.wordCount > section.wordLimit && (
                    <p className="text-xs text-orange-700 font-medium">
                      ⚠️ Exceeds limit by{' '}
                      {section.wordCount - section.wordLimit} words
                    </p>
                  )}

                  {/* Textarea */}
                  <Textarea
                    value={section.content}
                    onChange={(e) =>
                      handleSectionChange(section.id, e.target.value)
                    }
                    placeholder={`Write your ${section.title.toLowerCase()} (aim for ~${section.wordLimit} words)`}
                    className="text-xs h-24 resize-none border-slate-300 text-slate-900 placeholder:text-slate-400"
                  />
                </div>
              ))}

              {/* Add section button */}
              <Button
                size="sm"
                variant="outline"
                onClick={handleAddSection}
                className="w-full text-xs h-8 border-slate-300 text-slate-700 hover:bg-white"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Section
              </Button>
            </div>
          </div>

          {/* Footer */}
          <div className="shrink-0 px-6 py-4 border-t border-slate-200 flex gap-2 justify-end bg-slate-50">
            <Button
              variant="outline"
              onClick={onClose}
              className="text-xs h-8 border-slate-300 text-slate-700 hover:bg-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleInsert}
              disabled={sections.some((s) => !s.content.trim())}
              className="text-xs h-8 bg-blue-600 hover:bg-blue-700 text-white disabled:bg-slate-300 disabled:text-slate-500"
            >
              Insert Abstract
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
