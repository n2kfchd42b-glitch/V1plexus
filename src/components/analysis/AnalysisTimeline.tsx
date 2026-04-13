'use client'

import { useState, useEffect } from 'react'
import type { TimelineEntry } from '@/types/analyticsIntelligence'
import { GitCommit, GitBranch, Star } from 'lucide-react'

interface AnalysisTimelineProps {
  datasetId: string
}

function _pFmt(p: number | null | undefined): string {
  if (p == null) return '—'
  if (p < 0.001) return 'p<0.001'
  return `p=${p.toFixed(3)}`
}

function _statusColor(status: TimelineEntry['assumption_status']) {
  if (status === 'green') return 'bg-green-400'
  if (status === 'amber') return 'bg-amber-400'
  if (status === 'red') return 'bg-red-400'
  return 'bg-slate-300'
}

export function AnalysisTimeline({ datasetId }: AnalysisTimelineProps) {
  const [entries, setEntries] = useState<TimelineEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!datasetId) return
    setLoading(true)
    fetch(`/api/analytics/timeline/${datasetId}`)
      .then(r => r.json())
      .then(d => setEntries(d.entries || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [datasetId])

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
        <p className="text-xs text-slate-400">Loading analysis timeline…</p>
      </div>
    )
  }

  if (!entries.length) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-2 mb-2">
          <GitBranch className="h-4 w-4 text-slate-400" />
          <h3 className="font-manrope font-bold text-base text-[#191c1e]">Analysis Timeline</h3>
        </div>
        <p className="text-xs text-slate-400">No analyses recorded yet. Run an analysis to begin building a timeline.</p>
      </div>
    )
  }

  // Group by branch
  const branches = [...new Set(entries.map(e => e.branch_name))]

  return (
    <div className="bg-white rounded-xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
      <div className="flex items-center gap-2 mb-5">
        <GitBranch className="h-4 w-4 text-[#003d9b]" />
        <h3 className="font-manrope font-bold text-base text-[#191c1e]">Analysis Timeline</h3>
        <span className="text-[10px] bg-[var(--accent-primary)]/10 text-[#003d9b] rounded-full px-2 py-0.5 font-mono">{entries.length}</span>
      </div>

      <div className="space-y-6">
        {branches.map(branch => {
          const branchEntries = entries.filter(e => e.branch_name === branch)
          return (
            <div key={branch}>
              {branches.length > 1 && (
                <div className="flex items-center gap-2 mb-3">
                  <GitBranch className="h-3 w-3 text-slate-400" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{branch}</span>
                </div>
              )}

              <div className="relative pl-5">
                {/* Vertical line */}
                <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-slate-100" />

                <div className="space-y-4">
                  {branchEntries.map((entry, idx) => (
                    <TimelineNode key={entry.id} entry={entry} isLast={idx === branchEntries.length - 1} />
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TimelineNode({ entry, isLast }: { entry: TimelineEntry; isLast: boolean }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="relative">
      {/* Node dot */}
      <div className="absolute -left-5 top-1 flex items-center justify-center">
        <div className={`w-4 h-4 rounded-full border-2 border-white shadow-sm ${_statusColor(entry.assumption_status)} flex items-center justify-center`}>
          {entry.is_primary && <Star className="h-2 w-2 text-white fill-white" />}
          {!entry.is_primary && entry.parent_id && <GitCommit className="h-2 w-2 text-white" />}
        </div>
      </div>

      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full text-left"
      >
        <div className="bg-slate-50 hover:bg-slate-100 rounded-lg px-3 py-2.5 transition-colors">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-slate-700">
              {entry.label || entry.analysis_type.replace(/_/g, ' ')}
            </span>
            {entry.causal_dag_id && (
              <span className="text-[9px] bg-purple-100 text-purple-600 rounded px-1 font-bold">DAG-adjusted</span>
            )}
          </div>

          {entry.key_result && (
            <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500">
              <span className="text-[#003d9b] font-bold">
                {entry.key_result.metric_label} = {entry.key_result.estimate?.toFixed(3)}
              </span>
              {entry.key_result.ci_lower != null && entry.key_result.ci_upper != null && (
                <span>(95% CI: {entry.key_result.ci_lower.toFixed(3)}–{entry.key_result.ci_upper.toFixed(3)})</span>
              )}
              <span>{_pFmt(entry.key_result.p_value)}</span>
            </div>
          )}

          <div className="text-[9px] text-slate-400 mt-1">
            {new Date(entry.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
        </div>
      </button>

      {expanded && entry.variables && (
        <div className="mt-1 ml-1 px-3 py-2 bg-white border border-slate-100 rounded-lg">
          <div className="flex flex-wrap gap-2 text-[10px]">
            {Object.entries(entry.variables).map(([k, v]) => (
              <span key={k} className="text-slate-500">
                <span className="font-bold text-slate-400 uppercase">{k}:</span>{' '}
                <span className="font-mono">{Array.isArray(v) ? v.join(', ') : String(v)}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
