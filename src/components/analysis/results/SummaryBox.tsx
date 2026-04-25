"use client"

import { formatStatKey, formatStatValue, pValueBadge } from '@/lib/analysis/formatStats'
import type { AnalysisType } from '@/types/database'

interface Props {
  analysisType: AnalysisType
  summary: Record<string, unknown>
  title?: string
  datasetName?: string
}

// Keys that carry no value in a summary display
const SKIP_KEYS = new Set(['error', 'type', 'method', 'note', 'warning'])

// Badge variant styling
const SIG_BADGE: Record<string, string> = {
  '***': 'bg-[var(--accent-primary)] text-white',
  '**':  'bg-[var(--accent-primary)]/80 text-white',
  '*':   'bg-[var(--accent-blue)] text-white',
  '†':   'bg-[var(--bg-inset)] text-[var(--text-secondary)]',
  'ns':  'bg-[var(--bg-inset)] text-[var(--text-tertiary)]',
}

export function SummaryBox({ summary }: Props) {
  if (summary.error) {
    return (
      <div className="rounded border border-[var(--status-error)]/20 bg-[var(--status-error-bg)] px-4 py-3">
        <p className="text-xs font-semibold text-[var(--status-error-text)]">Analysis Error</p>
        <p className="text-xs text-[var(--text-secondary)] mt-1">{String(summary.error)}</p>
      </div>
    )
  }

  const pairs = Object.entries(summary)
    .filter(([k, v]) => !SKIP_KEYS.has(k) && v !== null && v !== undefined && v !== '')
    .slice(0, 10)

  if (pairs.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2 py-3 border-b border-[var(--border-row)]">
      {pairs.map(([key, val]) => {
        const badge = pValueBadge(key, val)

        return (
          <div
            key={key}
            className="flex items-baseline gap-2 px-3 py-2 rounded-md border border-[var(--border-row)] bg-[var(--bg-surface)]"
          >
            <span className="text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider leading-none">
              {formatStatKey(key)}
            </span>
            <span className="text-sm font-semibold text-[var(--text-primary)] font-mono tabular-nums">
              {badge ? badge.label : formatStatValue(val)}
            </span>
            {badge && (
              <span className={`text-[9px] font-bold px-1 py-0.5 rounded leading-none ${SIG_BADGE[badge.sig] ?? SIG_BADGE['ns']}`}>
                {badge.sig}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
