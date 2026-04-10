"use client"

import type { AnalysisType } from '@/types/database'

interface Props {
  analysisType: AnalysisType
  summary: Record<string, unknown>
  title?: string
  datasetName?: string
}

function formatKey(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .trim()
    .replace(/^./, c => c.toUpperCase())
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return '—'
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return val.toLocaleString()
    if (Math.abs(val) <= 1 && val !== 0 && String(val).length > 4) return val.toFixed(3)
    return val.toLocaleString(undefined, { maximumFractionDigits: 3 })
  }
  return String(val)
}

function getSignificanceLabel(key: string, val: unknown): string | null {
  const k = key.toLowerCase()
  const num = Number(val)
  if (isNaN(num)) return null
  if (k.includes('pval') || k === 'p' || k.includes('p_val') || k.includes('p-val')) {
    if (num < 0.001) return 'p<0.001 ***'
    if (num < 0.01)  return 'p<0.01 **'
    if (num < 0.05)  return 'sig'
    return 'ns'
  }
  return null
}

export function SummaryBox({ summary }: Props) {
  const pairs = Object.entries(summary)
    .filter(([k]) => k !== 'error')
    .slice(0, 8)

  if (summary.error) {
    return (
      <div className="rounded border border-[var(--timeline-flagged)]/20 bg-red-50 px-4 py-3">
        <p className="text-xs font-medium text-[var(--timeline-flagged)]">Analysis Error</p>
        <p className="text-xs text-[var(--text-secondary)] mt-1">{String(summary.error)}</p>
      </div>
    )
  }

  if (pairs.length === 0) return null

  return (
    <div className="flex flex-wrap gap-3 py-3 border-b border-[var(--border-row)]">
      {pairs.map(([key, val]) => {
        const sig = getSignificanceLabel(key, val)
        return (
          <div key={key} className="flex items-baseline gap-2 px-3 py-2 rounded border border-[var(--border-row)] bg-white">
            <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">{formatKey(key)}</span>
            <span className="text-sm font-semibold text-[var(--text-primary)]">{formatValue(val)}</span>
            {sig && (
              <span className="text-[10px] text-[var(--accent-blue)]">{sig}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
