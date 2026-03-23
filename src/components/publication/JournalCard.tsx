"use client"

import { ExternalLink, BookOpen, Globe, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface JournalTemplate {
  id: string
  name: string
  publisher: string | null
  issn: string | null
  impact_factor: number | null
  open_access: boolean
  formatting: {
    abstract?: { type?: string; word_limit?: number; sections?: string[] }
    word_limit?: number
    reference_style?: string
    reference_limit?: number
    sections?: string[]
    figure_format?: { max_figures?: number }
    table_format?: { max_tables?: number }
  }
  submission_url: string | null
  guidelines_url: string | null
  categories: string[]
}

interface JournalCardProps {
  journal: JournalTemplate
  onSelect?: (journal: JournalTemplate) => void
  selected?: boolean
}

export function JournalCard({ journal, onSelect, selected }: JournalCardProps) {
  const fmt = journal.formatting

  return (
    <div
      className={cn(
        'border rounded-xl p-4 bg-white transition-all duration-150',
        selected
          ? 'border-blue-500 ring-1 ring-blue-500'
          : 'border-gray-200 hover:border-gray-300 hover:shadow-sm',
        onSelect && 'cursor-pointer'
      )}
      onClick={() => onSelect?.(journal)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
            <BookOpen className="h-4 w-4 text-blue-600" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-gray-900 text-sm">{journal.name}</h3>
              {journal.open_access ? (
                <span className="flex items-center gap-0.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full">
                  <Globe className="h-2.5 w-2.5" /> Open Access
                </span>
              ) : (
                <span className="flex items-center gap-0.5 text-xs font-medium text-gray-500 bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded-full">
                  <Lock className="h-2.5 w-2.5" /> Subscription
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {journal.publisher && <span>{journal.publisher}</span>}
              {journal.issn && <span className="ml-2 text-gray-400">ISSN: {journal.issn}</span>}
            </p>
          </div>
        </div>
        {journal.impact_factor !== null && (
          <div className="text-right flex-shrink-0">
            <div className="text-sm font-bold text-gray-900">{journal.impact_factor.toFixed(1)}</div>
            <div className="text-xs text-gray-400">IF</div>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
        {fmt.abstract && (
          <span>
            Abstract: <span className="text-gray-900 font-medium capitalize">{fmt.abstract.type}</span>
            {fmt.abstract.word_limit && ` (${fmt.abstract.word_limit}w)`}
          </span>
        )}
        {fmt.word_limit && (
          <span>
            Words: <span className="text-gray-900 font-medium">{fmt.word_limit.toLocaleString()}</span>
          </span>
        )}
        {fmt.reference_style && (
          <span>
            Refs: <span className="text-gray-900 font-medium capitalize">{fmt.reference_style}</span>
            {fmt.reference_limit && ` (max ${fmt.reference_limit})`}
          </span>
        )}
        {fmt.figure_format?.max_figures && (
          <span>
            Figures: <span className="text-gray-900 font-medium">max {fmt.figure_format.max_figures}</span>
          </span>
        )}
      </div>

      {journal.categories.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {journal.categories.slice(0, 4).map(cat => (
            <span key={cat} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
              {cat.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        {onSelect && (
          <button
            onClick={(e) => { e.stopPropagation(); onSelect(journal) }}
            className="text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg transition-colors"
          >
            Format & Preview
          </button>
        )}
        {journal.submission_url && (
          <a
            href={journal.submission_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="text-xs font-medium text-gray-500 hover:text-gray-700 flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            Submit
          </a>
        )}
        {journal.guidelines_url && (
          <a
            href={journal.guidelines_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
          >
            <ExternalLink className="h-3 w-3" />
            Guidelines
          </a>
        )}
      </div>
    </div>
  )
}
