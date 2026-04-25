"use client"

import { useState } from 'react'
import { Copy, Check, BookOpen } from 'lucide-react'
import type { CslCitation } from './CitationSearch'

export type ReferenceStyle = 'vancouver' | 'apa7' | 'harvard' | 'numbered'

interface BibliographyGeneratorProps {
  citations: CslCitation[]
  style: ReferenceStyle
  onStyleChange: (style: ReferenceStyle) => void
}

function formatVancouver(c: CslCitation, num: number): string {
  const authors = (c.author ?? []).map(a => `${a.family} ${a.given.charAt(0) || ''}`.trim()).join(', ')
  const year = c.issued?.['date-parts']?.[0]?.[0] ?? ''
  const journal = c['container-title'] ?? c.publisher ?? ''
  const vol = c.volume ? `;${c.volume}` : ''
  const issue = c.issue ? `(${c.issue})` : ''
  const pages = c.page ? `:${c.page}` : ''
  const doi = c.DOI ? ` doi:${c.DOI}` : ''
  return `${num}. ${authors}. ${c.title}. ${journal}. ${year}${vol}${issue}${pages}.${doi}`
}

function formatApa7(c: CslCitation): string {
  const authors = (c.author ?? []).map(a => `${a.family}, ${a.given.charAt(0) || ''}.`).join(', ')
  const year = c.issued?.['date-parts']?.[0]?.[0] ?? 'n.d.'
  const journal = c['container-title'] ?? c.publisher ?? ''
  const vol = c.volume ?? ''
  const issue = c.issue ? `(${c.issue})` : ''
  const pages = c.page ?? ''
  const doi = c.DOI ? ` https://doi.org/${c.DOI}` : ''
  return `${authors} (${year}). ${c.title}. *${journal}*, *${vol}*${issue}, ${pages}.${doi}`
}

function formatHarvard(c: CslCitation): string {
  const authors = (c.author ?? []).map(a => `${a.family}, ${a.given.charAt(0) || ''}.`).join(', ')
  const year = c.issued?.['date-parts']?.[0]?.[0] ?? 'n.d.'
  const journal = c['container-title'] ?? c.publisher ?? ''
  const vol = c.volume ?? ''
  const pages = c.page ?? ''
  const doi = c.DOI ? ` Available at: https://doi.org/${c.DOI}` : ''
  return `${authors} (${year}) '${c.title}', *${journal}*, ${vol}, pp. ${pages}.${doi}`
}

export function formatCitation(c: CslCitation, style: ReferenceStyle, num: number): string {
  switch (style) {
    case 'vancouver':
    case 'numbered':
      return formatVancouver(c, num)
    case 'apa7':
      return formatApa7(c)
    case 'harvard':
      return formatHarvard(c)
    default:
      return formatVancouver(c, num)
  }
}

export function formatInlineCitation(c: CslCitation, style: ReferenceStyle, num: number): string {
  const year = c.issued?.['date-parts']?.[0]?.[0] ?? ''
  const firstAuthor = c.author?.[0]?.family ?? 'Unknown'
  const multipleAuthors = (c.author?.length ?? 0) > 1
  switch (style) {
    case 'vancouver':
    case 'numbered':
      return `[${num}]`
    case 'apa7':
    case 'harvard':
      return `(${firstAuthor}${multipleAuthors ? ' et al.' : ''}, ${year})`
    default:
      return `[${num}]`
  }
}

export function BibliographyGenerator({ citations, style, onStyleChange }: BibliographyGeneratorProps) {
  const [copied, setCopied] = useState(false)

  const bibliography = citations.map((c, i) => formatCitation(c, style, i + 1))

  function handleCopy() {
    navigator.clipboard.writeText(bibliography.join('\n\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">References</span>
          <span className="text-xs text-gray-400 bg-gray-200 rounded-full px-2 py-0.5">{citations.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={style}
            onChange={e => onStyleChange(e.target.value as ReferenceStyle)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="vancouver">Vancouver</option>
            <option value="apa7">APA 7th</option>
            <option value="harvard">Harvard</option>
            <option value="numbered">Numbered</option>
          </select>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 px-2.5 py-1.5 border border-gray-200 rounded-lg hover:bg-white transition-colors"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy all'}
          </button>
        </div>
      </div>
      {citations.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-400">
          No citations yet — add references from the editor
        </div>
      ) : (
        <ol className="divide-y divide-gray-50">
          {bibliography.map((entry, i) => (
            <li key={i} className="px-4 py-3 text-xs text-gray-700 leading-relaxed hover:bg-gray-50">
              {entry}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
