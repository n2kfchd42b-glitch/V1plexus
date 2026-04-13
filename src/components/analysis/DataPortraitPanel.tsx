'use client'

import { useState } from 'react'
import { useDataPortrait } from '@/hooks/useDataPortrait'
import type { VariableProfile, DataPortrait } from '@/types/analyticsIntelligence'
import { Loader2, RefreshCw, ChevronDown, ChevronRight, AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface DataPortraitPanelProps {
  datasetId: string
  projectId: string
  versionId: string | null
}

export function DataPortraitPanel({ datasetId, projectId, versionId }: DataPortraitPanelProps) {
  const { portrait, loading, triggering, error, triggerPortrait } = useDataPortrait(
    datasetId, projectId, versionId
  )
  const [expanded, setExpanded] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'variables' | 'recommendations'>('overview')

  if (!portrait && !loading && !error) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">◈</span>
            <h3 className="font-manrope font-bold text-base text-[#191c1e]">Data Portrait</h3>
          </div>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Automatically profiles your dataset: missingness patterns, variable distributions, and analysis recommendations.
        </p>
        <Button
          size="sm"
          onClick={triggerPortrait}
          disabled={triggering || !versionId}
          className="w-full"
        >
          {triggering ? <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" />Generating…</> : 'Generate Data Portrait'}
        </Button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-2 text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading portrait…</span>
        </div>
      </div>
    )
  }

  if (portrait?.status === 'running') {
    return (
      <div className="bg-white rounded-xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">◈</span>
          <h3 className="font-manrope font-bold text-base text-[#191c1e]">Data Portrait</h3>
        </div>
        <div className="flex items-center gap-2 text-blue-600 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Profiling dataset… this takes a few seconds.</span>
        </div>
      </div>
    )
  }

  if (portrait?.status === 'failed') {
    return (
      <div className="bg-white rounded-xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-2 text-red-600 text-sm mb-3">
          <AlertTriangle className="h-4 w-4" />
          <span>Portrait generation failed</span>
        </div>
        {portrait.error_message && <p className="text-xs text-slate-500 mb-3">{portrait.error_message}</p>}
        <Button size="sm" variant="outline" onClick={triggerPortrait} disabled={triggering || !versionId}>
          <RefreshCw className="h-3 w-3 mr-1.5" />Retry
        </Button>
      </div>
    )
  }

  if (!portrait) return null

  return (
    <div className="bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between p-6 text-left hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">◈</span>
          <h3 className="font-manrope font-bold text-base text-[#191c1e]">Data Portrait</h3>
          <MissingnessChip portrait={portrait} />
        </div>
        {expanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
      </button>

      {expanded && (
        <div className="border-t border-slate-100">
          {/* Summary strip */}
          <div className="grid grid-cols-3 divide-x divide-slate-100 bg-slate-50/50">
            {[
              { label: 'Rows', value: portrait.n_rows?.toLocaleString() ?? '—' },
              { label: 'Columns', value: portrait.n_columns?.toLocaleString() ?? '—' },
              { label: 'Missing', value: portrait.overall_missing_pct != null ? `${portrait.overall_missing_pct.toFixed(1)}%` : '—' },
            ].map(({ label, value }) => (
              <div key={label} className="px-4 py-3 text-center">
                <p className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">{label}</p>
                <p className="text-lg font-mono font-semibold text-[#003d9b]">{value}</p>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-100">
            {(['overview', 'variables', 'recommendations'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
                  activeTab === tab
                    ? 'text-[#003d9b] border-b-2 border-[#003d9b]'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          <div className="p-5">
            {activeTab === 'overview' && <OverviewTab portrait={portrait} />}
            {activeTab === 'variables' && <VariablesTab profiles={portrait.variable_profiles} />}
            {activeTab === 'recommendations' && <RecommendationsTab portrait={portrait} />}
          </div>

          {/* Refresh */}
          <div className="px-5 pb-4 flex justify-end">
            <button
              onClick={triggerPortrait}
              disabled={triggering || !versionId}
              className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-600 transition-colors"
            >
              <RefreshCw className={`h-3 w-3 ${triggering ? 'animate-spin' : ''}`} />
              Regenerate
            </button>
          </div>
        </div>
      )}
    </div>
  )
}


// ── Sub-components ────────────────────────────────────────────────────────────

function MissingnessChip({ portrait }: { portrait: DataPortrait }) {
  const pct = portrait.overall_missing_pct ?? 0
  if (pct === 0) return <span className="text-[10px] bg-green-100 text-green-700 rounded-full px-2 py-0.5 font-bold">No missing</span>
  if (pct < 5) return <span className="text-[10px] bg-amber-50 text-amber-700 rounded-full px-2 py-0.5 font-bold">{pct.toFixed(1)}% missing</span>
  return <span className="text-[10px] bg-red-50 text-red-600 rounded-full px-2 py-0.5 font-bold">{pct.toFixed(1)}% missing</span>
}

function OverviewTab({ portrait }: { portrait: DataPortrait }) {
  const patternInfo = {
    mcar: { label: 'MCAR', color: 'text-green-700 bg-green-50', desc: 'Missing Completely At Random — complete case analysis appropriate.' },
    mar:  { label: 'MAR',  color: 'text-amber-700 bg-amber-50',  desc: 'Missing At Random — multiple imputation recommended.' },
    mnar: { label: 'MNAR', color: 'text-red-700 bg-red-50',      desc: 'Missing Not At Random — requires sensitivity analysis.' },
    unknown: { label: 'Unknown', color: 'text-slate-600 bg-slate-100', desc: 'Pattern could not be determined.' },
  }
  const pattern = patternInfo[portrait.missing_pattern ?? 'unknown']

  return (
    <div className="space-y-4">
      {portrait.missing_pattern && portrait.overall_missing_pct && portrait.overall_missing_pct > 0 && (
        <div className={`rounded-lg p-3 ${pattern.color}`}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold">{pattern.label}</span>
            <Info className="h-3 w-3 opacity-60" />
          </div>
          <p className="text-xs leading-relaxed">{pattern.desc}</p>
          {portrait.missing_pattern_notes && (
            <p className="text-xs mt-1.5 opacity-80">{portrait.missing_pattern_notes}</p>
          )}
        </div>
      )}

      {/* Type breakdown */}
      <div>
        <p className="text-[10px] font-bold uppercase text-slate-400 tracking-widest mb-3">Variable types</p>
        <TypeBreakdown profiles={portrait.variable_profiles} />
      </div>

      {/* Completeness bars */}
      {portrait.overall_missing_pct && portrait.overall_missing_pct > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase text-slate-400 tracking-widest mb-3">Missingness by variable</p>
          <MissingnessBar profiles={portrait.variable_profiles} />
        </div>
      )}
    </div>
  )
}

function TypeBreakdown({ profiles }: { profiles: VariableProfile[] }) {
  const counts: Record<string, number> = {}
  profiles.forEach(p => { counts[p.dtype] = (counts[p.dtype] || 0) + 1 })
  const total = profiles.length || 1
  const colors: Record<string, string> = {
    numeric: 'bg-blue-500',
    categorical: 'bg-emerald-500',
    boolean: 'bg-purple-500',
    datetime: 'bg-amber-500',
    text: 'bg-slate-400',
  }

  return (
    <div className="space-y-2">
      {Object.entries(counts).map(([dtype, count]) => (
        <div key={dtype} className="flex items-center gap-3">
          <div className="w-20 text-[10px] text-slate-500 capitalize shrink-0">{dtype}</div>
          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${colors[dtype] || 'bg-slate-400'}`}
              style={{ width: `${(count / total) * 100}%` }}
            />
          </div>
          <div className="text-[10px] font-mono text-slate-400 w-5 text-right">{count}</div>
        </div>
      ))}
    </div>
  )
}

function MissingnessBar({ profiles }: { profiles: VariableProfile[] }) {
  const withMissing = profiles.filter(p => p.pct_missing > 0).sort((a, b) => b.pct_missing - a.pct_missing).slice(0, 10)
  if (!withMissing.length) return <p className="text-xs text-green-600">All variables complete.</p>

  return (
    <div className="space-y-1.5">
      {withMissing.map(p => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-24 text-[10px] font-mono text-slate-500 truncate shrink-0">{p.name}</div>
          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${p.pct_missing > 20 ? 'bg-red-400' : p.pct_missing > 5 ? 'bg-amber-400' : 'bg-slate-300'}`}
              style={{ width: `${p.pct_missing}%` }}
            />
          </div>
          <div className="text-[10px] font-mono text-slate-400 w-10 text-right">{p.pct_missing.toFixed(1)}%</div>
        </div>
      ))}
    </div>
  )
}

function VariablesTab({ profiles }: { profiles: VariableProfile[] }) {
  const [selected, setSelected] = useState<string | null>(null)

  return (
    <div className="space-y-1">
      {profiles.map(p => (
        <div key={p.name}>
          <button
            onClick={() => setSelected(selected === p.name ? null : p.name)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
              selected === p.name ? 'bg-[var(--accent-primary)]/5' : 'hover:bg-slate-50'
            }`}
          >
            <DtypeTag dtype={p.dtype} />
            <span className="text-xs font-mono text-slate-700 flex-1 truncate">{p.name}</span>
            {p.pct_missing > 0 && (
              <span className="text-[10px] text-amber-600 font-mono shrink-0">{p.pct_missing.toFixed(1)}% miss</span>
            )}
            {p.is_constant && <span className="text-[10px] bg-red-50 text-red-600 rounded px-1">constant</span>}
            {selected === p.name ? <ChevronDown className="h-3 w-3 text-slate-400 shrink-0" /> : <ChevronRight className="h-3 w-3 text-slate-400 shrink-0" />}
          </button>

          {selected === p.name && (
            <div className="mx-3 mb-2 p-3 bg-slate-50 rounded-lg border border-slate-100">
              <VariableDetail profile={p} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function DtypeTag({ dtype }: { dtype: string }) {
  const colors: Record<string, string> = {
    numeric: 'bg-blue-50 text-blue-600',
    categorical: 'bg-emerald-50 text-emerald-600',
    boolean: 'bg-purple-50 text-purple-600',
    datetime: 'bg-amber-50 text-amber-600',
    text: 'bg-slate-100 text-slate-500',
  }
  return (
    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0 ${colors[dtype] || 'bg-slate-100 text-slate-500'}`}>
      {dtype.slice(0, 3)}
    </span>
  )
}

function VariableDetail({ profile: p }: { profile: VariableProfile }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-1.5 text-xs">
        <span className="text-slate-400">Unique values</span>
        <span className="font-mono text-slate-700">{p.unique_count}</span>
        <span className="text-slate-400">Missing</span>
        <span className={`font-mono ${p.pct_missing > 0 ? 'text-amber-600' : 'text-slate-700'}`}>
          {p.n_missing} ({p.pct_missing.toFixed(1)}%)
        </span>
        {p.role_hint && <>
          <span className="text-slate-400">Role hint</span>
          <span className="text-slate-600 capitalize">{p.role_hint.replace(/_/g, ' ')}</span>
        </>}
      </div>

      {p.dtype === 'numeric' && (
        <div className="grid grid-cols-3 gap-1 text-[10px]">
          {[
            ['Mean', p.mean?.toFixed(3)],
            ['SD', p.sd?.toFixed(3)],
            ['Min', p.min?.toFixed(3)],
            ['Max', p.max?.toFixed(3)],
            ['Median', p.p50?.toFixed(3)],
            ['Outliers', p.outlier_count],
          ].map(([label, value]) => value != null && (
            <div key={String(label)} className="bg-white rounded p-1.5 border border-slate-100">
              <div className="text-slate-400">{label}</div>
              <div className="font-mono font-bold text-slate-700">{String(value)}</div>
            </div>
          ))}
        </div>
      )}

      {p.top_values && p.top_values.length > 0 && (
        <div>
          <p className="text-[10px] text-slate-400 mb-1">Top values</p>
          <div className="flex flex-wrap gap-1">
            {p.top_values.slice(0, 6).map(v => (
              <span key={v.value} className="text-[10px] bg-white border border-slate-200 rounded px-1.5 py-0.5 font-mono">
                {v.value} <span className="text-slate-400">({v.count})</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function RecommendationsTab({ portrait }: { portrait: DataPortrait }) {
  return (
    <div className="space-y-5">
      {portrait.analysis_recommendations.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase text-slate-400 tracking-widest mb-3">Suggested analyses</p>
          <div className="space-y-2">
            {portrait.analysis_recommendations.map((rec, i) => (
              <div key={i} className="flex items-start gap-2 bg-blue-50/60 rounded-lg p-3">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#003d9b] mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-[#003d9b]">{rec.analysis_type.replace(/_/g, ' ')}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{rec.reason}</p>
                </div>
                <span className={`ml-auto text-[9px] font-bold uppercase shrink-0 px-1.5 py-0.5 rounded ${
                  rec.confidence === 'high' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                }`}>{rec.confidence}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {portrait.imputation_recommendations.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase text-slate-400 tracking-widest mb-3">Imputation recommendations</p>
          <div className="space-y-2">
            {portrait.imputation_recommendations.map((rec, i) => (
              <div key={i} className="flex items-start gap-2 bg-amber-50/60 rounded-lg p-3">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-slate-700 font-mono">{rec.variable}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{rec.reason}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!portrait.analysis_recommendations.length && !portrait.imputation_recommendations.length && (
        <p className="text-xs text-slate-400 italic">No specific recommendations.</p>
      )}
    </div>
  )
}
