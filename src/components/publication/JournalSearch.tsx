"use client"

import { useState, useMemo } from 'react'
import { Search, SlidersHorizontal } from 'lucide-react'
import { JournalCard, type JournalTemplate } from './JournalCard'

const CATEGORIES = ['all', 'global_health', 'epidemiology', 'tropical_medicine', 'public_health', 'infectious_disease', 'maternal_health', 'nutrition', 'clinical', 'biostatistics']

interface JournalSearchProps {
  journals: JournalTemplate[]
  onSelect?: (journal: JournalTemplate) => void
  selectedId?: string
}

export function JournalSearch({ journals, onSelect, selectedId }: JournalSearchProps) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [openAccess, setOpenAccess] = useState<'any' | 'yes' | 'no'>('any')
  const [publisher, setPublisher] = useState('all')

  const publishers = useMemo(() => {
    const set = new Set(journals.map(j => j.publisher).filter(Boolean) as string[])
    return ['all', ...Array.from(set).sort()]
  }, [journals])

  const filtered = useMemo(() => {
    return journals.filter(j => {
      if (query) {
        const q = query.toLowerCase()
        if (!j.name.toLowerCase().includes(q) && !j.publisher?.toLowerCase().includes(q)) return false
      }
      if (category !== 'all' && !j.categories.includes(category)) return false
      if (openAccess === 'yes' && !j.open_access) return false
      if (openAccess === 'no' && j.open_access) return false
      if (publisher !== 'all' && j.publisher !== publisher) return false
      return true
    })
  }, [journals, query, category, openAccess, publisher])

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search journals by name or publisher…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
        />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
        <SlidersHorizontal className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          <label className="text-gray-500 font-medium">Category:</label>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 capitalize"
          >
            {CATEGORIES.map(c => (
              <option key={c} value={c}>{c === 'all' ? 'All' : c.replace(/_/g, ' ')}</option>
            ))}
          </select>

          <label className="text-gray-500 font-medium ml-2">Publisher:</label>
          <select
            value={publisher}
            onChange={e => setPublisher(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 max-w-[140px]"
          >
            {publishers.map(p => (
              <option key={p} value={p}>{p === 'all' ? 'All' : p}</option>
            ))}
          </select>

          <label className="text-gray-500 font-medium ml-2">Open Access:</label>
          <select
            value={openAccess}
            onChange={e => setOpenAccess(e.target.value as 'any' | 'yes' | 'no')}
            className="border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="any">Any</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>

        <span className="ml-auto text-xs text-gray-400">{filtered.length} journals</span>
      </div>

      {/* Results */}
      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">
            No journals match your filters
          </div>
        ) : (
          filtered.map(journal => (
            <JournalCard
              key={journal.id}
              journal={journal}
              onSelect={onSelect}
              selected={journal.id === selectedId}
            />
          ))
        )}
      </div>
    </div>
  )
}
