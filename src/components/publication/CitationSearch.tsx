"use client"

import { useState, useRef, useEffect } from 'react'
import { Search, X, Plus, Loader2, BookOpen, Hash, FileText } from 'lucide-react'

export interface CslCitation {
  id?: string
  title: string
  author?: Array<{ family: string; given: string }>
  issued?: { 'date-parts': number[][] }
  'container-title'?: string
  volume?: string
  issue?: string
  page?: string
  DOI?: string
  PMID?: string
  URL?: string
  publisher?: string
  type: string
  'number-of-cited-by'?: number
  source?: string
  external_id?: string
}

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

interface CitationSearchProps {
  onInsert: (citation: CslCitation) => void
  onClose: () => void
  projectId: string
}

function formatAuthorShort(authors?: CslCitation['author']): string {
  if (!authors || authors.length === 0) return ''
  if (authors.length === 1) return `${authors[0].family}`
  if (authors.length === 2) return `${authors[0].family} & ${authors[1].family}`
  return `${authors[0].family} et al.`
}

function formatYear(issued?: CslCitation['issued']): string {
  return issued?.['date-parts']?.[0]?.[0]?.toString() ?? ''
}

export function CitationSearch({ onInsert, onClose, projectId }: CitationSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CslCitation[]>([])
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'search' | 'doi' | 'bibtex'>('search')
  const [doiInput, setDoiInput] = useState('')
  const [bibtexInput, setBibtexInput] = useState('')
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (tab !== 'search' || query.length < 3) {
      setResults([])
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => searchCrossRef(query), 500)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, tab])

  async function searchCrossRef(q: string) {
    setLoading(true)
    setError('')
    try {
      const url = `https://api.crossref.org/works?query=${encodeURIComponent(q)}&rows=8&select=DOI,title,author,published,container-title,volume,issue,page,is-referenced-by-count,type,publisher`
      const res = await fetch(url, { headers: { 'User-Agent': 'PLEXUS/1.0 (mailto:support@plexus.health)' } })
      if (!res.ok) throw new Error('CrossRef request failed')
      const data = await res.json()
      const items: CslCitation[] = (data.message?.items ?? []).map((w: CrossRefWork) => ({
        title: w.title?.[0] ?? '',
        author: w.author,
        issued: w.published,
        'container-title': w['container-title']?.[0],
        volume: w.volume,
        issue: w.issue,
        page: w.page,
        DOI: w.DOI,
        type: w.type ?? 'article-journal',
        publisher: w.publisher,
        URL: w.URL,
        'number-of-cited-by': w['is-referenced-by-count'],
        source: 'crossref',
        external_id: w.DOI,
      }))
      setResults(items)
    } catch {
      setError('Search failed — check your connection')
    } finally {
      setLoading(false)
    }
  }

  async function fetchByDoi() {
    const doi = doiInput.trim().replace(/^https?:\/\/(dx\.)?doi\.org\//, '')
    if (!doi) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`)
      if (!res.ok) throw new Error('DOI not found')
      const data = await res.json()
      const w: CrossRefWork = data.message
      const citation: CslCitation = {
        title: w.title?.[0] ?? doi,
        author: w.author,
        issued: w.published,
        'container-title': w['container-title']?.[0],
        volume: w.volume,
        issue: w.issue,
        page: w.page,
        DOI: w.DOI ?? doi,
        type: w.type ?? 'article-journal',
        publisher: w.publisher,
        source: 'doi',
        external_id: doi,
      }
      onInsert(citation)
    } catch {
      setError('DOI not found in CrossRef')
    } finally {
      setLoading(false)
    }
  }

  function parseBibtex() {
    // Minimal BibTeX parser
    const text = bibtexInput.trim()
    if (!text) return
    try {
      const titleMatch = text.match(/title\s*=\s*[{"](.+?)[}"],?/i)
      const authorMatch = text.match(/author\s*=\s*[{"](.+?)[}"],?/i)
      const yearMatch = text.match(/year\s*=\s*[{"]?(\d{4})[}"]?,?/i)
      const journalMatch = text.match(/journal\s*=\s*[{"](.+?)[}"],?/i)
      const doiMatch = text.match(/doi\s*=\s*[{"](.+?)[}"],?/i)
      const volumeMatch = text.match(/volume\s*=\s*[{"](.+?)[}"],?/i)
      const pagesMatch = text.match(/pages\s*=\s*[{"](.+?)[}"],?/i)

      const authorsRaw = authorMatch?.[1] ?? ''
      const authors = authorsRaw.split(' and ').map(a => {
        const [family, given] = a.split(', ')
        return { family: family?.trim() ?? a.trim(), given: given?.trim() ?? '' }
      })

      const citation: CslCitation = {
        title: titleMatch?.[1] ?? 'Unknown Title',
        author: authors,
        issued: yearMatch ? { 'date-parts': [[parseInt(yearMatch[1])]] } : undefined,
        'container-title': journalMatch?.[1],
        DOI: doiMatch?.[1],
        volume: volumeMatch?.[1],
        page: pagesMatch?.[1],
        type: 'article-journal',
        source: 'bibtex',
        external_id: doiMatch?.[1],
      }
      onInsert(citation)
    } catch {
      setError('Could not parse BibTeX entry')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 text-sm">Insert Citation</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-5">
          {([['search', 'Search', Search], ['doi', 'Import DOI', Hash], ['bibtex', 'BibTeX', FileText]] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key as typeof tab)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-all ${
                tab === key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Search tab */}
        {tab === 'search' && (
          <div className="p-5">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search by title, author, DOI, or keyword…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-500 animate-spin" />}
            </div>

            {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {results.length === 0 && !loading && query.length >= 3 && (
                <p className="text-center text-sm text-gray-400 py-6">No results found</p>
              )}
              {results.length === 0 && !loading && query.length < 3 && (
                <p className="text-center text-sm text-gray-400 py-6">Type at least 3 characters to search</p>
              )}
              {results.map((c, i) => (
                <div key={i} className="flex items-start gap-3 p-3 border border-gray-100 rounded-xl hover:bg-gray-50 group">
                  <BookOpen className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 line-clamp-2">{c.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatAuthorShort(c.author)}{formatYear(c.issued) ? ` (${formatYear(c.issued)})` : ''}
                      {c['container-title'] && ` · ${c['container-title']}`}
                      {c.DOI && ` · DOI: ${c.DOI}`}
                    </p>
                    {c['number-of-cited-by'] !== undefined && (
                      <p className="text-xs text-gray-400 mt-0.5">Cited by: {c['number-of-cited-by'].toLocaleString()}</p>
                    )}
                  </div>
                  <button
                    onClick={() => onInsert(c)}
                    className="flex items-center gap-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 px-2.5 py-1.5 rounded-lg transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                  >
                    <Plus className="h-3 w-3" />
                    Insert
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DOI tab */}
        {tab === 'doi' && (
          <div className="p-5">
            <p className="text-xs text-gray-500 mb-3">Paste a DOI to auto-fill citation metadata from CrossRef</p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="10.1038/nature15535 or https://doi.org/10.1038/…"
                value={doiInput}
                onChange={e => setDoiInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && fetchByDoi()}
                className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={fetchByDoi}
                disabled={loading}
                className="flex items-center gap-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Import
              </button>
            </div>
            {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
          </div>
        )}

        {/* BibTeX tab */}
        {tab === 'bibtex' && (
          <div className="p-5">
            <p className="text-xs text-gray-500 mb-3">Paste a BibTeX entry to import</p>
            <textarea
              value={bibtexInput}
              onChange={e => setBibtexInput(e.target.value)}
              placeholder={'@article{key,\n  title={...},\n  author={Last, First and ...},\n  journal={...},\n  year={2024},\n  doi={...}\n}'}
              rows={8}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={parseBibtex}
              className="mt-2 flex items-center gap-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-xl transition-colors"
            >
              <Plus className="h-4 w-4" />
              Import BibTeX
            </button>
            {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
          </div>
        )}
      </div>
    </div>
  )
}
