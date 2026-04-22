"use client"

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Calendar, Database, Loader2,
  AlertCircle, Download, FileText, Table2,
} from 'lucide-react'
import { ResultsPanel } from '@/components/analysis/results/ResultsPanel'
import { SensitivityPanel } from '@/components/analysis/SensitivityPanel'
import { GenerateTableModal } from '@/components/analysis/GenerateTableModal'
import { createClient } from '@/lib/supabase/client'
import { formatDateTime } from '@/lib/utils'
import type { AnalysisRun, AnalysisType } from '@/types/database'
import type { AnalysisResult } from '@/lib/analysis/engine'
import { ANALYSIS_TYPES } from '@/components/analysis/AnalysisTypePicker'

export default function AnalysisRunPage() {
  const params = useParams()
  const projectId = params.id as string
  const runId = params.runId as string

  const [run, setRun] = useState<AnalysisRun | null>(null)
  const [loading, setLoading] = useState(true)
  const [tableModalOpen, setTableModalOpen] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const fetchRun = async () => {
      const { data } = await supabase
        .from('analysis_runs')
        .select('*, dataset:datasets(id, name)')
        .eq('id', runId)
        .single()
      if (data) setRun(data as AnalysisRun)
      setLoading(false)
    }
    fetchRun()
  }, [runId, supabase])

  if (loading) {
    return (
      <div className="page-shell">
        <div className="px-6 pt-6 pb-4 flex-shrink-0 space-y-3">
          <div className="skeleton h-3 w-16 rounded" />
          <div className="skeleton h-5 w-72 rounded" />
          <div className="skeleton h-3 w-48 rounded" />
        </div>
        <div className="px-6 py-4 flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-7 w-20 rounded" />
          ))}
        </div>
      </div>
    )
  }

  if (!run) {
    return (
      <div className="page-shell flex items-center justify-center">
        <div className="empty-state">
          <AlertCircle className="empty-state-icon h-8 w-8" />
          <p className="empty-state-title">Analysis run not found</p>
          <Link href={`/projects/${projectId}/analysis`}
            className="text-xs text-[var(--accent-blue)] hover:underline mt-2">
            Back to Analysis
          </Link>
        </div>
      </div>
    )
  }

  const typeInfo = ANALYSIS_TYPES.find(t => t.type === run.analysis_type)
  const result = run.results as unknown as AnalysisResult | null
  const isCompleted = run.status === 'completed'
  const dataset = run.dataset as { name: string } | null

  const displayResult: AnalysisResult = result ?? {
    type: run.analysis_type,
    summary: {},
    tables: [],
    charts: [],
    interpretation: run.interpretation ?? '',
  }

  const sampleN = result?.summary?.n ?? result?.summary?.sampleSize ?? null

  const statusDot = {
    completed: 'status-dot--verified',
    failed:    'status-dot--flagged',
    running:   'status-dot--warning',
    pending:   'status-dot--neutral',
    cancelled: 'status-dot--neutral',
  }[run.status] ?? 'status-dot--neutral'

  return (
    <div className="page-shell">

      {/* Page header */}
      <div className="px-6 pt-6 pb-4 flex-shrink-0">

        {/* Breadcrumb */}
        <Link
          href={`/projects/${projectId}/analysis`}
          className="flex items-center gap-1 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors mb-4"
        >
          <ArrowLeft className="h-3 w-3" />
          Analysis
        </Link>

        {/* Title row */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`status-dot ${statusDot}`} />
              <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider font-medium">
                {isCompleted ? 'Results Ready' : run.status}
              </span>
              <span className="data-mono-xs text-[var(--text-tertiary)]">
                {runId.slice(0, 8).toUpperCase()}
              </span>
            </div>
            <h1 className="page-title">
              {run.title ?? typeInfo?.label ?? run.analysis_type.replace(/_/g, ' ')}
            </h1>
            <p className="text-xs text-[var(--text-tertiary)] mt-1 flex items-center gap-2 flex-wrap">
              <span>{typeInfo?.label ?? run.analysis_type.replace(/_/g, ' ')}</span>
              {dataset && (
                <>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Database className="h-3 w-3" />
                    {dataset.name}
                  </span>
                </>
              )}
              {sampleN && <><span>·</span><span>N = {Number(sampleN).toLocaleString()}</span></>}
              <span>·</span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDateTime(run.created_at)}
              </span>
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              title="Export PDF"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-[var(--border-strong)] text-[var(--text-secondary)] hover:bg-[var(--bg-row-hover)] transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Export PDF
            </button>

            {isCompleted && (
              <button
                onClick={() => setTableModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-[var(--border-strong)] text-[var(--accent-blue)] hover:bg-[var(--bg-row-hover)] transition-colors"
              >
                <Table2 className="h-3.5 w-3.5" />
                Generate Table
              </button>
            )}

            <button
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-white btn-primary"
            >
              <FileText className="h-3.5 w-3.5" />
              Draft Manuscript
            </button>
          </div>
        </div>
      </div>

      {/* Generate Table modal */}
      {tableModalOpen && result && (
        <GenerateTableModal
          result={displayResult}
          projectId={projectId}
          runTitle={run.title ?? typeInfo?.label}
          onClose={() => setTableModalOpen(false)}
        />
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {run.status === 'failed' ? (
          <div className="rounded border border-[var(--timeline-flagged)]/20 bg-red-50 px-4 py-4 flex items-start gap-3">
            <AlertCircle className="h-4 w-4 text-[var(--timeline-flagged)] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">Analysis Failed</p>
              <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
                {run.error_message ?? 'An unknown error occurred during analysis.'}
              </p>
              <Link href={`/projects/${projectId}/analysis`}
                className="text-xs text-[var(--accent-blue)] hover:underline mt-2 inline-block">
                Try Again
              </Link>
            </div>
          </div>
        ) : run.status === 'running' || run.status === 'pending' ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Loader2 className="h-6 w-6 text-[var(--accent-blue)] animate-spin mb-3" />
            <p className="text-sm text-[var(--text-primary)]">Analysis in progress</p>
            <p className="text-xs text-[var(--text-tertiary)] mt-1">Results will appear here when complete.</p>
          </div>
        ) : (
          <>
            <ResultsPanel
              result={displayResult}
              analysisType={run.analysis_type as AnalysisType}
              title={run.title ?? typeInfo?.label}
              datasetName={dataset?.name}
              onSave={async () => {}}
              isSaved={true}
              runId={run.id}
              projectId={projectId}
              datasetId={run.dataset_id ?? null}
              versionId={run.version_id ?? null}
              savedChartConfig={run.chart_config ?? null}
            />

            {run.dataset_id && run.version_id &&
             ['linear_regression', 'multiple_linear_regression', 'logistic_regression', 'kaplan_meier'].includes(run.analysis_type) &&
             !!(
               (run.config as Record<string, unknown>)?.outcome_variable ||
               (run.config as Record<string, unknown>)?.eventVariable
             ) && (
              <div className="mt-6 pt-6 border-t border-[var(--border-row)]">
                <SensitivityPanel
                  projectId={projectId}
                  datasetId={run.dataset_id}
                  versionId={run.version_id}
                  analysisType={run.analysis_type}
                  outcome={String(
                    (run.config as Record<string, unknown>).outcome_variable ??
                    (run.config as Record<string, unknown>).eventVariable ?? ''
                  )}
                  exposure={String(
                    ((run.config as Record<string, unknown>).predictors as string[])?.[0] ??
                    (run.config as Record<string, unknown>).exposure_variable ??
                    (run.config as Record<string, unknown>).groupVariable ?? ''
                  )}
                  covariates={((run.config as Record<string, unknown>).predictors as string[] | undefined)?.slice(1) ?? []}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
