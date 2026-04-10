"use client"

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Plus, BarChart2, CheckCircle2, AlertCircle,
  Search, X, ChevronRight, Database,
  ArrowLeft, ArrowRight, Download, FileText, Table2,
} from 'lucide-react'
import { HubTableGeneratorModal } from './HubTableGeneratorModal'
import { AssumptionCheckModal } from './AssumptionCheckModal'
import type { AssumptionCheckResult } from '@/types/analysisIntegrity'
import { AnalysisTypePicker, ANALYSIS_TYPES } from './AnalysisTypePicker'
import { KeyFindingCard } from './KeyFindingCard'
import { ProjectDatasetSelector } from './ProjectDatasetSelector'
import { AISuggestions } from './AISuggestions'
import { AnalysisCharts } from './results/AnalysisCharts'
import { HubResultsPreview } from './HubResultsPreview'
import { createClient } from '@/lib/supabase/client'
import { runAnalysis } from '@/lib/analysis/engine'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'
import { formatRelative } from '@/lib/utils'
import { logAudit } from '@/lib/audit'
import type { AnalysisRun, AnalysisType, DatasetColumn } from '@/types/database'
import type { DataRow, AnalysisResult, ChartSpec } from '@/lib/analysis/types'

// Config components
import { DescriptiveConfig } from './configs/DescriptiveConfig'
import { FrequencyConfig } from './configs/FrequencyConfig'
import { ChiSquareConfig } from './configs/ChiSquareConfig'
import { TTestConfig } from './configs/TTestConfig'
import { AnovaConfig } from './configs/AnovaConfig'
import { CorrelationConfig } from './configs/CorrelationConfig'
import { SimpleRegressionConfig } from './configs/SimpleRegressionConfig'
import { MultipleRegressionConfig } from './configs/MultipleRegressionConfig'
import { LogisticRegressionConfig } from './configs/LogisticRegressionConfig'
import { MultinomialConfig } from './configs/MultinomialConfig'
import { OrdinalConfig } from './configs/OrdinalConfig'
import { PoissonConfig } from './configs/PoissonConfig'
import { KaplanMeierConfig } from './configs/KaplanMeierConfig'
import { CoxConfig } from './configs/CoxConfig'
import { TimeSeriesConfig } from './configs/TimeSeriesConfig'
import { PCAConfig } from './configs/PCAConfig'
import { FactorAnalysisConfig } from './configs/FactorAnalysisConfig'
import { ClusterConfig } from './configs/ClusterConfig'
import { MetaAnalysisConfig } from './configs/MetaAnalysisConfig'
import { SpatialConfig } from './configs/SpatialConfig'
import { OutbreakConfig } from './configs/OutbreakConfig'
import { SampleSizeConfig } from './configs/SampleSizeConfig'

interface Props { projectId: string }

type FilterStatus = 'all' | 'completed' | 'running' | 'failed'
type DrawerStep  = 'dataset' | 'type' | 'config'

interface ProjectMeta {
  title: string
  description: string | null
  methodology: string | null
  research_objectives: string | null
}

const DIAGNOSTIC_TYPES = new Set(['residual_plot', 'acf_plot', 'funnel_plot'])

function ConfigComponent({ type, config, onChange, onRun, loading, columns }: {
  type: AnalysisType; config: Record<string, unknown>
  onChange: (c: Record<string, unknown>) => void
  onRun: () => void; loading: boolean; columns: DatasetColumn[]
}) {
  const p = { config, onChange, onRun, loading, columns }
  switch (type) {
    case 'descriptive':              return <DescriptiveConfig {...p} />
    case 'frequency':                return <FrequencyConfig {...p} />
    case 'chi_square':               return <ChiSquareConfig {...p} />
    case 't_test':                   return <TTestConfig {...p} />
    case 'anova':                    return <AnovaConfig {...p} />
    case 'correlation':              return <CorrelationConfig {...p} />
    case 'simple_regression':        return <SimpleRegressionConfig {...p} />
    case 'multiple_regression':      return <MultipleRegressionConfig {...p} />
    case 'logistic_regression':      return <LogisticRegressionConfig {...p} />
    case 'multinomial_regression':   return <MultinomialConfig {...p} />
    case 'ordinal_regression':       return <OrdinalConfig {...p} />
    case 'poisson_regression':
    case 'negbinomial_regression':   return <PoissonConfig {...p} analysisType={type} />
    case 'kaplan_meier':             return <KaplanMeierConfig {...p} />
    case 'cox_regression':           return <CoxConfig {...p} />
    case 'time_series':              return <TimeSeriesConfig {...p} />
    case 'pca':                      return <PCAConfig {...p} />
    case 'factor_analysis':          return <FactorAnalysisConfig {...p} />
    case 'cluster_analysis':         return <ClusterConfig {...p} />
    case 'meta_analysis':            return <MetaAnalysisConfig {...p} />
    case 'spatial_analysis':         return <SpatialConfig {...p} />
    case 'outbreak_investigation':   return <OutbreakConfig {...p} />
    case 'sample_size':              return <SampleSizeConfig {...p} />
    default: return <p className="text-sm text-[#A1A1AA]">No configuration available.</p>
  }
}

function exportToWord(run: AnalysisRun) {
  const result = run.results as unknown as AnalysisResult | null
  if (!result) return
  const title = run.title ?? run.analysis_type
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const tableHtml = (result.tables ?? []).map(t => `
    <h3 style="font-family:Calibri;font-size:12pt">${esc(t.title)}</h3>
    <table style="border-collapse:collapse;width:100%;font-family:Calibri;font-size:10pt">
      <thead><tr>${t.headers.map(h => `<th style="border:1px solid #999;padding:4px 8px;background:#f0f0f0">${esc(h)}</th>`).join('')}</tr></thead>
      <tbody>${t.rows.map(row => `<tr>${row.map(cell => `<td style="border:1px solid #ccc;padding:4px 8px">${esc(cell === null ? '—' : String(cell))}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>
  `).join('\n')
  const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'>
<head><meta charset="utf-8"><title>${esc(title)}</title>
<style>body{font-family:Calibri;font-size:11pt;margin:2cm}h1{font-size:16pt}table{border-collapse:collapse;width:100%}</style>
</head><body><h1>${esc(title)}</h1>${result.plainLanguage ? `<p>${esc(result.plainLanguage)}</p>` : ''}<h2>Results</h2>${tableHtml}${result.interpretation ? `<p>${esc(result.interpretation)}</p>` : ''}</body></html>`
  const blob = new Blob([html], { type: 'application/vnd.ms-word;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url
  a.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_results.doc`
  document.body.appendChild(a); a.click()
  document.body.removeChild(a); URL.revokeObjectURL(url)
}

// ── Main Component ──────────────────────────────────────
export function AnalysisHub({ projectId }: Props) {
  const router = useRouter()
  const { profile } = useAuth()
  const supabase = useMemo(() => createClient(), [])

  const [runs, setRuns]           = useState<AnalysisRun[]>([])
  const [loading, setLoading]     = useState(true)
  const [project, setProject]     = useState<ProjectMeta | null>(null)
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [searchQuery, setSearchQuery]   = useState('')

  // Drawer
  const [drawerOpen, setDrawerOpen]   = useState(false)
  const [drawerStep, setDrawerStep]   = useState<DrawerStep>('dataset')

  // Analysis wizard
  const [data, setData]               = useState<DataRow[]>([])
  const [columns, setColumns]         = useState<DatasetColumn[]>([])
  const [fileName, setFileName]       = useState('')
  const [datasetId, setDatasetId]     = useState<string | undefined>()
  const [versionId, setVersionId]     = useState<string | undefined>()
  const [selectedType, setSelectedType] = useState<AnalysisType | null>(null)
  const [config, setConfig]           = useState<Record<string, unknown>>({})
  const [running, setRunning]         = useState(false)
  const [result, setResult]           = useState<AnalysisResult | null>(null)
  const [savedRunId, setSavedRunId]   = useState<string | null>(null)
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)

  // Hub table generator
  const [hubTableModalOpen, setHubTableModalOpen] = useState(false)

  // Assumption checks
  const [assumptionCheckResult, setAssumptionCheckResult] = useState<AssumptionCheckResult | null>(null)
  const [showAssumptionModal, setShowAssumptionModal] = useState(false)

  // Approval gate
  const [approvalBlock, setApprovalBlock] = useState<{
    status: string
    reason: string
    requestId?: string
  } | null>(null)

  useEffect(() => {
    supabase.from('analysis_runs')
      .select('*, dataset:datasets(id, name)')
      .eq('project_id', projectId).is('deleted_at', null)
      .order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => {
        if (data) {
          const loaded = data as AnalysisRun[]
          setRuns(loaded)
          // Auto-select the most recent completed run
          const first = loaded.find(r => r.status === 'completed')
          if (first) setSelectedRunId(first.id)
        }
        setLoading(false)
      })
  }, [projectId, supabase])

  useEffect(() => {
    supabase.from('projects')
      .select('title, description, methodology, research_objectives')
      .eq('id', projectId).maybeSingle()
      .then(({ data }) => { if (data) setProject(data as ProjectMeta) })
  }, [projectId, supabase])

  const openDrawer = () => {
    setDrawerOpen(true)
    setDrawerStep(data.length > 0 ? 'type' : 'dataset')
    setResult(null); setSavedRunId(null); setSelectedType(null); setConfig({})
  }
  const closeDrawer = () => setDrawerOpen(false)

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('analysis_runs')
      .update({ deleted_at: new Date().toISOString() }).eq('id', id)
    if (error) { toast.error('Failed to delete analysis'); return }
    setRuns(prev => prev.filter(r => r.id !== id))
    await logAudit('analysis.run.deleted', 'analysis_run', id, {}, projectId)
    toast.success('Analysis deleted')
  }

  const handleData = async (rows: DataRow[], cols: DatasetColumn[], name: string, dsId?: string, vsId?: string) => {
    setData(rows); setColumns(cols); setFileName(name)
    setDatasetId(dsId); setVersionId(vsId); setResult(null)
    setApprovalBlock(null)

    // Check approval gate when a dataset version is selected
    if (dsId && vsId) {
      try {
        const res = await fetch(`/api/datasets/${dsId}/approval/status?version_id=${vsId}`)
        if (res.ok) {
          const json = await res.json()
          if (!json.can_analyze && json.status !== 'not_required') {
            setApprovalBlock({
              status: json.status,
              reason: json.reason ?? 'Supervisor approval required.',
              requestId: json.request?.id,
            })
          }
        }
      } catch {
        // non-blocking — don't gate if check fails
      }
    }
  }

  const handleTypeSelect = (type: AnalysisType) => {
    setSelectedType(type); setConfig({}); setResult(null); setDrawerStep('config')
  }

  const executeAnalysis = async () => {
    if (!selectedType) return
    setRunning(true); setResult(null)
    try {
      setResult(await runAnalysis(selectedType, data, config))
    } catch (err) {
      setResult({ type: selectedType, summary: { error: err instanceof Error ? err.message : 'Analysis failed' }, tables: [], charts: [], interpretation: 'Analysis failed.' })
    } finally {
      setRunning(false)
    }
  }

  const handleRun = async () => {
    if (!selectedType) return
    if (approvalBlock) return

    // Run assumption checks when a versioned dataset is loaded
    if (datasetId && versionId) {
      try {
        const res = await fetch('/api/analysis/assumption-checks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dataset_id: datasetId,
            version_id: versionId,
            project_id: projectId,
            analysis_type: selectedType,
            analysis_config: config,
          }),
        })
        if (res.ok) {
          const checkResult: AssumptionCheckResult = await res.json()
          if (!checkResult.all_passed || checkResult.requires_acknowledgement) {
            setAssumptionCheckResult(checkResult)
            setShowAssumptionModal(true)
            return
          }
        }
      } catch {
        // Non-blocking — if assumption check service is unavailable, allow analysis to proceed
      }
    }

    await executeAnalysis()
  }

  const handleSave = async () => {
    if (!result || !profile || !selectedType) return
    if (approvalBlock) return
    const typeInfo = ANALYSIS_TYPES.find(t => t.type === selectedType)
    const { data: run } = await supabase.from('analysis_runs').insert({
      project_id: projectId, dataset_id: datasetId ?? null, version_id: versionId ?? null,
      analysis_type: selectedType,
      title: `${typeInfo?.label ?? selectedType} — ${new Date().toLocaleDateString()}`,
      config, results: result as unknown as Record<string, unknown>,
      interpretation: result.interpretation, status: 'completed', created_by: profile.id,
    }).select().single()
    if (run) {
      await logAudit('analysis.run.saved', 'analysis_run', run.id, { type: selectedType, title: run.title, dataset_id: datasetId ?? null }, projectId)

      // Write analysis timeline entry (non-blocking)
      if (datasetId) {
        const s = result.summary ?? {}
        const keyResult = {
          estimate: (s.coefficient ?? s.odds_ratio ?? s.hazard_ratio ?? s.correlation ?? s.mean_difference ?? s.F_statistic ?? null) as number | null,
          ci_lower: (s.ci_lower ?? null) as number | null,
          ci_upper: (s.ci_upper ?? null) as number | null,
          p_value: (s.p_value ?? null) as number | null,
          metric_label: (s.coefficient !== undefined ? 'β' : s.odds_ratio !== undefined ? 'OR' : s.hazard_ratio !== undefined ? 'HR' : s.correlation !== undefined ? 'r' : 'est') as string,
        }
        fetch(`/api/analytics/timeline/${datasetId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_id: projectId,
            dataset_id: datasetId,
            analysis_type: selectedType,
            variables: config,
            key_result: keyResult.estimate !== null ? keyResult : null,
            label: run.title,
            analysis_run_id: run.id,
          }),
        }).catch(() => {/* non-blocking */})
      }

      setSavedRunId(run.id); closeDrawer(); router.push(`/projects/${projectId}/analysis/${run.id}`)
    }
  }

  const stats = useMemo(() => {
    const completed = runs.filter(r => r.status === 'completed').length
    const active    = runs.filter(r => r.status === 'running' || r.status === 'pending').length
    const failed    = runs.filter(r => r.status === 'failed').length
    return { total: runs.length, completed, active, failed }
  }, [runs])

  const filteredRuns = useMemo(() => {
    let res = runs
    if (filterStatus !== 'all') {
      res = res.filter(r => filterStatus === 'running'
        ? r.status === 'running' || r.status === 'pending'
        : r.status === filterStatus)
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      res = res.filter(r =>
        (r.title ?? '').toLowerCase().includes(q) ||
        r.analysis_type.toLowerCase().includes(q) ||
        (r.dataset as { name: string } | null)?.name?.toLowerCase().includes(q)
      )
    }
    return res
  }, [runs, filterStatus, searchQuery])

  // Latest completed run with chart data
  const latestCompleted = useMemo(() => runs.find(r => r.status === 'completed'), [runs])
  const latestResult    = latestCompleted?.results as unknown as AnalysisResult | null | undefined
  const latestCharts    = useMemo(() => {
    const charts = (latestResult?.charts ?? []) as ChartSpec[]
    return charts.filter(c => !DIAGNOSTIC_TYPES.has(c.type)).slice(0, 2)
  }, [latestResult])
  const latestTypeInfo  = latestCompleted ? ANALYSIS_TYPES.find(t => t.type === latestCompleted.analysis_type) : null
  const latestDataset   = latestCompleted?.dataset as { name: string } | null | undefined

  const typeInfo   = selectedType ? ANALYSIS_TYPES.find(t => t.type === selectedType) : null
  const needsData  = selectedType !== 'sample_size'
  const dataLoaded = data.length > 0
  const columnsForAI = columns.map(c => ({ name: c.name, type: c.type, unique_values: c.unique_values, missing: c.missing }))

  const DRAWER_STEPS: { id: DrawerStep; label: string }[] = [
    { id: 'dataset', label: 'Dataset' },
    { id: 'type',    label: 'Analysis Type' },
    { id: 'config',  label: 'Configure & Run' },
  ]
  const drawerStepOrder: DrawerStep[] = ['dataset', 'type', 'config']
  const drawerStepIdx = drawerStepOrder.indexOf(drawerStep)

  // ── Loading skeleton ──────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        <div className="px-6 pt-6 pb-4 flex-shrink-0 border-b border-[var(--border-row)]">
          <div className="skeleton h-5 w-24 rounded" />
        </div>
        <div className="flex flex-1 min-h-0">
          <div className="w-72 flex-shrink-0 border-r border-[var(--border-row)]">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="row-item pointer-events-none">
                <div className="skeleton h-2 w-2 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-1.5 min-w-0">
                  <div className="skeleton h-3.5 w-40 rounded" />
                  <div className="skeleton h-3 w-24 rounded" />
                </div>
              </div>
            ))}
          </div>
          <div className="flex-1" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* ── Page header ──────────────────────────────── */}
      <div className="px-6 pt-6 pb-4 flex-shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="page-title">Analysis</h1>
            <p className="text-xs text-[var(--text-tertiary)] mt-1">
              {project?.description
                ? project.description.slice(0, 90) + (project.description.length > 90 ? '…' : '')
                : 'Statistical analysis with AI-powered interpretations.'
              }
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setHubTableModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-[var(--border-strong)] text-[var(--text-secondary)] hover:bg-[var(--bg-row-hover)] transition-colors"
            >
              <Table2 className="h-3.5 w-3.5" />
              Generate Table
            </button>
            <button
              onClick={openDrawer}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-[var(--accent-blue)] text-white hover:opacity-90 transition-opacity"
            >
              <Plus className="h-3.5 w-3.5" />
              New Analysis
            </button>
          </div>
        </div>
      </div>

      {/* ── Main split-pane ─────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden border-t border-[var(--border-row)]">

        {runs.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState onNew={openDrawer} />
          </div>
        ) : (() => {
          const selectedRun    = runs.find(r => r.id === selectedRunId) ?? null
          const selectedResult = selectedRun?.results as unknown as AnalysisResult | null | undefined

          const statusDotClass: Record<string, string> = {
            completed: 'status-dot--verified',
            failed:    'status-dot--flagged',
            running:   'status-dot--warning',
            pending:   'status-dot--neutral',
            cancelled: 'status-dot--neutral',
          }
          const statusLabel: Record<string, string> = {
            completed: 'Done', failed: 'Failed', running: 'Running',
            pending: 'Pending', cancelled: 'Cancelled',
          }

          return (
            <div className="flex flex-1 min-h-0 overflow-hidden">

              {/* ── Left: Run list ─────────────── */}
              <div className="w-72 flex-shrink-0 border-r border-[var(--border-row)] flex flex-col">

                {/* Stats strip */}
                <div className="px-4 py-2.5 border-b border-[var(--border-row)] flex items-center gap-4 flex-shrink-0">
                  <span className="data-mono-xs text-[var(--text-tertiary)]">
                    <span className="text-[var(--text-primary)] font-medium">{stats.total}</span> total
                  </span>
                  <span className="data-mono-xs text-[var(--timeline-verified)]">{stats.completed} done</span>
                  {stats.failed > 0 && (
                    <span className="data-mono-xs text-[var(--timeline-flagged)]">{stats.failed} failed</span>
                  )}
                </div>

                {/* Search */}
                <div className="px-3 py-2 border-b border-[var(--border-row)] flex-shrink-0">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-[var(--text-tertiary)]" />
                    <input
                      type="text" placeholder="Search…" value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full pl-7 pr-3 py-1.5 text-xs rounded bg-[var(--bg-row-hover)] border-0 text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:ring-1 focus:ring-[var(--accent-blue)]/30"
                    />
                  </div>
                </div>

                {/* Filter tabs */}
                <div className="flex border-b border-[var(--border-row)] flex-shrink-0">
                  {(['all', 'completed', 'running', 'failed'] as FilterStatus[]).map(s => (
                    <button key={s} onClick={() => setFilterStatus(s)}
                      className={`flex-1 py-1.5 text-[10px] font-medium uppercase tracking-wide transition-colors ${
                        filterStatus === s
                          ? 'text-[var(--accent-blue)] border-b-2 border-[var(--accent-blue)] -mb-px'
                          : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                      }`}
                    >
                      {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>

                {/* Scrollable run list */}
                <div className="overflow-y-auto flex-1">
                  {filteredRuns.length === 0 ? (
                    <div className="text-center py-8 px-4">
                      <p className="text-xs text-[var(--text-tertiary)]">No analyses match your filters</p>
                      <button onClick={() => { setFilterStatus('all'); setSearchQuery('') }}
                        className="text-[var(--accent-blue)] text-xs mt-2 hover:underline">Clear filters</button>
                    </div>
                  ) : filteredRuns.map((run) => {
                    const info   = ANALYSIS_TYPES.find(t => t.type === run.analysis_type)
                    const ds     = run.dataset as { name: string } | null
                    const dotCls = statusDotClass[run.status] ?? 'status-dot--neutral'
                    const isSelected = selectedRunId === run.id
                    return (
                      <button
                        key={run.id}
                        onClick={() => setSelectedRunId(run.id)}
                        className={`group w-full text-left flex items-center gap-2.5 px-4 py-3 border-b border-[var(--border-row)] last:border-0 transition-colors ${
                          isSelected ? 'bg-[var(--bg-row-active)]' : 'hover:bg-[var(--bg-row-hover)]'
                        }`}
                      >
                        <span className={`status-dot ${dotCls} flex-shrink-0`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-[var(--text-primary)] truncate leading-snug">
                            {run.title ?? info?.label ?? run.analysis_type}
                          </p>
                          <p className="data-mono-xs text-[var(--text-tertiary)] mt-0.5 truncate">
                            {ds?.name ?? info?.label ?? run.analysis_type.replace(/_/g, ' ')}
                            {' · '}{formatRelative(run.created_at)}
                          </p>
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); handleDelete(run.id) }}
                          className="row-action text-[var(--text-tertiary)] hover:text-[var(--timeline-flagged)] flex-shrink-0 p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* ── Right: Results preview ───────── */}
              <div className="flex-1 overflow-y-auto min-w-0">
                {selectedRun?.status === 'completed' && selectedResult ? (
                  <HubResultsPreview
                    run={selectedRun}
                    result={selectedResult}
                    projectId={projectId}
                  />
                ) : selectedRun?.status === 'running' || selectedRun?.status === 'pending' ? (
                  <div className="flex flex-col items-center justify-center h-full text-center px-8">
                    <div className="w-5 h-5 rounded-full border-2 border-[var(--accent-blue)] border-t-transparent animate-spin mb-3" />
                    <p className="text-sm text-[var(--text-primary)]">Analysis in progress</p>
                    <p className="text-xs text-[var(--text-tertiary)] mt-1">Results will appear here when complete.</p>
                  </div>
                ) : selectedRun?.status === 'failed' ? (
                  <div className="flex flex-col items-center justify-center h-full text-center px-8">
                    <span className="status-dot status-dot--flagged mb-3" />
                    <p className="text-sm text-[var(--text-primary)]">Analysis failed</p>
                    <p className="text-xs text-[var(--text-tertiary)] mt-1">{selectedRun.error_message ?? 'An unknown error occurred.'}</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center px-8">
                    <BarChart2 className="h-6 w-6 text-[var(--text-tertiary)] mb-3" />
                    <p className="text-sm text-[var(--text-primary)]">Select a run</p>
                    <p className="text-xs text-[var(--text-tertiary)] mt-1 max-w-[200px]">
                      Click any analysis from the list to preview results here.
                    </p>
                  </div>
                )}
              </div>

            </div>
          )
        })()}
      </div>

      {/* ── New Analysis Drawer ─────────────────────── */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 bg-black/20" onClick={closeDrawer} />
      )}
      <div
        className={`fixed inset-y-0 right-0 z-50 flex flex-col w-full max-w-[560px] bg-white border-l border-[var(--panel-border)] overflow-y-auto transition-transform duration-200 ease-[cubic-bezier(0,0,0.2,1)] ${drawerOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Drawer header */}
        <div className="flex-shrink-0 px-6 pt-5 pb-4 border-b border-[var(--panel-border)]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">New Analysis</h2>
            <button onClick={closeDrawer} className="h-7 w-7 flex items-center justify-center rounded-md text-[var(--text-tertiary)] hover:bg-[var(--bg-row-hover)] hover:text-[var(--text-primary)] transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-1">
            {DRAWER_STEPS.map((step, i) => {
              const isPast = i < drawerStepIdx; const isCurrent = drawerStep === step.id
              return (
                <button key={step.id} onClick={() => { if (isPast) setDrawerStep(step.id) }} disabled={!isPast && !isCurrent}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                    isCurrent ? 'bg-[var(--bg-row-active)] text-[var(--text-primary)]'
                    : isPast ? 'text-[var(--timeline-verified)] hover:text-[var(--text-primary)] cursor-pointer'
                    : 'text-[var(--text-tertiary)] cursor-default'
                  }`}
                >
                  <span className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-[8px] font-bold flex-shrink-0 ${
                    isCurrent ? 'bg-[var(--accent-blue)] text-white'
                    : isPast ? 'bg-[var(--timeline-verified)] text-white'
                    : 'bg-[var(--border-strong)] text-[var(--text-tertiary)]'
                  }`}>{isPast ? '✓' : i + 1}</span>
                  {step.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Drawer body */}
        <div className="flex-1 px-6 py-5 space-y-5">

          {drawerStep === 'dataset' && (
            <>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">Select a dataset or upload a new file. Your data is processed locally.</p>
              <ProjectDatasetSelector projectId={projectId} onData={handleData} datasetId={datasetId} versionId={versionId} data={data} fileName={fileName} />
              <div className="flex items-center gap-3 pt-1">
                <button disabled={!dataLoaded} onClick={() => setDrawerStep('type')}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-medium text-white bg-[var(--accent-blue)] hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed">
                  Continue <ChevronRight className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => setDrawerStep('type')} className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors">
                  Skip (sample size only)
                </button>
              </div>
            </>
          )}

          {drawerStep === 'type' && (
            <>
              {dataLoaded ? (
                <div className="flex items-center justify-between px-3 py-2 rounded bg-[var(--bg-row-hover)] border border-[var(--border-row)]">
                  <div className="flex items-center gap-2">
                    <Database className="h-3.5 w-3.5 text-[var(--accent-blue)]" />
                    <span className="text-xs font-medium text-[var(--text-primary)]">{fileName}</span>
                    <span className="data-mono-xs text-[var(--text-tertiary)]">{data.length.toLocaleString()} rows · {columns.length} cols</span>
                  </div>
                  <button onClick={() => setDrawerStep('dataset')} className="text-xs text-[var(--accent-blue)] hover:underline">Change</button>
                </div>
              ) : (
                <div className="flex items-center justify-between px-3 py-2 rounded bg-amber-50 border border-amber-200">
                  <span className="text-xs text-amber-700">No dataset — only sample size calculator available</span>
                  <button onClick={() => setDrawerStep('dataset')} className="text-xs text-amber-700 font-medium underline ml-2">Add data</button>
                </div>
              )}
              {project && (
                <AISuggestions projectId={projectId} projectTitle={project.title} projectDescription={project.description}
                  methodology={project.methodology} researchObjectives={project.research_objectives}
                  columns={dataLoaded ? columnsForAI : undefined} onSelect={handleTypeSelect} selectedType={selectedType} />
              )}
              <AnalysisTypePicker selected={selectedType} onSelect={handleTypeSelect} />
            </>
          )}

          {drawerStep === 'config' && selectedType && (
            <>
              <div className="flex items-center gap-2">
                <button onClick={() => setDrawerStep('type')} className="text-xs text-[var(--text-tertiary)] hover:text-[var(--accent-blue)] transition-colors">← Change type</button>
                <span className="text-[var(--border-strong)]">·</span>
                <span className="text-xs text-[var(--text-secondary)]">{typeInfo?.label}</span>
              </div>

              {needsData && !dataLoaded ? (
                <div>
                  <p className="subsection-label mb-2">Dataset Required</p>
                  <ProjectDatasetSelector projectId={projectId} onData={handleData} datasetId={datasetId} versionId={versionId} data={data} fileName={fileName} />
                </div>
              ) : needsData && dataLoaded ? (
                <div className="flex items-center justify-between px-3 py-2 rounded bg-[var(--bg-row-hover)] border border-[var(--border-row)]">
                  <div className="flex items-center gap-2">
                    <Database className="h-3.5 w-3.5 text-[var(--accent-blue)]" />
                    <span className="text-xs font-medium text-[var(--text-primary)]">{fileName}</span>
                    <span className="data-mono-xs text-[var(--text-tertiary)]">{columns.length} columns</span>
                  </div>
                  <button onClick={() => setDrawerStep('dataset')} className="text-xs text-[var(--accent-blue)] hover:underline">Change</button>
                </div>
              ) : null}

              {/* Approval gate blocked state */}
              {approvalBlock && (
                <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 space-y-1.5">
                  <p className="text-xs font-medium text-amber-800">
                    {approvalBlock.status === 'pending' ? 'Awaiting Supervisor Approval'
                      : approvalBlock.status === 'in_review' ? 'Under Supervisor Review'
                      : approvalBlock.status === 'not_requested' ? 'Approval Required'
                      : approvalBlock.status === 'rejected' ? 'Approval Declined'
                      : 'Revisions Requested'}
                  </p>
                  <p className="text-xs text-amber-700 leading-relaxed">{approvalBlock.reason}</p>
                  <a href={`/projects/${projectId}/data`} className="text-xs text-amber-800 font-medium underline">
                    {approvalBlock.status === 'not_requested' ? 'Submit for Approval →' : 'View Approval Status →'}
                  </a>
                </div>
              )}

              <div className="surface-inset rounded">
                <p className="subsection-label mb-3">Configuration</p>
                <ConfigComponent type={selectedType} config={config} onChange={setConfig}
                  onRun={approvalBlock ? () => {} : handleRun}
                  loading={running} columns={needsData ? (dataLoaded ? columns : []) : []} />
              </div>

              {result && !result.summary?.error && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <p className="subsection-label">Results Preview</p>
                    <span className="text-xs text-[var(--text-tertiary)]">· Save to view full analysis</span>
                  </div>
                  {result.summary && Object.keys(result.summary).filter(k => k !== 'error').length > 0 && (
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      {Object.entries(result.summary).filter(([k]) => k !== 'error').slice(0, 4).map(([key, val]) => (
                        <div key={key} className="px-3 py-2.5 rounded border border-[var(--border-row)] bg-white">
                          <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider truncate">{formatKey(key)}</p>
                          <p className="text-sm font-medium text-[var(--text-primary)] truncate mt-0.5">{String(val)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  <button onClick={handleSave} disabled={!!savedRunId}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium text-white bg-[var(--accent-blue)] hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed">
                    <CheckCircle2 className="h-4 w-4" />
                    Save &amp; View Full Results
                  </button>
                </div>
              )}

              {result?.summary?.error && (
                <div className="rounded border border-[var(--timeline-flagged)]/20 bg-red-50 px-4 py-3">
                  <p className="text-xs font-medium text-[var(--timeline-flagged)]">Analysis Error</p>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">{String(result.summary.error)}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {hubTableModalOpen && (
        <HubTableGeneratorModal
          projectId={projectId}
          onClose={() => setHubTableModalOpen(false)}
        />
      )}

      {showAssumptionModal && assumptionCheckResult && selectedType && (
        <AssumptionCheckModal
          isOpen={showAssumptionModal}
          onClose={() => setShowAssumptionModal(false)}
          checkResult={assumptionCheckResult}
          analysisType={selectedType}
          onProceed={async (notes) => {
            setShowAssumptionModal(false)
            // Acknowledge via API if required
            if (assumptionCheckResult.requires_acknowledgement) {
              try {
                await fetch(`/api/analysis/assumption-checks/${assumptionCheckResult.check_id}/acknowledge`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ acknowledgement_notes: notes }),
                })
              } catch {
                // Non-blocking
              }
            }
            await executeAnalysis()
          }}
          onCancel={() => setShowAssumptionModal(false)}
        />
      )}
    </div>
  )
}

// ── Empty State ─────────────────────────────────────────
function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="empty-state">
      <BarChart2 className="empty-state-icon h-8 w-8" />
      <p className="empty-state-title">No analyses yet</p>
      <p className="empty-state-description">
        Run your first statistical analysis to get results, charts, and AI-powered interpretations.
      </p>
      <button onClick={onNew}
        className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-white bg-[var(--accent-blue)] hover:opacity-90 transition-opacity">
        <Plus className="h-3.5 w-3.5" />
        New Analysis
      </button>
    </div>
  )
}

// ── Per-analysis-type key findings ─────────────────────
type Finding = { label: string; value: string }

function getKeyFindings(result: AnalysisResult, analysisType: string): Finding[] {
  const s = result.summary as Record<string, unknown>
  const tables = result.tables ?? []

  const get = (key: string): string | null =>
    s[key] !== undefined && s[key] !== null && s[key] !== '' ? String(s[key]) : null

  // Look up a value in a table row by header keyword
  const fromTable = (tableId: string, headerKw: string, rowIdx = 0): string | null => {
    const t = tables.find(t => t.id === tableId || t.title?.toLowerCase().includes(tableId))
    if (!t || !t.rows[rowIdx]) return null
    const colIdx = t.headers.findIndex(h => h.toLowerCase().includes(headerKw.toLowerCase()))
    if (colIdx < 0) return null
    const v = t.rows[rowIdx][colIdx]
    return v !== null && v !== undefined ? String(v) : null
  }

  const findings: Finding[] = []
  const add = (label: string, value: string | null) => {
    if (value !== null && findings.length < 4) findings.push({ label, value })
  }

  switch (analysisType) {
    case 'descriptive': {
      // Pull directly from numeric_summary table: [Variable, N, Missing, Mean, SD, Median, ...]
      const t = tables.find(t => t.id === 'numeric_summary')
      if (t && t.rows.length > 0) {
        const r = t.rows[0]
        add('Variable', r[0] !== null ? String(r[0]) : null)
        add('N',        r[1] !== null ? String(r[1]) : null)
        add('Mean',     r[3] !== null ? String(r[3]) : null)
        add('Std Dev',  r[4] !== null ? String(r[4]) : null)
      } else {
        // Categorical only — pull from categorical_summary: [Variable, N, Missing, Unique, Mode, Mode%]
        const ct = tables.find(t => t.id === 'categorical_summary')
        if (ct && ct.rows.length > 0) {
          const r = ct.rows[0]
          add('Variable', r[0] !== null ? String(r[0]) : null)
          add('N',        r[1] !== null ? String(r[1]) : null)
          add('Unique',   r[3] !== null ? String(r[3]) : null)
          add('Mode',     r[4] !== null ? String(r[4]) : null)
        } else {
          add('N', get('n')); add('Numeric Vars', get('numericVars')); add('Cat Vars', get('catVars'))
        }
      }
      break
    }

    case 'frequency': {
      add('N', get('n'))
      add('Variable', get('variable'))
      add('Categories', get('categories'))
      // Most frequent value from first table
      const ft = tables[0]
      if (ft && ft.rows.length > 0) {
        const topRow = ft.rows.reduce((best, row) => Number(row[1]) > Number(best[1] ?? 0) ? row : best, ft.rows[0])
        if (topRow[0] !== null) add('Mode', String(topRow[0]))
      }
      break
    }

    case 'chi_square':
      add('N', get('n')); add('χ²', get('chiSq') ?? get('chi2'))
      add('p-value', get('pValue')); add("Cramér's V", get('cramersV') ?? get('v'))
      break

    case 't_test': {
      // t_test summary only has testType + variable; pull from table
      const tt = tables[0]
      if (tt) {
        const hi = (kw: string) => tt.headers.findIndex(h => h.toLowerCase().includes(kw))
        const nIdx = hi('n'); const meanIdx = hi('mean'); const tIdx = hi('t'); const pIdx = hi('p')
        const dIdx = hi('cohen')
        const r = tt.rows[0]
        if (r) {
          if (nIdx >= 0)    add('N',         String(r[nIdx]))
          if (meanIdx >= 0) add('Mean',      String(r[meanIdx]))
          if (tIdx >= 0)    add('t',         String(r[tIdx]))
          if (pIdx >= 0)    add('p-value',   String(r[pIdx]))
          if (dIdx >= 0 && findings.length < 4) add("Cohen's d", String(r[dIdx]))
        }
      }
      if (findings.length === 0) { add('Test', get('testType')); add('Variable', get('variable')) }
      break
    }

    case 'anova':
      add('N', get('n')); add('F', get('fStat'))
      add('p-value', get('pValue')); add('η²', get('etaSq') ?? get('etaSquared'))
      break

    case 'correlation': {
      add('Variables', get('variables')); add('Method', get('method'))
      // First correlation value from table
      const ct = tables[0]
      if (ct && ct.rows.length > 0 && ct.rows[0].length >= 2) {
        const rVal = ct.rows[0][1]
        if (rVal !== null) add('r', String(rVal))
        const pRow = ct.rows.find(row => String(row[0]).toLowerCase().includes('p-val'))
        if (pRow && pRow[1] !== null) add('p-value', String(pRow[1]))
      }
      break
    }

    case 'simple_regression':
      add('N', get('n')); add('R²', get('r2') ?? get('rSquared'))
      add('p-value', get('pValue'))
      // Get β (slope) from coefficients table, row 1 (predictor)
      add('β', fromTable('coefficients', 'estimate', 1) ?? fromTable('coeff', 'b', 1))
      break

    case 'multiple_regression':
      add('N', get('n')); add('R²', get('r2') ?? get('rSquared'))
      add('Adj R²', get('adjR2') ?? get('adjustedR2')); add('p-value', get('pValue'))
      break

    case 'logistic_regression':
      add('N', get('n')); add('Events', get('events'))
      add('AUC', get('auc')); add('Nagelkerke R²', get('nagelkerkeR2'))
      break

    case 'multinomial_regression':
    case 'ordinal_regression':
      add('N', get('n')); add('AIC', get('aic'))
      add('p-value', get('pValue')); add('Pseudo R²', get('pseudoR2') ?? get('mcfadden'))
      break

    case 'poisson_regression':
    case 'negbinomial_regression':
      add('N', get('n')); add('AIC', get('aic'))
      add('Deviance', get('deviance')); add('p-value', get('pValue'))
      break

    case 'kaplan_meier':
      add('N Total', get('n')); add('Events', get('events'))
      add('Groups', get('groups')); add('Log-rank p', get('logRankP'))
      break

    case 'cox_regression':
      add('N', get('n')); add('Events', get('events'))
      add('C-statistic', get('concordance')); add('LR p-value', get('lrP'))
      break

    case 'time_series':
      add('N', get('n')); add('Time Points', get('timePoints'))
      add('Classifications', get('classifications'))
      // Try AIC from table
      const tst = tables.find(t => t.title?.toLowerCase().includes('fit') || t.title?.toLowerCase().includes('model'))
      if (tst) {
        const aicRow = tst.rows.find(r => String(r[0]).toLowerCase().includes('aic'))
        if (aicRow && aicRow[1] !== null) add('AIC', String(aicRow[1]))
      }
      break

    case 'pca':
      add('N', get('n')); add('Components', get('nComp') ?? get('p'))
      add('PC1 Var %', get('varExplained1')); add('PC2 Var %', get('varExplained2'))
      break

    case 'factor_analysis':
      add('N', get('n')); add('Factors', get('nFactors') ?? get('factors'))
      add('KMO', get('kmo')); add('Total Var %', get('variance') ?? get('totalVariance'))
      break

    case 'cluster_analysis':
      add('N', get('n')); add('Clusters', get('nClusters') ?? get('k'))
      add('Silhouette', get('avgSilhouette') ?? get('silhouette')); add('WCSS', get('wcss'))
      break

    case 'meta_analysis':
      add('Studies', get('k')); add('Effect Size', get('summaryES'))
      add('I²', get('I2') ?? get('i2')); add('p-value', get('pValue'))
      break

    case 'spatial_analysis':
    case 'outbreak_investigation':
      add('N', get('n')); add('Mean', get('mean'))
      add('SD', get('sd')); add('p-value', get('pValue'))
      break

    case 'sample_size':
      add('Design', get('design')); add('N per Group', get('nPerGroup'))
      add('Total N', get('totalN') ?? get('finalN')); add('Power', get('power'))
      break

    default: {
      const keys = Object.keys(s).filter(k => k !== 'error').slice(0, 4)
      for (const k of keys) add(formatKey(k), get(k))
    }
  }

  return findings
}

function formatKey(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim().replace(/^./, c => c.toUpperCase())
}
