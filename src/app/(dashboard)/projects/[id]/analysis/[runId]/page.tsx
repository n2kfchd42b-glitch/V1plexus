"use client"

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft, Calendar, Database, CheckCircle2, Loader2,
  AlertCircle, Clock, Download, FileText, Table2,
} from 'lucide-react'
import { ResultsPanel } from '@/components/analysis/results/ResultsPanel'
import { SensitivityPanel } from '@/components/analysis/SensitivityPanel'
import { GenerateTableModal } from '@/components/analysis/GenerateTableModal'
import { createClient } from '@/lib/supabase/client'
import { formatDateTime } from '@/lib/utils'
import type { AnalysisRun, AnalysisType } from '@/types/database'
import type { AnalysisResult } from '@/lib/analysis/engine'
import { ANALYSIS_TYPES } from '@/components/analysis/AnalysisTypePicker'

export type ResultsTab = 'charts' | 'tables' | 'diagnostics'

const statusConfig = {
  completed: { icon: CheckCircle2, label: 'Completed',  iconClass: 'text-[#22C55E]', badgeClass: 'bg-[#F0FDF4] text-[#166634]' },
  failed:    { icon: AlertCircle,  label: 'Failed',     iconClass: 'text-[#EF4444]', badgeClass: 'bg-[#FEF2F2] text-[#991B1B]' },
  running:   { icon: Loader2,      label: 'Running',    iconClass: 'text-[#3B82F6]', badgeClass: 'bg-[#EFF6FF] text-[#1E40AF]' },
  pending:   { icon: Clock,        label: 'Pending',    iconClass: 'text-[#A1A1AA]', badgeClass: 'bg-[#F0F0F0] text-[#52525B]' },
  cancelled: { icon: AlertCircle,  label: 'Cancelled',  iconClass: 'text-[#A1A1AA]', badgeClass: 'bg-[#F0F0F0] text-[#52525B]' },
}

export default function AnalysisRunPage() {
  const params = useParams()
  const projectId = params.id as string
  const runId = params.runId as string

  const [run, setRun] = useState<AnalysisRun | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<ResultsTab>('charts')
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
      <div className="min-h-screen bg-[#f7f9fb]">
        <div className="max-w-7xl mx-auto px-8 py-10 space-y-6">
          <div className="h-3.5 w-24 bg-[#f2f4f6] rounded-full animate-pulse" />
          <div className="h-9 w-96 bg-[#f2f4f6] rounded-xl animate-pulse" />
          <div className="h-4 w-72 bg-[#f2f4f6] rounded-full animate-pulse" />
          <div className="grid grid-cols-4 gap-4 mt-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 bg-white rounded-2xl animate-pulse" style={{ boxShadow: '0 20px 50px rgba(0,24,72,0.04)' }} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!run) {
    return (
      <div className="min-h-screen bg-[#f7f9fb] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-10 w-10 text-[#A1A1AA] mx-auto mb-4" />
          <p className="font-manrope font-bold text-[#18181B]">Analysis run not found</p>
          <Link href={`/projects/${projectId}/analysis`}>
            <Button variant="outline" className="mt-4">Back to Analysis Hub</Button>
          </Link>
        </div>
      </div>
    )
  }

  const typeInfo = ANALYSIS_TYPES.find(t => t.type === run.analysis_type)
  const result = run.results as unknown as AnalysisResult | null
  const status = statusConfig[run.status as keyof typeof statusConfig] ?? statusConfig.pending
  const isCompleted = run.status === 'completed'

  const displayResult: AnalysisResult = result ?? {
    type: run.analysis_type,
    summary: {},
    tables: [],
    charts: [],
    interpretation: run.interpretation ?? '',
  }

  // Extract sample size from summary if available
  const sampleN = result?.summary?.n ?? result?.summary?.sampleSize ?? null
  const dataset = run.dataset as { name: string } | null

  return (
    <div className="min-h-screen bg-[#f7f9fb]">
      {/* Shimmer progress bar — completed runs only */}
      {isCompleted && <div className="shimmer-bar h-[3px] w-full" />}

      {/* Page header */}
      <div className="bg-[#f7f9fb] px-8 pt-7 pb-0">
        <div className="max-w-7xl mx-auto">

          {/* Breadcrumb */}
          <Link href={`/projects/${projectId}/analysis`}>
            <button className="flex items-center gap-1.5 text-[#A1A1AA] hover:text-[#18181B] transition-colors mb-5 text-xs font-medium">
              <ArrowLeft className="h-3.5 w-3.5" />
              Analysis Hub
            </button>
          </Link>

          {/* Title row */}
          <div className="flex items-end justify-between gap-6 flex-wrap">
            <div>
              {/* Section tag + run ID */}
              <div className="flex items-center gap-2.5 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#0040a2] font-manrope">
                  Analysis Results
                </span>
                <span className="w-1 h-1 bg-[#c3c6d6] rounded-full inline-block" />
                <span className="text-[11px] text-[#A1A1AA] font-mono">
                  {runId.slice(0, 8).toUpperCase()}
                </span>
              </div>

              {/* Title */}
              <h1 className="font-manrope font-extrabold text-[2rem] leading-tight tracking-tight text-[#18181B]">
                {run.title ?? typeInfo?.label ?? run.analysis_type.replace(/_/g, ' ')}
                {' '}
                <span className="text-[#0052cc]">Results</span>
              </h1>

              {/* Metadata strip */}
              <p className="text-sm text-[#52525B] mt-1.5 flex items-center gap-2 flex-wrap">
                <span>{typeInfo?.label ?? run.analysis_type.replace(/_/g, ' ')}</span>
                {dataset && (
                  <>
                    <span className="text-[#c3c6d6]">·</span>
                    <span className="flex items-center gap-1">
                      <Database className="h-3.5 w-3.5 text-[#A1A1AA]" />
                      {dataset.name}
                    </span>
                  </>
                )}
                {sampleN && (
                  <>
                    <span className="text-[#c3c6d6]">·</span>
                    <span>N = {Number(sampleN).toLocaleString()}</span>
                  </>
                )}
                <span className="text-[#c3c6d6]">·</span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-[#A1A1AA]" />
                  {formatDateTime(run.created_at)}
                </span>
              </p>
            </div>

            {/* Right controls */}
            <div className="flex items-center gap-3 pb-1">
              {/* Status pill */}
              {isCompleted ? (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#f0fdf4] border border-[rgba(22,101,52,0.15)]">
                  <span className="w-1.5 h-1.5 bg-[#16a34a] rounded-full animate-pulse" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#166534] font-manrope">
                    Results Ready
                  </span>
                </div>
              ) : (
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-bold uppercase tracking-[0.08em] font-manrope ${status.badgeClass}`}>
                  {status.label}
                </div>
              )}

              <button
                title="Export PDF"
                className="flex items-center gap-1.5 px-4 py-2 bg-white border border-[rgba(195,198,214,0.4)] rounded-lg text-[11px] font-bold uppercase tracking-[0.06em] text-[#52525B] hover:bg-[#f2f4f6] transition-colors"
                style={{ boxShadow: '0 8px 24px rgba(0,24,72,0.05)' }}
              >
                <Download className="h-3.5 w-3.5" />
                Export PDF
              </button>

              {isCompleted && (
                <button
                  onClick={() => setTableModalOpen(true)}
                  title="Generate Table"
                  className="flex items-center gap-1.5 px-4 py-2 bg-white border border-[rgba(195,198,214,0.4)] rounded-lg text-[11px] font-bold uppercase tracking-[0.06em] text-[#0052cc] hover:bg-[rgba(0,64,162,0.04)] transition-colors"
                  style={{ boxShadow: '0 8px 24px rgba(0,24,72,0.05)' }}
                >
                  <Table2 className="h-3.5 w-3.5" />
                  Generate Table
                </button>
              )}

              <button
                title="Draft Manuscript"
                className="flex items-center gap-1.5 px-4 py-2 text-white rounded-lg text-[11px] font-bold uppercase tracking-[0.06em] transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #003d9b 0%, #0052cc 100%)' }}
              >
                <FileText className="h-3.5 w-3.5" />
                Draft Manuscript
              </button>
            </div>
          </div>

          {/* Tab switcher — completed runs only */}
          {isCompleted && (
            <div className="flex items-center gap-1 mt-6 bg-[#f2f4f6] rounded-[10px] p-1 w-fit">
              {(['charts', 'tables', 'diagnostics'] as ResultsTab[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-[0.06em] transition-all capitalize ${
                    activeTab === tab
                      ? 'bg-white text-[#003d9b] shadow-[0_2px_8px_rgba(0,24,72,0.08)]'
                      : 'text-[#52525B] hover:text-[#003d9b]'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          )}
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
      <div className="max-w-7xl mx-auto px-8 py-8">
        {run.status === 'failed' ? (
          <div className="bg-white rounded-2xl p-8" style={{ boxShadow: '0 20px 50px rgba(0,24,72,0.04)' }}>
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-[#FEF2F2] p-3">
                <AlertCircle className="h-5 w-5 text-[#EF4444]" />
              </div>
              <div>
                <p className="font-manrope font-bold text-[#18181B]">Analysis Failed</p>
                <p className="text-sm text-[#52525B] mt-1.5 leading-relaxed">
                  {run.error_message ?? 'An unknown error occurred during analysis.'}
                </p>
                <Link href={`/projects/${projectId}/analysis/new`}>
                  <Button variant="outline" size="sm" className="mt-4">Try Again</Button>
                </Link>
              </div>
            </div>
          </div>
        ) : run.status === 'running' || run.status === 'pending' ? (
          <div className="bg-white rounded-2xl p-16 text-center" style={{ boxShadow: '0 20px 50px rgba(0,24,72,0.04)' }}>
            <Loader2 className="h-8 w-8 text-[#0052cc] animate-spin mx-auto mb-4" />
            <p className="font-manrope font-bold text-[#18181B]">Analysis in progress</p>
            <p className="text-sm text-[#52525B] mt-1">Results will appear here when complete.</p>
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
              activeTab={activeTab}
              runId={run.id}
              projectId={projectId}
              datasetId={run.dataset_id ?? null}
              versionId={run.version_id ?? null}
              savedChartConfig={run.chart_config ?? null}
            />

            {/* Sensitivity panel — linear & logistic regression only */}
            {run.dataset_id && run.version_id &&
             ['linear_regression', 'multiple_linear_regression', 'logistic_regression'].includes(run.analysis_type) &&
             !!(run.config as Record<string, unknown>)?.outcome_variable && (
              <div className="mt-5">
                <SensitivityPanel
                  projectId={projectId}
                  datasetId={run.dataset_id}
                  versionId={run.version_id}
                  analysisType={run.analysis_type}
                  outcome={String((run.config as Record<string, unknown>).outcome_variable ?? '')}
                  exposure={String(
                    ((run.config as Record<string, unknown>).predictors as string[])?.[0] ??
                    (run.config as Record<string, unknown>).exposure_variable ?? ''
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
