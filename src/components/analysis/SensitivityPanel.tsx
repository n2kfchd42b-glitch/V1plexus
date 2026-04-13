'use client'

import { useState } from 'react'
import type { SensitivityComparison } from '@/types/analyticsIntelligence'
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface SensitivityPanelProps {
  projectId: string
  datasetId: string
  versionId: string
  analysisType: string
  outcome: string
  exposure: string
  covariates?: string[]
}

function _fmt(v: number | null | undefined): string {
  if (v == null) return '—'
  return v.toFixed(3)
}

function _pLabel(p: number | null | undefined): string {
  if (p == null) return '—'
  if (p < 0.001) return '<0.001'
  return p.toFixed(3)
}

function _pColor(p: number | null | undefined): string {
  if (p == null) return 'text-slate-400'
  if (p < 0.05) return 'text-[#003d9b] font-semibold'
  return 'text-slate-500'
}

export function SensitivityPanel({
  projectId, datasetId, versionId, analysisType, outcome, exposure, covariates = [],
}: SensitivityPanelProps) {
  const [comparisons, setComparisons] = useState<SensitivityComparison[]>([])
  const [consistent, setConsistent] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)
  const [ran, setRan] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics/sensitivity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          dataset_id: datasetId,
          version_id: versionId,
          analysis_type: analysisType,
          outcome,
          exposure,
          covariates,
        }),
      })
      if (!res.ok) throw new Error('Sensitivity analysis failed')
      const json = await res.json()
      setComparisons(json.comparisons ?? [])
      setConsistent(json.consistent ?? null)
      setRan(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to run sensitivity panel')
    } finally {
      setLoading(false)
    }
  }

  if (!ran) {
    return (
      <div className="bg-white rounded-2xl p-6" style={{ boxShadow: '0 20px 50px rgba(0,24,72,0.04)' }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#0040a2] font-manrope mb-1">
              Sensitivity Analysis
            </p>
            <h3 className="font-manrope font-bold text-base text-[#18181B]">Methodological Comparisons</h3>
          </div>
        </div>
        <p className="text-xs text-slate-500 mb-5 leading-relaxed">
          Runs parallel analytical variants (unadjusted, adjusted, mean imputation, outlier exclusion, non-parametric)
          to assess robustness of your primary estimate.
        </p>
        {error && (
          <p className="text-xs text-red-600 mb-3">{error}</p>
        )}
        <Button size="sm" onClick={run} disabled={loading}>
          {loading ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Running…</> : 'Run Sensitivity Panel'}
        </Button>
      </div>
    )
  }

  if (!comparisons.length) {
    return (
      <div className="bg-white rounded-2xl p-6" style={{ boxShadow: '0 20px 50px rgba(0,24,72,0.04)' }}>
        <p className="text-xs text-slate-400">Sensitivity panel not available for this analysis type.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 20px 50px rgba(0,24,72,0.04)' }}>
      {/* Header */}
      <div className="px-6 py-5 border-b border-[#f2f4f6]">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#0040a2] font-manrope mb-1">
          Sensitivity Analysis
        </p>
        <div className="flex items-center justify-between">
          <h3 className="font-manrope font-bold text-base text-[#18181B]">Methodological Comparisons</h3>
          {consistent !== null && (
            <div className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
              consistent ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
            }`}>
              {consistent
                ? <><CheckCircle2 className="h-3.5 w-3.5" />Directionally consistent</>
                : <><AlertTriangle className="h-3.5 w-3.5" />Inconsistent direction</>
              }
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[#f8f9fb] border-b border-[#f2f4f6]">
              <th className="px-5 py-3 text-left font-bold text-slate-500 uppercase tracking-wider text-[10px]">Variant</th>
              <th className="px-4 py-3 text-right font-bold text-slate-500 uppercase tracking-wider text-[10px]">Estimate</th>
              <th className="px-4 py-3 text-right font-bold text-slate-500 uppercase tracking-wider text-[10px]">95% CI</th>
              <th className="px-4 py-3 text-right font-bold text-slate-500 uppercase tracking-wider text-[10px]">p-value</th>
              <th className="px-4 py-3 text-right font-bold text-slate-500 uppercase tracking-wider text-[10px]">n</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f2f4f6]">
            {comparisons.map((c, i) => (
              <tr key={i} className={`transition-colors ${c.method_variant === 'adjusted' || c.method_variant === 'adjusted_complete_case' ? 'bg-[var(--accent-primary)]/[0.02]' : 'hover:bg-slate-50'}`}>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    {(c.method_variant === 'adjusted' || c.method_variant === 'adjusted_complete_case') && (
                      <span className="text-[9px] bg-[var(--accent-primary)]/10 text-[#003d9b] rounded px-1.5 py-0.5 font-bold uppercase shrink-0">Primary</span>
                    )}
                    <span className="font-medium text-slate-700">{c.label}</span>
                  </div>
                  {c.note && <p className="text-[10px] text-slate-400 mt-0.5">{c.note}</p>}
                </td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-slate-800">
                  {c.metric_label} {_fmt(c.estimate)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-slate-500">
                  {c.ci_lower != null && c.ci_upper != null
                    ? `${_fmt(c.ci_lower)} – ${_fmt(c.ci_upper)}`
                    : '—'}
                </td>
                <td className={`px-4 py-3 text-right font-mono ${_pColor(c.p_value)}`}>
                  {_pLabel(c.p_value)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-slate-400">
                  {c.n?.toLocaleString() ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 bg-slate-50/50 border-t border-[#f2f4f6] flex justify-between items-center">
        <p className="text-[10px] text-slate-400">
          {comparisons.length} variants compared · Primary estimate highlighted
        </p>
        <button
          onClick={() => { setRan(false); setComparisons([]); }}
          className="text-[10px] text-slate-400 hover:text-slate-600 transition-colors"
        >
          Reset
        </button>
      </div>
    </div>
  )
}
