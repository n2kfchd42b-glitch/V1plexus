"use client"

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, FolderOpen, FileText, Database, Users, X, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'

interface SearchResult {
  id: string
  type: 'project' | 'document' | 'dataset' | 'person'
  title: string
  subtitle?: string
  href: string
}

const typeIcons = {
  project: FolderOpen,
  document: FileText,
  dataset: Database,
  person: Users,
}

const typeColors = {
  project: 'text-blue-600',
  document: 'text-purple-600',
  dataset: 'text-green-600',
  person: 'text-orange-600',
}

const typeLabels = {
  project: 'Projects',
  document: 'Documents',
  dataset: 'Datasets',
  person: 'People',
}

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const { profile } = useAuth()
  const supabase = createClient()

  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const search = useCallback(async (q: string) => {
    if (!q.trim() || !profile) {
      setResults([])
      return
    }
    setLoading(true)
    try {
      const [projectsRes, documentsRes, profilesRes] = await Promise.all([
        supabase
          .from('projects')
          .select('id, title, description')
          .or(`title.ilike.%${q}%,description.ilike.%${q}%`)
          .limit(5),
        supabase
          .from('documents')
          .select('id, title, project_id')
          .ilike('title', `%${q}%`)
          .limit(5),
        supabase
          .from('profiles')
          .select('id, full_name, email, role')
          .or(`full_name.ilike.%${q}%,email.ilike.%${q}%`)
          .limit(4),
      ])

      const combined: SearchResult[] = []

      if (projectsRes.data) {
        projectsRes.data.forEach(p => combined.push({
          id: p.id,
          type: 'project',
          title: p.title,
          subtitle: p.description ?? undefined,
          href: `/projects/${p.id}`,
        }))
      }
      if (documentsRes.data) {
        documentsRes.data.forEach(d => combined.push({
          id: d.id,
          type: 'document',
          title: d.title,
          subtitle: `Project document`,
          href: `/projects/${d.project_id}/documents/${d.id}`,
        }))
      }
      if (profilesRes.data) {
        profilesRes.data.forEach(u => combined.push({
          id: u.id,
          type: 'person',
          title: u.full_name ?? u.email,
          subtitle: u.role,
          href: `/dashboard`,
        }))
      }

      setResults(combined)
      setSelectedIndex(0)
    } finally {
      setLoading(false)
    }
  }, [profile, supabase])

  useEffect(() => {
    const timer = setTimeout(() => search(query), 250)
    return () => clearTimeout(timer)
  }, [query, search])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, results.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && results[selectedIndex]) {
      router.push(results[selectedIndex].href)
      onClose()
    }
  }

  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    if (!acc[r.type]) acc[r.type] = []
    acc[r.type].push(r)
    return acc
  }, {})

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-lg mx-4 bg-white rounded-xl shadow-2xl border overflow-hidden">
        {/* Search input */}
        <div className="flex items-center px-4 py-3 border-b gap-3">
          {loading ? (
            <Loader2 className="h-4 w-4 text-muted-foreground animate-spin shrink-0" />
          ) : (
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search projects, documents, people..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
          <kbd className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground border rounded px-1.5 py-0.5">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[400px] overflow-y-auto">
          {!query && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Start typing to search across PLEXUS
            </div>
          )}

          {query && results.length === 0 && !loading && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No results for &ldquo;{query}&rdquo;
            </div>
          )}

          {Object.entries(grouped).map(([type, items]) => {
            const Icon = typeIcons[type as keyof typeof typeIcons]
            const color = typeColors[type as keyof typeof typeColors]
            const label = typeLabels[type as keyof typeof typeLabels]

            return (
              <div key={type}>
                <div className="px-4 py-2 text-xs font-semibold text-muted-foreground border-b bg-muted/30">
                  {label}
                </div>
                {items.map(item => {
                  const idx = results.indexOf(item)
                  return (
                    <button
                      key={item.id}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors',
                        idx === selectedIndex && 'bg-muted/50'
                      )}
                      onClick={() => { router.push(item.href); onClose() }}
                      onMouseEnter={() => setSelectedIndex(idx)}
                    >
                      <Icon className={cn('h-4 w-4 shrink-0', color)} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{item.title}</p>
                        {item.subtitle && (
                          <p className="text-xs text-muted-foreground truncate capitalize">{item.subtitle}</p>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t bg-muted/20 flex items-center gap-4 text-xs text-muted-foreground">
          <span><kbd className="border rounded px-1">↑↓</kbd> navigate</span>
          <span><kbd className="border rounded px-1">↵</kbd> open</span>
          <span><kbd className="border rounded px-1">ESC</kbd> close</span>
        </div>
      </div>
    </div>
  )
}
