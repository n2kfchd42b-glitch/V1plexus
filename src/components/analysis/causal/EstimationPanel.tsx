'use client'

/**
 * EstimationPanel — side-by-side comparison of PSM, IPW, and Doubly Robust results.
 * Shows per-method status, ATE + CI, p-value, and covariate balance summary.
 */

import { Loader2, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import type { EstimationResult } from '@/types/causalEstimation'

interface EstimationPanelProps {
  results: EstimationResult[]
  exposure: string
  outcome: string
}

const METHOD_META = {
  psm:            { label: 'Propensity Score Matching', short: 'PSM',   color: 'blue' },
  ipw:            { label: 'Inverse Probability Weighting', short: 'IPW', color: 'violet' },
  doubly_robust:  { label: 'Doubly Robust', short: 'DR',  color: 'emerald' },
} as const

function fmt(v: number | null | undefined, digits = 3) {
  return v == null ? '—' : v.toFixed(digits)
}

function pLabel(p: number | null | undefined) {
  if (p == null) return '—'
  if (p < 0.001) return '< 0.001'
  return p.toFixed(3)
}

function StatusBadge({ status }: { status: EstimationResult['status'] }) {
  if (status === 'complete')
    return <span className="flex items-center gap-1 text-emerald-600 text-xs font-semibold"><CheckCircle2 className="w-3.5 h-3.5" />Complete</span>
  if (status === 'failed')
    return <span className="flex items-center gap-1 text-red-500 text-xs font-semibold"><XCircle className="w-3.5 h-3.5" />Failed</span>
  if (status === 'running')
    return <span className="flex items-center gap-1 text-blue-500 text-xs font-semibold"><Loader2 className="w-3.5 h-3.5 animate-spin" />Running</span>
  return <span className="text-gray-400 text-xs">Pending</span>
}

function BalanceSummary({ rows }: { rows: EstimationResult['balance_table'] }) {
  if (!rows?.length) return null
  const balanced = rows.filter((r) => r.balanced).length
  const total = rows.length
  const pct = Math.round((balanced / total) * 100)
  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <p className="text-xs text-gray-500 mb-1.5 font-medium">Covariate balance</p>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${pct >= 80 ? 'bg-emerald-400' : pct >= 60 ? 'bg-amber-400' : 'bg-red-400'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-xs font-mono text-gray-500">{balanced}/{total} balanced</span>
      </div>
      <div className="mt-2 space-y-1 max-h-24 overflow-y-auto">
        {rows.map((r) => (
          <div key={r.variable} className="flex items-center justify-between text-[10px]">
            <span className="font-mono text-gray-500 truncate max-w-[100px]">{r.variable}</span>
            <span className={`font-mono ${r.balanced ? 'text-emerald-600' : 'text-amber-600'}`}>
              {r.smd_after.toFixed(3)} {r.balanced ? '✓' : '!'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function EstimationPanel({ results, exposure, outcome }: EstimationPanelProps) {
  const methodOrder: EstimationResult['method'][] = ['doubly_robust', 'psm', 'ipw']

  // Create placeholder rows for methods not yet started
  const allResults = methodOrder.map((method) => {
    return results.find((r) => r.method === method) ?? {
      id: method, dag_id: '', dataset_id: '', project_id: '',
      method, ate: null, att: null,
      ate_ci_lower: null, ate_ci_upper: null,
      att_ci_lower: null, att_ci_upper: null,
      std_error: null, p_value: null,
      diagnostics: {}, balance_table: [], bootstrap_estimates: [],
      status: 'pending' as const,
      error_message: null, created_by: null, created_at: '', completed_at: null,
    }
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          Causal effect of <span className="font-semibold text-blue-600">{exposure}</span> on{' '}
          <span className="font-semibold text-emerald-600">{outcome}</span>
        </p>
        <p className="text-[10px] text-gray-400">ATE = Average Treatment Effect</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {allResults.map((result) => {
          const meta = METHOD_META[result.method]
          const colorMap = {
            blue: 'border-blue-100 bg-blue-50/30',
            violet: 'border-violet-100 bg-violet-50/30',
            emerald: 'border-emerald-100 bg-emerald-50/30',
          }
          const textMap = {
            blue: 'text-blue-700',
            violet: 'text-violet-700',
            emerald: 'text-emerald-700',
          }
          const isComplete = result.status === 'complete'

          return (
            <div
              key={result.method}
              className={`rounded-xl border p-4 ${colorMap[meta.color]}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className={`text-xs font-bold uppercase tracking-wide ${textMap[meta.color]}`}>
                    {meta.short}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{meta.label}</p>
                </div>
                <StatusBadge status={result.status} />
              </div>

              {isComplete ? (
                <>
                  <div className="space-y-2">
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide font-bold mb-0.5">ATE</p>
                      <p className="text-2xl font-mono font-semibold text-gray-900">
                        {fmt(result.ate)}
                      </p>
                      {result.ate_ci_lower != null && result.ate_ci_upper != null && (
                        <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                          95% CI: {fmt(result.ate_ci_lower)} to {fmt(result.ate_ci_upper)}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-4">
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide font-bold">p-value</p>
                        <p className={`text-sm font-mono font-semibold ${
                          result.p_value != null && result.p_value < 0.05
                            ? 'text-emerald-700' : 'text-gray-600'
                        }`}>
                          {pLabel(result.p_value)}
                        </p>
                      </div>
                      {result.std_error != null && (
                        <div>
                          <p className="text-[10px] text-gray-400 uppercase tracking-wide font-bold">SE</p>
                          <p className="text-sm font-mono text-gray-600">{fmt(result.std_error)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <BalanceSummary rows={result.balance_table} />

                  {(result.diagnostics as any)?.note && (
                    <p className="text-[10px] text-gray-400 italic mt-2">
                      {(result.diagnostics as any).note}
                    </p>
                  )}
                </>
              ) : result.status === 'failed' ? (
                <div className="flex items-start gap-2 text-xs text-red-600 mt-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  {result.error_message || 'Estimation failed'}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-gray-400 py-4">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {result.status === 'running' ? 'Computing…' : 'Waiting to start…'}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
