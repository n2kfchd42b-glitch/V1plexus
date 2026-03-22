"use client"

import { useState, useEffect, useRef } from 'react'
import { Sparkles, ChevronDown, ChevronUp, RefreshCw, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { AnalysisType } from '@/types/database'
import type { SuggestRequest, AnalysisSuggestion } from '@/app/api/analysis/suggest/route'

interface Props {
  projectId: string
  projectTitle: string
  projectDescription?: string | null
  methodology?: string | null
  researchObjectives?: string | null
  columns?: Array<{ name: string; type: string; unique_values?: number; missing?: number }>
  onSelect: (type: AnalysisType) => void
  selectedType: AnalysisType | null
}

const CONFIDENCE_STYLES = {
  high:   'bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800',
  medium: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  low:    'bg-[var(--bg-inset)] text-[var(--text-tertiary)] border-[var(--border-default)]',
}

export function AISuggestions({
  projectId, projectTitle, projectDescription, methodology, researchObjectives, columns, onSelect, selectedType
}: Props) {
  const [suggestions, setSuggestions] = useState<AnalysisSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [ran, setRan] = useState(false)
  // Track what we last fetched with to avoid redundant calls
  const lastFetchKey = useRef<string>('')

  const fetchKey = [projectId, columns?.length ?? 0, methodology ?? '', researchObjectives ?? ''].join('|')

  useEffect(() => {
    if (lastFetchKey.current === fetchKey) return
    lastFetchKey.current = fetchKey
    fetchSuggestions()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchKey])

  const fetchSuggestions = async () => {
    setLoading(true)
    setError(null)
    setRan(true)
    try {
      const body: SuggestRequest = {
        projectTitle,
        projectDescription,
        methodology,
        researchObjectives,
        columns,
      }
      const res = await fetch('/api/analysis/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Request failed')
      setSuggestions(json.suggestions ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load suggestions')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] overflow-hidden mb-5">
      {/* Header */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--bg-inset)] transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
            <Sparkles className="h-3.5 w-3.5 text-white" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-[var(--text-primary)]">AI Analysis Suggestions</p>
            {!collapsed && (
              <p className="text-xs text-[var(--text-tertiary)]">
                Based on your project context{columns && columns.length > 0 ? ' and dataset columns' : ''}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!collapsed && ran && !loading && (
            <button
              onClick={e => { e.stopPropagation(); fetchSuggestions() }}
              title="Refresh suggestions"
              className="h-6 w-6 rounded flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          )}
          {collapsed ? <ChevronDown className="h-4 w-4 text-[var(--text-tertiary)]" /> : <ChevronUp className="h-4 w-4 text-[var(--text-tertiary)]" />}
        </div>
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 border-t border-[var(--border-default)]">
          {loading && (
            <div className="flex items-center gap-2 py-5 text-sm text-[var(--text-tertiary)]">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Analysing your research context…
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 py-4 text-sm text-[var(--text-secondary)]">
              <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-[var(--text-primary)]">Could not load suggestions</p>
                <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{error}</p>
                <Button size="sm" variant="outline" className="mt-2 h-7 text-xs" onClick={fetchSuggestions}>
                  Try again
                </Button>
              </div>
            </div>
          )}

          {!loading && !error && suggestions.length > 0 && (
            <div className="grid gap-2 pt-3">
              {suggestions.map((s, i) => (
                <button
                  key={s.type}
                  onClick={() => onSelect(s.type)}
                  className={`w-full text-left rounded-lg border p-3 transition-all hover:shadow-sm ${
                    selectedType === s.type
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 ring-1 ring-blue-500'
                      : 'border-[var(--border-default)] hover:border-[var(--border-strong)] bg-[var(--bg-surface)]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span className={`flex-shrink-0 h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5 ${
                        i === 0 ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : 'bg-[var(--bg-inset)] text-[var(--text-tertiary)]'
                      }`}>
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--text-primary)] leading-tight">{s.label}</p>
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5 leading-relaxed">{s.reason}</p>
                      </div>
                    </div>
                    <span className={`flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded border capitalize ${CONFIDENCE_STYLES[s.confidence]}`}>
                      {s.confidence}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {!loading && !error && suggestions.length === 0 && ran && (
            <p className="text-sm text-[var(--text-tertiary)] py-4 text-center">
              No suggestions generated. Add a methodology or load a dataset for better results.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
