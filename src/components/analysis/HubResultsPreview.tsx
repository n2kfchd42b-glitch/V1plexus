"use client"

import Link from 'next/link'
import { ArrowRight, Database } from 'lucide-react'
import { AnalysisCharts } from './results/AnalysisCharts'
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
  const typeInfo  = ANALYSIS_TYPES.find(t => t.type === run.analysis_type)
  const dataset   = run.dataset as { name: string } | null | undefined

  // Up to 4 key summary values as compact pills
  const statPills = Object.entries(result.summary ?? {})
    .filter(([k]) => k !== 'error')
    .slice(0, 4)

  // First non-diagnostic chart only
  const primaryChart = (result.charts as ChartSpec[]).find(
    c => !DIAGNOSTIC_CHART_TYPES.has(c.type)
  )

  // Plain-language headline for key finding
  const datasetName = dataset?.name ?? 'the dataset'
  const finding = generatePlainLanguageSummary(result, run.analysis_type, datasetName)

  return (
    <div
      className="bg-white rounded-2xl overflow-hidden"
      style={{ boxShadow: '0 4px 24px rgba(0,24,72,0.06)' }}
    >
      {/* ── Header ───────────────────────────────────── */}
      <div className="px-6 pt-5 pb-4 border-b border-[#f2f4f6] flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#0040a2] font-manrope mb-0.5">
            {typeInfo?.label ?? run.analysis_type.replace(/_/g, ' ')}
          </p>
          <h2 className="font-manrope font-semibold text-[15px] text-[#18181B] truncate">
            {run.title ?? typeInfo?.label}
          </h2>
          <p className="text-[11px] text-[#A1A1AA] mt-0.5 flex items-center gap-1.5">
            {dataset && (
              <>
                <Database className="h-3 w-3" />
                {dataset.name}
                <span className="text-[#e0e3e5]">·</span>
              </>
            )}
            {formatRelative(run.created_at)}
          </p>
        </div>
        <Link
          href={`/projects/${projectId}/analysis/${run.id}`}
          className="flex-shrink-0 flex items-center gap-1 text-[11px] font-semibold text-[#0052cc] hover:text-[#003d9b] transition-colors whitespace-nowrap mt-0.5"
        >
          Full Results
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="px-6 py-5 space-y-5">

        {/* ── Stat pills ───────────────────────────────── */}
        {statPills.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {statPills.map(([key, val]) => (
              <div
                key={key}
                className="flex items-baseline gap-1.5 px-3 py-1.5 bg-[#f7f9fb] rounded-lg border border-[#eef0f4]"
              >
                <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#A1A1AA] font-manrope">
                  {formatKey(key)}
                </span>
                <span className="text-sm font-bold text-[#18181B] font-manrope leading-none">
                  {formatValue(val)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* ── Primary chart ────────────────────────────── */}
        {primaryChart && (
          <div className="rounded-xl overflow-hidden" style={{ maxHeight: '240px', overflow: 'hidden' }}>
            <AnalysisCharts
              charts={[primaryChart] as Parameters<typeof AnalysisCharts>[0]['charts']}
              analysisType={run.analysis_type as AnalysisType}
            />
          </div>
        )}

        {/* ── Key finding ──────────────────────────────── */}
        {finding.headline && (
          <div className="flex gap-3 pt-1 border-t border-[#f2f4f6]">
            <div
              className="w-0.5 rounded-full flex-shrink-0 mt-1 self-stretch"
              style={{ background: 'linear-gradient(to bottom, #0052cc, #66a3ff)' }}
            />
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#A1A1AA] font-manrope mb-1.5">
                Key Finding
              </p>
              <p className="text-[13px] font-semibold text-[#18181B] leading-snug">
                {finding.headline}
              </p>
              {finding.paragraph && finding.paragraph !== finding.headline && (
                <p className="text-[12px] text-[#52525B] leading-relaxed mt-1.5">
                  {finding.paragraph}
                </p>
              )}
              {finding.limitationFlag && (
                <p className="text-[11px] text-amber-600 mt-2 leading-snug">
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
