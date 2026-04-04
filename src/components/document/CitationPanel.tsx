"use client"

import { useState, useRef, useEffect } from 'react'
import {
  Search, X, Plus, Loader2, BookOpen, Hash, FileText,
  Copy, Check, ChevronDown, Quote, Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CslCitation } from '@/components/publication/CitationSearch'
import { formatCitation, formatInlineCitation } from '@/components/publication/BibliographyGenerator'

type ReferenceStyle = 'vancouver' | 'apa7' | 'harvard' | 'numbered'
type SearchTab = 'search' | 'doi' | 'bibtex'

interface CrossRefWork {
  title: string[]
  author?: Array<{ family: string; given: string }>
  published?: { 'date-parts': number[][] }
  'container-title'?: string[]
  volume?: string
  issue?: string
  page?: string
  DOI?: string
  'is-referenced-by-count'?: number
  type: string
  publisher?: string
  URL?: string
}

interface CitationPanelProps {
  citations: CslCitation[]
  style: ReferenceStyle
  onStyleChange: (s: ReferenceStyle) => void
  onInsert: (citation: CslCitation) => void
  onRemove: (idx: number) => void
}

function formatAuthorShort(authors?: CslCitation['author']): string {
  if (!authors || authors.length === 0) return ''
  if (authors.length === 1) return authors[0].family
  if (authors.length === 2) return `${authors[0].family} & ${authors[1].family}`
  return `${authors[0].family} et al.`
}

function formatYear(issued?: CslCitation['issued']): string {
  return issued?.['date-parts']?.[0]?.[0]?.toString() ?? ''
}

export function CitationPanel({ citations, style, onStyleChange, onInsert, onRemove }: CitationPanelProps) {
  const [tab, setTab] = useState<SearchTab>('search')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CslCitation[]>([])
  const [loading, setLoading] = useState(false)
  const [doiInput, setDoiInput] = useState('')
  const [bibtexInput, setBibtexInput] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [section, setSection] = useState<'search' | 'library'>('search')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (tab !== 'search' || query.length < 3) { setResults([]); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => searchCrossRef(query), 500)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, tab])

  async function searchCrossRef(q: string) {
    setLoading(true); setError('')
    try {
      const url = `https://api.crossref.org/works?query=${encodeURIComponent(q)}&rows=8&select=DOI,title,author,published,container-title,volume,issue,page,is-referenced-by-count,type,publisher`
      const res = await fetch(url, { headers: { 'User-Agent': 'PLEXUS/1.0 (mailto:support@plexus.health)' } })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setResults((data.message?.items ?? []).map((w: CrossRefWork) => ({
        title: w.title?.[0] ?? '',
        author: w.author,
        issued: w.published,
        'container-title': w['container-title']?.[0],
        volume: w.volume, issue: w.issue, page: w.page,
        DOI: w.DOI, type: w.type ?? 'article-journal',
        publisher: w.publisher, URL: w.URL,
        'number-of-cited-by': w['is-referenced-by-count'],
        source: 'crossref', external_id: w.DOI,
      })))
    } catch { setError('Search failed — check connection') }
    finally { setLoading(false) }
  }

  async function fetchByDoi() {
    const doi = doiInput.trim().replace(/^https?:\/\/(dx\.)?doi\.org\//, '')
    if (!doi) return
    setLoading(true); setError('')
    try {
      const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      const w: CrossRefWork = data.message
      onInsert({
        title: w.title?.[0] ?? doi, author: w.author,
        issued: w.published, 'container-title': w['container-title']?.[0],
        volume: w.volume, issue: w.issue, page: w.page,
        DOI: w.DOI ?? doi, type: w.type ?? 'article-journal',
        publisher: w.publisher, source: 'doi', external_id: doi,
      })
      setDoiInput('')
    } catch { setError('DOI not found in CrossRef') }
    finally { setLoading(false) }
  }

  function parseBibtex() {
    const text = bibtexInput.trim()
    if (!text) return
    try {
      const get = (re: RegExp) => text.match(re)?.[1]
      const authorsRaw = get(/author\s*=\s*[{"](.+?)[}"],?/i) ?? ''
      const authors = authorsRaw.split(' and ').map(a => {
        const [family, given] = a.split(', ')
        return { family: family?.trim() ?? a.trim(), given: given?.trim() ?? '' }
      })
      const year = get(/year\s*=\s*[{"]?(\d{4})[}"]?,?/i)
      onInsert({
        title: get(/title\s*=\s*[{"](.+?)[}"],?/i) ?? 'Unknown Title',
        author: authors,
        issued: year ? { 'date-parts': [[parseInt(year)]] } : undefined,
        'container-title': get(/journal\s*=\s*[{"](.+?)[}"],?/i),
        DOI: get(/doi\s*=\s*[{"](.+?)[}"],?/i),
        volume: get(/volume\s*=\s*[{"](.+?)[}"],?/i),
        page: get(/pages\s*=\s*[{"](.+?)[}"],?/i),
        type: 'article-journal', source: 'bibtex',
      })
      setBibtexInput('')
    } catch { setError('Could not parse BibTeX entry') }
  }

  function handleCopyBibliography() {
    const text = citations.map((c, i) => formatCitation(c, style, i + 1)).join('\n\n')
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const STYLES: { value: ReferenceStyle; label: string }[] = [
    { value: 'vancouver', label: 'Vancouver' },
    { value: 'apa7', label: 'APA 7th' },
    { value: 'harvard', label: 'Harvard' },
    { value: 'numbered', label: 'Numbered' },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Section toggle */}
      <div className="flex border-b border-[var(--border-default)] shrink-0">
        {(['search', 'library'] as const).map(s => (
          <button
            key={s}
            onClick={() => setSection(s)}
            className={cn(
              'flex-1 py-2.5 text-xs font-medium transition-colors capitalize',
              section === s
                ? 'text-[var(--color-clinical-blue)] border-b-2 border-[var(--color-clinical-blue)] -mb-px bg-white'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            )}
          >
            {s === 'library' ? `Library (${citations.length})` : 'Add Citation'}
          </button>
        ))}
      </div>

      {section === 'search' && (
        <div className="flex flex-col flex-1 min-h-0">
          {/* Tabs */}
          <div className="flex border-b border-[var(--border-default)] px-3 shrink-0">
            {([
              ['search', 'Search', Search],
              ['doi', 'DOI', Hash],
              ['bibtex', 'BibTeX', FileText],
            ] as const).map(([key, label, Icon]) => (
              <button
                key={key}
                onClick={() => { setTab(key); setError('') }}
                className={cn(
                  'flex items-center gap-1 px-2 py-2 text-[11px] font-medium border-b-2 transition-all',
                  tab === key
                    ? 'border-[var(--color-clinical-blue)] text-[var(--color-clinical-blue)]'
                    : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                )}
              >
                <Icon className="h-3 w-3" />
                {label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {/* Search tab */}
            {tab === 'search' && (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-tertiary)]" />
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="Title, author, keyword…"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 border border-[var(--border-default)] rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  />
                  {loading && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-blue-500 animate-spin" />}
                </div>
                {error && <p className="text-[11px] text-red-500">{error}</p>}
                <div className="space-y-1.5">
                  {results.length === 0 && !loading && query.length < 3 && (
                    <p className="text-center text-[11px] text-[var(--text-tertiary)] py-6">Type 3+ characters to search CrossRef</p>
                  )}
                  {results.length === 0 && !loading && query.length >= 3 && (
                    <p className="text-center text-[11px] text-[var(--text-tertiary)] py-6">No results found</p>
                  )}
                  {results.map((c, i) => (
                    <div key={i} className="group flex items-start gap-2 p-2.5 border border-[var(--border-default)] rounded-lg hover:border-blue-200 hover:bg-blue-50/40 transition-colors">
                      <BookOpen className="h-3.5 w-3.5 text-[var(--text-tertiary)] shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-[var(--text-primary)] line-clamp-2 leading-snug">{c.title}</p>
                        <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 truncate">
                          {formatAuthorShort(c.author)}{formatYear(c.issued) ? ` (${formatYear(c.issued)})` : ''}
                          {c['container-title'] && ` · ${c['container-title']}`}
                        </p>
                        {c['number-of-cited-by'] !== undefined && (
                          <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">Cited {c['number-of-cited-by'].toLocaleString()}×</p>
                        )}
                      </div>
                      <button
                        onClick={() => onInsert(c)}
                        className="shrink-0 flex items-center gap-1 text-[11px] font-medium text-white bg-[var(--color-clinical-blue)] hover:bg-[var(--color-clinical-deep)] px-2 py-1 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Plus className="h-3 w-3" />
                        Cite
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* DOI tab */}
            {tab === 'doi' && (
              <div className="space-y-2">
                <p className="text-[11px] text-[var(--text-secondary)]">Paste a DOI to auto-import from CrossRef</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="10.1038/nature15535"
                    value={doiInput}
                    onChange={e => setDoiInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && fetchByDoi()}
                    className="flex-1 px-3 py-2 border border-[var(--border-default)] rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                  <button
                    onClick={fetchByDoi}
                    disabled={loading}
                    className="flex items-center gap-1 text-xs font-medium text-white bg-[var(--color-clinical-blue)] hover:bg-[var(--color-clinical-deep)] px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    Add
                  </button>
                </div>
                {error && <p className="text-[11px] text-red-500">{error}</p>}
              </div>
            )}

            {/* BibTeX tab */}
            {tab === 'bibtex' && (
              <div className="space-y-2">
                <p className="text-[11px] text-[var(--text-secondary)]">Paste a BibTeX entry</p>
                <textarea
                  value={bibtexInput}
                  onChange={e => setBibtexInput(e.target.value)}
                  placeholder={'@article{key,\n  title={...},\n  author={Last, First},\n  year={2024},\n  doi={...}\n}'}
                  rows={7}
                  className="w-full px-3 py-2 border border-[var(--border-default)] rounded-lg text-[11px] font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none"
                />
                <button
                  onClick={parseBibtex}
                  className="flex items-center gap-1.5 text-xs font-medium text-white bg-[var(--color-clinical-blue)] hover:bg-[var(--color-clinical-deep)] px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Import
                </button>
                {error && <p className="text-[11px] text-red-500 mt-1">{error}</p>}
              </div>
            )}
          </div>
        </div>
      )}

      {section === 'library' && (
        <div className="flex flex-col flex-1 min-h-0">
          {/* Style + copy */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-default)] shrink-0">
            <div className="relative">
              <select
                value={style}
                onChange={e => onStyleChange(e.target.value as ReferenceStyle)}
                className="text-[11px] border border-[var(--border-default)] rounded-md pl-2 pr-6 py-1 bg-white appearance-none focus:outline-none focus:ring-1 focus:ring-blue-500 text-[var(--text-secondary)]"
              >
                {STYLES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-[var(--text-tertiary)] pointer-events-none" />
            </div>
            <button
              onClick={handleCopyBibliography}
              disabled={citations.length === 0}
              className="flex items-center gap-1 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-2 py-1 rounded-md hover:bg-[var(--border-default)] transition-colors disabled:opacity-40"
            >
              {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
              {copied ? 'Copied' : 'Copy all'}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {citations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <Quote className="h-8 w-8 text-[var(--text-tertiary)] mb-3 opacity-40" />
                <p className="text-xs text-[var(--text-tertiary)]">No citations yet</p>
                <p className="text-[11px] text-[var(--text-tertiary)] mt-1">Use the Add Citation tab to search CrossRef, import by DOI, or paste BibTeX</p>
              </div>
            ) : (
              <ol className="divide-y divide-[var(--border-default)]">
                {citations.map((c, i) => (
                  <li key={i} className="group px-3 py-2.5 hover:bg-[var(--bg-app)] transition-colors">
                    <div className="flex items-start gap-2">
                      <span className="text-[11px] font-bold text-[var(--color-clinical-blue)] shrink-0 mt-0.5 w-4 text-right">
                        {formatInlineCitation(c, style, i + 1)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-[var(--text-primary)] leading-snug line-clamp-2">{c.title}</p>
                        <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
                          {formatAuthorShort(c.author)}{formatYear(c.issued) ? ` (${formatYear(c.issued)})` : ''}
                          {c['container-title'] && ` · ${c['container-title']}`}
                        </p>
                        {c.DOI && (
                          <a
                            href={`https://doi.org/${c.DOI}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-blue-500 hover:underline"
                          >
                            {c.DOI}
                          </a>
                        )}
                      </div>
                      <button
                        onClick={() => onRemove(i)}
                        className="shrink-0 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-[var(--text-tertiary)] hover:text-red-500 transition-all"
                        title="Remove citation"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
