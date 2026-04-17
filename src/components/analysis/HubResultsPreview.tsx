"use client"

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Database } from 'lucide-react'
import { AnimatePresence } from 'framer-motion'
import { AnalysisCharts } from './results/AnalysisCharts'
import { ReasoningPrompt } from './ReasoningPrompt'
import { createClient } from '@/lib/supabase/client'
import { logAudit } from '@/lib/audit'
import { generatePlainLanguageSummary } from '@/lib/analysis/plainLanguage'
import { formatRelative } from '@/lib/utils'
import type { AnalysisResult } from '@/lib/analysis/types'
import type { AnalysisRun, AnalysisType } from '@/types/database'
import { ANALYSIS_TYPES } from './AnalysisTypePicker'

const DIAGNOSTIC_CHART_TYPES = new Set(['residual_plot', 'acf_plot', 'funnel_plot'])

type ChartSpec = { type: string; title: string; data: unknown[]; config: Record<string, unknown> }

function formatKey(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim().replace(/^./, c => c.toUpperCase())
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return '—'
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return val.toLocaleString()
    return val.toLocaleString(undefined, { maximumFractionDigits: 3 })
  }
  return String(val)
}

interface Props {
  run: AnalysisRun
  result: AnalysisResult
  projectId: string
}

export function HubResultsPreview({ run, result, projectId }: Props) {
  const [promptDismissed, setPromptDismissed] = useState(false)

  const typeInfo  = ANALYSIS_TYPES.find(t => t.type === run.analysis_type)
  const dataset   = run.dataset as { name: string } | null | undefined
  const showPrompt = !promptDismissed && run.user_reasoning === null

  const statPills = Object.entries(result.summary ?? {})
    .filter(([k]) => k !== 'error')
    .slice(0, 4)

  const primaryChart = (result.charts as ChartSpec[]).find(
    c => !DIAGNOSTIC_CHART_TYPES.has(c.type)
  )

  const datasetName = dataset?.name ?? 'the dataset'
  const finding = generatePlainLanguageSummary(result, run.analysis_type, datasetName)

  return (
    <div className="flex flex-col h-full overflow-y-auto">

      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-[var(--border-row)] flex items-start justify-between gap-4 flex-shrink-0">
        <div className="min-w-0">
          <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider font-medium mb-0.5">
            {typeInfo?.label ?? run.analysis_type.replace(/_/g, ' ')}
          </p>
          <h2 className="text-sm font-semibold text-[var(--text-primary)] truncate">
            {run.title ?? typeInfo?.label}
          </h2>
          <p className="data-mono-xs text-[var(--text-tertiary)] mt-0.5 flex items-center gap-1.5">
            {dataset && (
              <>
                <Database className="h-3 w-3" />
                {dataset.name}
                <span className="text-[var(--border-strong)]">·</span>
              </>
            )}
            {formatRelative(run.created_at)}
          </p>
        </div>
        <Link
          href={`/projects/${projectId}/analysis/${run.id}`}
          className="flex-shrink-0 flex items-center gap-1 text-xs font-medium text-[var(--accent-blue)] hover:underline whitespace-nowrap mt-0.5"
        >
          Full Results
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Reasoning prompt — fades in if no note yet */}
      <AnimatePresence>
        {showPrompt && (
          <ReasoningPrompt
            onSaveNote={async (text) => {
              const supabase = createClient()
              const { error } = await supabase
                .from('analysis_runs')
                .update({ user_reasoning: text })
                .eq('id', run.id)
              if (!error) {
                void logAudit('analysis.reasoning_added', 'analysis_run', run.id, { length: text.length }, projectId)
              }
              setPromptDismissed(true)
            }}
            onDismiss={() => setPromptDismissed(true)}
          />
        )}
      </AnimatePresence>

      <div className="px-6 py-5 space-y-5 flex-1">

        {/* Stat pills */}
        {statPills.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {statPills.map(([key, val]) => (
              <div
                key={key}
                className="flex items-baseline gap-1.5 px-2.5 py-1.5 rounded border border-[var(--border-row)] bg-white"
              >
                <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">
                  {formatKey(key)}
                </span>
                <span className="text-sm font-semibold text-[var(--text-primary)]">
                  {formatValue(val)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Primary chart */}
        {primaryChart && (
          <AnalysisCharts
            charts={[primaryChart] as Parameters<typeof AnalysisCharts>[0]['charts']}
            analysisType={run.analysis_type as AnalysisType}
          />
        )}

        {/* Key finding */}
        {finding.headline && (
          <div className="flex gap-3 pt-1 border-t border-[var(--border-row)]">
            <div className="w-0.5 bg-[var(--accent-primary)] rounded-full flex-shrink-0 mt-0.5 self-stretch" />
            <div className="min-w-0">
              <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider font-medium mb-1.5">
                Key Finding
              </p>
              <p className="text-sm font-semibold text-[var(--text-primary)] leading-snug">
                {finding.headline}
              </p>
              {finding.paragraph && finding.paragraph !== finding.headline && (
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed mt-1.5">
                  {finding.paragraph}
                </p>
              )}
              {finding.limitationFlag && (
                <p className="text-xs text-[var(--timeline-warning)] mt-2 leading-snug">
                  {finding.limitationFlag}
                </p>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
