'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { Input } from '@/components/ui/input'
import { KnowledgeBaseFilters, type KBFilters } from './KnowledgeBaseFilters'
import { KnowledgeEntryCard } from './KnowledgeEntryCard'
import { SimilarStudySuggestion } from './SimilarStudySuggestion'
import { Search, BookOpen } from 'lucide-react'
import type { KnowledgeBaseEntry } from '@/types/database'

export function KnowledgeBaseSearch() {
  const { profile } = useAuth()
  const supabase = createClient()

  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<KBFilters>({
    type: 'all',
    diseaseArea: 'all',
    methodology: 'all',
    year: 'all',
  })
  const [results, setResults] = useState<KnowledgeBaseEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const search = useCallback(async () => {
    if (!profile?.institution_id) return
    setLoading(true)
    setSearched(true)

    let q = supabase
      .from('knowledge_base_entries')
      .select('*')
      .eq('institution_id', profile.institution_id)
      .order('archived_at', { ascending: false })
      .limit(30)

    if (filters.type !== 'all') q = q.eq('resource_type', filters.type)
    if (filters.diseaseArea !== 'all') q = q.contains('disease_area', [filters.diseaseArea])
    if (filters.methodology !== 'all') q = q.contains('methodology', [filters.methodology])
    if (filters.year !== 'all') {
      const start = `${filters.year}-01-01`
      const end = `${filters.year}-12-31`
      q = q.gte('archived_at', start).lte('archived_at', end)
    }

    const { data } = await q
    let items = (data ?? []) as KnowledgeBaseEntry[]

    // Client-side text filter if query provided
    if (query.trim()) {
      const q2 = query.toLowerCase()
      items = items.filter(e =>
        e.title.toLowerCase().includes(q2) ||
        e.description?.toLowerCase().includes(q2) ||
        e.keywords?.some(k => k.toLowerCase().includes(q2)) ||
        e.disease_area?.some(d => d.toLowerCase().includes(q2)) ||
        e.methodology?.some(m => m.toLowerCase().includes(q2))
      )
    }

    setResults(items)
    setLoading(false)
  }, [profile, supabase, query, filters])

  // Auto-search when filters change
  useEffect(() => {
    const timer = setTimeout(search, 300)
    return () => clearTimeout(timer)
  }, [search])

  return (
    <div className="space-y-5">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-tertiary)]" />
        <Input
          placeholder="Search across all archived research…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Filters */}
      <KnowledgeBaseFilters filters={filters} onChange={setFilters} />

      {/* AI Suggestions panel (shown when search is fresh) */}
      {!query && filters.type === 'all' && (
        <SimilarStudySuggestion />
      )}

      {/* Results */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl" />
          ))}
        </div>
      ) : searched && results.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-[var(--border-default)] rounded-xl">
          <BookOpen className="h-8 w-8 mx-auto text-[var(--text-tertiary)] mb-2" />
          <p className="text-sm font-medium text-[var(--text-primary)]">No results found</p>
          <p className="text-xs text-[var(--text-tertiary)] mt-1">Try adjusting your search or filters.</p>
        </div>
      ) : results.length > 0 ? (
        <div className="space-y-3">
          <p className="text-xs text-[var(--text-tertiary)]">{results.length} result{results.length !== 1 ? 's' : ''}</p>
          {results.map(entry => <KnowledgeEntryCard key={entry.id} entry={entry} />)}
        </div>
      ) : null}
    </div>
  )
}
