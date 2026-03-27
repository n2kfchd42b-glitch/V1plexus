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
    // Percentages stored as decimals < 1
    if (Math.abs(val) <= 1 && val !== 0 && String(val).length > 4) return val.toFixed(3)
    return val.toLocaleString(undefined, { maximumFractionDigits: 3 })
  }
  return String(val)
}

type Badge = { label: string; cls: string }

function getStatBadge(key: string, val: unknown): Badge | null {
  const k = key.toLowerCase()
  const num = Number(val)
  if (isNaN(num)) return null

  if (k.includes('pval') || k === 'p' || k.includes('p_val') || k.includes('p-val')) {
    if (num < 0.001) return { label: 'p<0.001 ***', cls: 'bg-[#eff6ff] text-[#003d9b]' }
    if (num < 0.01)  return { label: 'p<0.01 **',   cls: 'bg-[#eff6ff] text-[#003d9b]' }
    if (num < 0.05)  return { label: 'Significant',  cls: 'bg-[#eff6ff] text-[#003d9b]' }
    return { label: 'Not significant', cls: 'bg-[#f2f4f6] text-[#52525B]' }
  }
  if (k.includes('auc') || k.includes('roc')) {
    if (num >= 0.8)  return { label: 'Good discrimination', cls: 'bg-[#f0fdf4] text-[#166534]' }
    if (num >= 0.7)  return { label: 'Acceptable',           cls: 'bg-[#fffbeb] text-[#b45309]' }
    return { label: 'Poor discrimination', cls: 'bg-[#fef2f2] text-[#991B1B]' }
  }
  if (k.includes('r2') || k.includes('r_squared') || k.includes('rsquared')) {
    return { label: 'Pseudo R²', cls: 'bg-[#fffbeb] text-[#b45309]' }
  }
  if (k === 'n' || k === 'samplen' || k === 'samplesize') {
    return { label: 'Complete cases', cls: 'bg-[#f0fdf4] text-[#166534]' }
  }
  return null
}

// Decide text color for the large number — blue for primary metrics
const PRIMARY_KEYS = new Set(['prevalence', 'incidence', 'auc', 'roc', 'or', 'hr', 'irr', 'rr'])

function getValueColor(key: string): string {
  const k = key.toLowerCase().replace(/[^a-z]/g, '')
  for (const pk of PRIMARY_KEYS) {
    if (k.includes(pk)) return '#003d9b'
  }
  return '#18181B'
}

export function SummaryBox({ analysisType, summary }: Props) {
  const pairs = Object.entries(summary)
    .filter(([k]) => k !== 'error')
    .slice(0, 8)

  if (summary.error) {
    return (
      <div className="rounded-2xl bg-[#FEF2F2] p-5" style={{ boxShadow: '0 20px 50px rgba(0,24,72,0.04)' }}>
        <p className="text-sm font-semibold text-[#991B1B]">Analysis Error</p>
        <p className="text-xs text-[#52525B] mt-1">{String(summary.error)}</p>
      </div>
    )
  }

  if (pairs.length === 0) return null

  return (
    <div className={`grid gap-4 ${pairs.length === 1 ? 'grid-cols-1 max-w-xs' : pairs.length === 2 ? 'grid-cols-2' : pairs.length === 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'}`}>
      {pairs.map(([key, val]) => {
        const badge = getStatBadge(key, val)
        const valColor = getValueColor(key)
        return (
          <div
            key={key}
            className="bg-white rounded-2xl px-6 py-5 transition-all duration-200 hover:-translate-y-0.5 cursor-default"
            style={{ boxShadow: '0 20px 50px rgba(0,24,72,0.04), 0 4px 12px rgba(0,24,72,0.03)' }}
          >
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#A1A1AA] mb-2 truncate font-manrope">
              {formatKey(key)}
            </p>
            <p
              className="font-manrope font-extrabold text-[1.75rem] leading-none mb-2.5 truncate"
              style={{ color: valColor }}
            >
              {formatValue(val)}
            </p>
            {badge && (
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-[0.08em] ${badge.cls}`}>
                {badge.label}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
