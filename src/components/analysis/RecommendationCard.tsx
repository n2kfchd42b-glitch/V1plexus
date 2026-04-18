"use client"

import { Play, Settings2, AlertTriangle } from 'lucide-react'
import { FeasibilityChecks } from './FeasibilityChecks'
import { WorkflowSteps } from './WorkflowSteps'
import type { AnalysisRecommendation, AnalysisTypeId } from '@/lib/decision-engine/types'

interface Props {
  recommendation: AnalysisRecommendation
  onRun: () => void
  onConfigureManually: () => void
  onRunAlternative: (id: AnalysisTypeId) => void
}

export function RecommendationCard({ recommendation, onRun, onConfigureManually, onRunAlternative }: Props) {
  const { primary_name, reasoning, feasibility, can_run, workflow_steps, alternatives, flags, strobe_items_auto, reporting_guideline } = recommendation

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        border: '1px solid var(--border-default)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {/* Header — blue gradient */}
      <div
        className="px-5 py-4"
        style={{ background: 'linear-gradient(135deg,var(--color-clinical-deep),var(--color-clinical-blue))' }}
      >
        <div className="flex items-center gap-2 mb-2">
          <span
            className="text-[10px] font-bold uppercase tracking-[0.08em] px-2 py-0.5 rounded"
            style={{ background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.9)' }}
          >
            PLEXUS recommends
          </span>
        </div>
        <h3
          className="text-lg font-bold tracking-tight text-white mb-2"
          style={{ fontFamily: 'var(--font-manrope)' }}
        >
          {primary_name}
        </h3>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.8)', lineHeight: '1.5' }}>
          {reasoning}
        </p>
      </div>

      {/* Body */}
      <div className="divide-y divide-[var(--border-subtle)]">

        {/* Feasibility checks */}
        <div className="px-5 py-4">
          <p className="subsection-label mb-3">Feasibility Checks</p>
          <FeasibilityChecks checks={feasibility} />
        </div>

        {/* Workflow steps */}
        {workflow_steps.length > 0 && (
          <div className="px-5 py-4">
            <p className="subsection-label mb-3">Recommended Workflow</p>
            <WorkflowSteps steps={workflow_steps} />
          </div>
        )}

        {/* Alternatives */}
        {alternatives.length > 0 && (
          <div className="px-5 py-4">
            <p className="subsection-label mb-2">Also Consider</p>
            <div className="flex flex-col gap-2">
              {alternatives.map(alt => (
                <button
                  key={alt.analysis_type}
                  onClick={() => onRunAlternative(alt.analysis_type as AnalysisTypeId)}
                  className="w-full text-left px-3 py-2.5 rounded-lg transition-all duration-150 cursor-pointer"
                  style={{
                    background: 'var(--bg-app)',
                    border: '1px solid var(--border-default)',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'var(--accent-blue)'
                    e.currentTarget.style.background = 'var(--accent-blue-subtle)'
                    const arrow = e.currentTarget.querySelector<HTMLElement>('.run-arrow')
                    if (arrow) arrow.style.opacity = '1'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--border-default)'
                    e.currentTarget.style.background = 'var(--bg-app)'
                    const arrow = e.currentTarget.querySelector<HTMLElement>('.run-arrow')
                    if (arrow) arrow.style.opacity = '0'
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {alt.name}
                    </p>
                    <span className="run-arrow text-[10px] font-semibold flex-shrink-0 transition-opacity duration-150" style={{ color: 'var(--accent-blue)', opacity: 0 }}>
                      Run →
                    </span>
                  </div>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    {alt.reason}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STROBE */}
        {strobe_items_auto.length > 0 && (
          <div className="px-5 py-3">
            <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
              <span className="font-semibold">{reporting_guideline} items</span> that will be
              auto-populated:{' '}
              <span
                className="font-mono tabular-nums"
                style={{ color: 'var(--accent-blue)' }}
              >
                {strobe_items_auto.join(', ')}
              </span>
            </p>
          </div>
        )}

        {/* Limitation flags */}
        {flags.length > 0 && (
          <div className="px-5 py-3 space-y-2">
            {flags.map((flag, i) => (
              <div
                key={i}
                className="flex items-start gap-2 px-3 py-2 rounded-lg"
                style={{
                  background:
                    flag.severity === 'warning'
                      ? 'var(--status-warning-bg)'
                      : 'var(--accent-blue-subtle)',
                  border:
                    flag.severity === 'warning'
                      ? '1px solid var(--border-status-warning)'
                      : '1px solid var(--border-status-info)',
                }}
              >
                <AlertTriangle
                  className="h-3.5 w-3.5 flex-shrink-0 mt-px"
                  style={{
                    color: flag.severity === 'warning' ? 'var(--status-warning-text)' : 'var(--accent-blue)',
                  }}
                />
                <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                  {flag.message}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer run bar */}
      <div
        className="px-5 py-3 flex items-center gap-3"
        style={{
          background: 'var(--bg-app)',
          borderTop: '1px solid var(--border-default)',
        }}
      >
        <p className="text-[11px] flex-1" style={{ color: 'var(--text-tertiary)' }}>
          {can_run
            ? 'All checks passed. Ready to run.'
            : 'Some checks failed. Review before running.'}
        </p>
        <button
          onClick={onConfigureManually}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
          style={{
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-default)',
            background: 'var(--bg-surface)',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-surface-hover)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-surface)' }}
        >
          <Settings2 className="h-3 w-3" />
          Configure manually
        </button>
        <button
          onClick={onRun}
          disabled={!can_run}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-all"
          style={{ background: 'linear-gradient(135deg,#003d9b,#0052cc)' }}
        >
          <Play className="h-3 w-3" />
          Run Workflow
        </button>
      </div>
    </div>
  )
}
