"use client"

import { useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart2, CheckCircle2, ChevronRight, Clock, X, Database, Table2, Play,
} from 'lucide-react'
import Link from 'next/link'
import { HubTableGeneratorModal } from './HubTableGeneratorModal'
import { AssumptionCheckModal } from './AssumptionCheckModal'
import type { AssumptionCheckResult } from '@/types/analysisIntegrity'
import { ANALYSIS_TYPES } from './AnalysisTypePicker'
import { ProjectDatasetSelector } from './ProjectDatasetSelector'
import { AnalysisEntryPoint } from './AnalysisEntryPoint'
import { GuidedFlow } from './GuidedFlow'
import { DirectFlow } from './DirectFlow'
import { profileFromDatasetColumns } from '@/lib/decision-engine/variableProfiler'
import type { DatasetContext, AnalysisTypeId } from '@/lib/decision-engine/types'
import type { ExecutableWorkflowStep } from '@/lib/decision-engine/index'
import { HubResultsPreview } from './HubResultsPreview'
import { AnalysisCharts } from './results/AnalysisCharts'
import { createClient } from '@/lib/supabase/client'
import { loadVersionData } from '@/lib/data/storage'
import { runAnalysis } from '@/lib/analysis/engine'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'
import { formatRelative } from '@/lib/utils'
import { logAudit } from '@/lib/audit'
import type { AnalysisRun, AnalysisType, DatasetColumn } from '@/types/database'
import type { DataRow, AnalysisResult } from '@/lib/analysis/types'

// Config components — lazy-loaded so only the active analysis type is bundled/fetched
import dynamic from 'next/dynamic'

const DescriptiveConfig       = dynamic(() => import('./configs/DescriptiveConfig').then(m => ({ default: m.DescriptiveConfig })))
const FrequencyConfig         = dynamic(() => import('./configs/FrequencyConfig').then(m => ({ default: m.FrequencyConfig })))
const ChiSquareConfig         = dynamic(() => import('./configs/ChiSquareConfig').then(m => ({ default: m.ChiSquareConfig })))
const TTestConfig             = dynamic(() => import('./configs/TTestConfig').then(m => ({ default: m.TTestConfig })))
const AnovaConfig             = dynamic(() => import('./configs/AnovaConfig').then(m => ({ default: m.AnovaConfig })))
const CorrelationConfig       = dynamic(() => import('./configs/CorrelationConfig').then(m => ({ default: m.CorrelationConfig })))
const SimpleRegressionConfig  = dynamic(() => import('./configs/SimpleRegressionConfig').then(m => ({ default: m.SimpleRegressionConfig })))
const MultipleRegressionConfig = dynamic(() => import('./configs/MultipleRegressionConfig').then(m => ({ default: m.MultipleRegressionConfig })))
const LogisticRegressionConfig = dynamic(() => import('./configs/LogisticRegressionConfig').then(m => ({ default: m.LogisticRegressionConfig })))
const MultinomialConfig       = dynamic(() => import('./configs/MultinomialConfig').then(m => ({ default: m.MultinomialConfig })))
const OrdinalConfig           = dynamic(() => import('./configs/OrdinalConfig').then(m => ({ default: m.OrdinalConfig })))
const PoissonConfig           = dynamic(() => import('./configs/PoissonConfig').then(m => ({ default: m.PoissonConfig })))
const KaplanMeierConfig       = dynamic(() => import('./configs/KaplanMeierConfig').then(m => ({ default: m.KaplanMeierConfig })))
const CoxConfig               = dynamic(() => import('./configs/CoxConfig').then(m => ({ default: m.CoxConfig })))
const TimeSeriesConfig        = dynamic(() => import('./configs/TimeSeriesConfig').then(m => ({ default: m.TimeSeriesConfig })))
const PCAConfig               = dynamic(() => import('./configs/PCAConfig').then(m => ({ default: m.PCAConfig })))
const FactorAnalysisConfig    = dynamic(() => import('./configs/FactorAnalysisConfig').then(m => ({ default: m.FactorAnalysisConfig })))
const ClusterConfig           = dynamic(() => import('./configs/ClusterConfig').then(m => ({ default: m.ClusterConfig })))
const MetaAnalysisConfig      = dynamic(() => import('./configs/MetaAnalysisConfig').then(m => ({ default: m.MetaAnalysisConfig })))
const SpatialConfig           = dynamic(() => import('./configs/SpatialConfig').then(m => ({ default: m.SpatialConfig })))
const OutbreakConfig          = dynamic(() => import('./configs/OutbreakConfig').then(m => ({ default: m.OutbreakConfig })))
const SampleSizeConfig        = dynamic(() => import('./configs/SampleSizeConfig').then(m => ({ default: m.SampleSizeConfig })))

interface Props { projectId: string }

interface ProjectDataset {
  id: string
  name: string
  latestVersion: {
    id: string
    version_number: number
    row_count: number | null
    column_count: number | null
    file_path: string
  } | null
}

interface ProjectMeta {
  title: string
  description: string | null
  methodology: string | null
  research_objectives: string | null
}

// Grouped for the flat select
const TYPE_GROUPS: { label: string; types: AnalysisType[] }[] = [
  { label: 'Basic', types: ['descriptive', 'frequency', 'chi_square', 't_test', 'anova', 'correlation'] },
  { label: 'Regression', types: ['simple_regression', 'multiple_regression', 'logistic_regression', 'multinomial_regression', 'ordinal_regression', 'poisson_regression', 'negbinomial_regression'] },
  { label: 'Survival', types: ['kaplan_meier', 'cox_regression', 'time_series'] },
  { label: 'Advanced', types: ['pca', 'factor_analysis', 'cluster_analysis', 'meta_analysis'] },
  { label: 'Epidemiology', types: ['outbreak_investigation', 'spatial_analysis'] },
  { label: 'Study Design', types: ['sample_size'] },
]

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
    default: return <p className="text-sm text-[var(--text-tertiary)]">No configuration available.</p>
  }
}

// ── Analysis type grouped accordion ──────────────────────
const ANALYSIS_GROUPS: {
  id: string; label: string
  types: { type: AnalysisType; label: string }[]
}[] = [
  {
    id: 'descriptive', label: 'Descriptive',
    types: [
      { type: 'descriptive', label: 'Descriptive Stats' },
      { type: 'frequency',   label: 'Frequency'         },
    ],
  },
  {
    id: 'tests', label: 'Hypothesis Tests',
    types: [
      { type: 'chi_square',  label: 'Chi-Square'   },
      { type: 't_test',      label: 'T-Test'        },
      { type: 'anova',       label: 'ANOVA'         },
      { type: 'correlation', label: 'Correlation'   },
    ],
  },
  {
    id: 'regression', label: 'Regression',
    types: [
      { type: 'simple_regression',      label: 'Simple'       },
      { type: 'multiple_regression',    label: 'Multiple'     },
      { type: 'logistic_regression',    label: 'Logistic'     },
      { type: 'multinomial_regression', label: 'Multinomial'  },
      { type: 'ordinal_regression',     label: 'Ordinal'      },
      { type: 'poisson_regression',     label: 'Poisson'      },
      { type: 'negbinomial_regression', label: 'Neg. Binomial'},
    ],
  },
  {
    id: 'survival', label: 'Survival',
    types: [
      { type: 'kaplan_meier',   label: 'Kaplan-Meier'  },
      { type: 'cox_regression', label: 'Cox Regression'},
      { type: 'time_series',    label: 'Time Series'   },
    ],
  },
  {
    id: 'advanced', label: 'Advanced',
    types: [
      { type: 'pca',             label: 'PCA'           },
      { type: 'factor_analysis', label: 'Factor'        },
      { type: 'cluster_analysis',label: 'Clustering'    },
      { type: 'meta_analysis',   label: 'Meta-Analysis' },
    ],
  },
  {
    id: 'epidemiology', label: 'Epidemiology',
    types: [
      { type: 'outbreak_investigation', label: 'Outbreak'    },
      { type: 'spatial_analysis',       label: 'Spatial'     },
      { type: 'sample_size',            label: 'Sample Size' },
    ],
  },
]

// ── Main Component ──────────────────────────────────────
export function AnalysisHub({ projectId }: Props) {
  const { profile } = useAuth()
  const supabase = useMemo(() => createClient(), [])

  const [runs, setRuns]     = useState<AnalysisRun[]>([])
  const [loading, setLoading] = useState(true)
  const [project, setProject] = useState<ProjectMeta | null>(null)

  // History drawer
  const [historyOpen, setHistoryOpen]   = useState(false)
  const [viewingRunId, setViewingRunId] = useState<string | null>(null)

  // Input form state
  const [data, setData]               = useState<DataRow[]>([])
  const [columns, setColumns]         = useState<DatasetColumn[]>([])
  const [fileName, setFileName]       = useState('')
  const [datasetId, setDatasetId]     = useState<string | undefined>()
  const [versionId, setVersionId]     = useState<string | undefined>()
  const [selectedType, setSelectedType] = useState<AnalysisType | null>(null)
  const [config, setConfig]           = useState<Record<string, unknown>>({})

  // Run state
  const [running, setRunning]   = useState(false)
  const [result, setResult]     = useState<AnalysisResult | null>(null)
  const [savedRunId, setSavedRunId] = useState<string | null>(null)
  const [resultTab, setResultTab] = useState<'results' | 'tables'>('results')

  // Modals
  const [hubTableModalOpen, setHubTableModalOpen] = useState(false)
  const [assumptionCheckResult, setAssumptionCheckResult] = useState<AssumptionCheckResult | null>(null)
  const [showAssumptionModal, setShowAssumptionModal] = useState(false)

  // Approval gate
  const [approvalBlock, setApprovalBlock] = useState<{
    status: string; reason: string; requestId?: string
  } | null>(null)

  // Project datasets for inline picker
  const [projectDatasets, setProjectDatasets]       = useState<ProjectDataset[]>([])
  const [datasetsLoading, setDatasetsLoading]       = useState(true)
  const [datasetLoadingId, setDatasetLoadingId]     = useState<string | null>(null)

  useEffect(() => {
    const fetch = async () => {
      setDatasetsLoading(true)
      const { data: ds } = await supabase
        .from('datasets')
        .select('id, name')
        .eq('project_id', projectId)
        .is('deleted_at', null)
        .is('archived_at', null)
        .order('updated_at', { ascending: false })

      if (!ds?.length) { setProjectDatasets([]); setDatasetsLoading(false); return }

      const { data: vs } = await supabase
        .from('dataset_versions')
        .select('id, version_number, row_count, column_count, file_path, dataset_id')
        .in('dataset_id', ds.map(d => d.id))
        .order('version_number', { ascending: false })

      const latestMap = new Map<string, ProjectDataset['latestVersion']>()
      for (const v of (vs ?? [])) {
        if (!latestMap.has(v.dataset_id)) latestMap.set(v.dataset_id, v)
      }
      setProjectDatasets(ds.map(d => ({ id: d.id, name: d.name, latestVersion: latestMap.get(d.id) ?? null })))
      setDatasetsLoading(false)
    }
    fetch()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  const selectDataset = async (ds: ProjectDataset) => {
    if (!ds.latestVersion || datasetLoadingId) return
    setDatasetLoadingId(ds.id)
    try {
      const parsed = await loadVersionData(ds.latestVersion.file_path)
      const cols: DatasetColumn[] = parsed.columns.map(col => ({
        name: col.name,
        type: col.type,
        unique_values: col.unique_count,
        missing: col.null_count,
        sample_values: col.sample_values as (string | number)[],
      }))
      await handleData(parsed.rows as DataRow[], cols, ds.name, ds.id, ds.latestVersion.id)
    } catch {
      toast.error('Failed to load dataset')
    } finally {
      setDatasetLoadingId(null)
    }
  }

  const clearDataset = () => {
    setData([]); setColumns([]); setFileName('')
    setDatasetId(undefined); setVersionId(undefined)
    setResult(null); setSavedRunId(null); setApprovalBlock(null)
    setDecisionMode(null)
  }

  // Config panel collapse — kept for assumption modal path
  const [configCollapsed, setConfigCollapsed] = useState(false)

  // Decision engine mode
  type DecisionMode = 'entry' | 'guided' | 'direct' | null
  const [decisionMode, setDecisionMode] = useState<DecisionMode>(null)
  const [decisionPreselect, setDecisionPreselect] = useState<AnalysisTypeId | null>(null)

  // Sequential workflow progress
  const [workflowProgress, setWorkflowProgress] = useState<{
    total: number
    current: number  // 0-indexed: which step is running
    label: string
  } | null>(null)

  // Analysis type accordion open groups
  const [openGroups, setOpenGroups] = useState<string[]>([])
  const toggleGroup = (id: string) =>
    setOpenGroups(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id])


  useEffect(() => {
    supabase.from('analysis_runs')
      .select('*, dataset:datasets(id, name)')
      .eq('project_id', projectId).is('deleted_at', null)
      .order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => {
        if (data) setRuns(data as AnalysisRun[])
        setLoading(false)
      })
  }, [projectId, supabase])

  useEffect(() => {
    supabase.from('projects')
      .select('title, description, methodology, research_objectives')
      .eq('id', projectId).maybeSingle()
      .then(({ data }) => { if (data) setProject(data as ProjectMeta) })
  }, [projectId, supabase])

  // ── Engine functions (unchanged) ────────────────────────

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('analysis_runs')
      .update({ deleted_at: new Date().toISOString() }).eq('id', id)
    if (error) { toast.error('Failed to delete analysis'); return }
    setRuns(prev => prev.filter(r => r.id !== id))
    if (viewingRunId === id) setViewingRunId(null)
    await logAudit('analysis.run.deleted', 'analysis_run', id, {}, projectId)
    toast.success('Analysis deleted')
  }

  const handleData = async (rows: DataRow[], cols: DatasetColumn[], name: string, dsId?: string, vsId?: string) => {
    setData(rows); setColumns(cols); setFileName(name)
    setDatasetId(dsId); setVersionId(vsId); setResult(null); setSavedRunId(null)
    setApprovalBlock(null)

    setDecisionMode('entry')

    if (dsId && vsId) {
      try {
        const res = await fetch(`/api/datasets/${dsId}/approval/status?version_id=${vsId}`)
        if (res.ok) {
          const json = await res.json()
          if (!json.can_analyze && json.status !== 'not_required') {
            setApprovalBlock({ status: json.status, reason: json.reason ?? 'Supervisor approval required.', requestId: json.request?.id })
          }
        }
      } catch { /* non-blocking */ }
    }
  }

  const handleTypeSelect = (type: AnalysisType) => {
    setSelectedType(type); setConfig({}); setResult(null); setSavedRunId(null)
  }

  const executeAnalysis = async () => {
    if (!selectedType) return
    setRunning(true); setResult(null); setViewingRunId(null)
    setConfigCollapsed(true) // collapse config panel to make room for results
    try {
      setResult(await runAnalysis(selectedType, data, config))
      setResultTab('results')
    } catch (err) {
      setResult({ type: selectedType, summary: { error: err instanceof Error ? err.message : 'Analysis failed' }, tables: [], charts: [], interpretation: 'Analysis failed.' })
    } finally {
      setRunning(false)
    }
  }

  // ── Decision engine run — called by GuidedFlow and DirectFlow ──────────────
  const runWithTypeAndConfig = async (
    backendType: string,
    backendConfig: Record<string, unknown>,
  ) => {
    const t = backendType as AnalysisType
    setSelectedType(t)
    setConfig(backendConfig)
    setDecisionMode(null)
    setRunning(true)
    setResult(null)
    setViewingRunId(null)
    setConfigCollapsed(true)
    try {
      setResult(await runAnalysis(t, data, backendConfig))
      setResultTab('results')
    } catch (err) {
      setResult({
        type: t,
        summary: { error: err instanceof Error ? err.message : 'Analysis failed' },
        tables: [],
        charts: [],
        interpretation: 'Analysis failed.',
      })
    } finally {
      setRunning(false)
    }
  }

  // ── Sequential workflow runner — called from GuidedFlow ────────────────────
  const runWorkflowSequentially = async (steps: ExecutableWorkflowStep[]) => {
    const executableSteps = steps.filter(s => s.executable_config)
    if (executableSteps.length === 0) return

    setDecisionMode(null)
    setResult(null)
    setViewingRunId(null)
    setRunning(true)
    setWorkflowProgress({ total: executableSteps.length, current: 0, label: executableSteps[0].name })

    for (let i = 0; i < executableSteps.length; i++) {
      const step = executableSteps[i]
      const { backendType, config: stepConfig } = step.executable_config!

      setWorkflowProgress({ total: executableSteps.length, current: i, label: step.name })

      try {
        const analysisResult = await runAnalysis(backendType as AnalysisType, data, stepConfig)

        if (step.is_final) {
          // Final analysis → show in hub
          setSelectedType(backendType as AnalysisType)
          setConfig(stepConfig)
          setResult(analysisResult)
          setResultTab('results')
        } else {
          // Intermediate → auto-save to history silently
          if (profile && datasetId) {
            const { data: savedRun } = await supabase.from('analysis_runs').insert({
              project_id: projectId,
              dataset_id: datasetId,
              version_id: versionId ?? null,
              analysis_type: backendType as AnalysisType,
              title: `${step.name} — ${fileName} — ${new Date().toLocaleDateString()}`,
              config: stepConfig,
              results: analysisResult as unknown as Record<string, unknown>,
              interpretation: analysisResult.interpretation,
              status: 'completed',
              created_by: profile.id,
            }).select().single()
            if (savedRun) {
              setRuns(prev => [savedRun as AnalysisRun, ...prev])
            }
          }
        }
      } catch {
        // Intermediate failures: keep going. Final failure: show error.
        if (step.is_final) {
          setResult({
            type: backendType as AnalysisType,
            summary: { error: 'Final analysis step failed. Check variable selections.' },
            tables: [], charts: [], interpretation: 'Analysis failed.',
          })
        }
      }
    }

    setRunning(false)
    setWorkflowProgress(null)
  }

  const handleRun = async () => {
    if (!selectedType) return
    if (approvalBlock) return

    if (datasetId && versionId) {
      try {
        const res = await fetch('/api/analysis/assumption-checks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dataset_id: datasetId, version_id: versionId, project_id: projectId, analysis_type: selectedType, analysis_config: config }),
        })
        if (res.ok) {
          const checkResult: AssumptionCheckResult = await res.json()
          if (!checkResult.all_passed || checkResult.requires_acknowledgement) {
            setAssumptionCheckResult(checkResult)
            setShowAssumptionModal(true)
            return
          }
        }
      } catch { /* non-blocking */ }
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
          body: JSON.stringify({ project_id: projectId, dataset_id: datasetId, analysis_type: selectedType, variables: config, key_result: keyResult.estimate !== null ? keyResult : null, label: run.title, analysis_run_id: run.id }),
        }).catch(() => {})
      }

      setSavedRunId(run.id)
      setRuns(prev => [run as AnalysisRun, ...prev])
      toast.success('Analysis saved')
    }
  }

  // ── Derived ─────────────────────────────────────────────

  const needsData  = selectedType !== 'sample_size'
  const dataLoaded = data.length > 0
  const canRun     = !!selectedType && !running && !approvalBlock && (needsData ? dataLoaded : true)

  const viewingRun    = viewingRunId ? runs.find(r => r.id === viewingRunId) ?? null : null
  const viewingResult = viewingRun?.results as unknown as AnalysisResult | null | undefined

  const statusDotClass: Record<string, string> = {
    completed: 'status-dot--verified',
    failed:    'status-dot--flagged',
    running:   'status-dot--running',
    pending:   'status-dot--neutral',
    cancelled: 'status-dot--neutral',
  }

  // ── Loading ──────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-1 min-h-0">
        <div className="w-[320px] flex-shrink-0 border-r border-[var(--border-row)] p-5 space-y-4">
          {[80, 120, 60, 100].map((w, i) => (
            <div key={i} className="skeleton rounded h-8" style={{ width: `${w}%` }} />
          ))}
        </div>
        <div className="flex-1" />
      </div>
    )
  }

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">

      {/* ── Tab bar ─────────────────────────────────────── */}
      <div className="flex items-center flex-shrink-0 border-b border-[var(--border-row)] px-4"
        style={{ background: 'var(--bg-surface)' }}>
        {/* Project page tabs */}
        <div className="flex items-center flex-1">
          {([
            { label: 'Overview', href: `/projects/${projectId}/overview` },
            { label: 'Data',     href: `/projects/${projectId}/data`     },
            { label: 'Analysis', active: true                             },
          ] as { label: string; href?: string; active?: boolean }[]).map(tab => (
            tab.href ? (
              <Link
                key={tab.label}
                href={tab.href}
                className="relative px-3 py-3 text-sm font-medium transition-colors"
                style={{ color: 'var(--text-tertiary)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
              >
                {tab.label}
              </Link>
            ) : (
              <span
                key={tab.label}
                className="relative px-3 py-3 text-sm font-semibold"
                style={{ color: 'var(--accent-blue)' }}
              >
                {tab.label}
                <span className="absolute bottom-0 left-3 right-3 h-[2px] rounded-t-sm" style={{ background: 'var(--accent-blue)' }} />
              </span>
            )
          ))}
        </div>
        {/* Actions */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => { setHistoryOpen(true); setConfigCollapsed(false) }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-row-hover)' }}
            onMouseLeave={e => { e.currentTarget.style.background = '' }}
          >
            <Clock className="h-3.5 w-3.5" />
            History
            {runs.length > 0 && (
              <span className="ml-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold"
                style={{ background: 'var(--bg-inset)', color: 'var(--text-tertiary)' }}>
                {runs.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setHubTableModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors"
            style={{ border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-row-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = '')}
          >
            <Table2 className="h-3.5 w-3.5" />
            Generate Table
          </button>
        </div>
      </div>

      {/* ── Two-panel workspace ──────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── LEFT: Input panel ─────────────────────────── */}
        <div
          className="relative flex-shrink-0 border-r border-[var(--border-row)] flex flex-col overflow-hidden"
          style={{ background: 'var(--bg-surface)', width: '240px' }}
        >

          {/* History drawer — slides over the left panel */}
          {historyOpen && !configCollapsed && (
            <motion.div
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="absolute inset-0 z-20 bg-[var(--bg-app)] flex flex-col"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-row)] flex-shrink-0">
                <span className="text-sm font-semibold text-[var(--text-primary)]">History</span>
                <button
                  onClick={() => setHistoryOpen(false)}
                  className="h-7 w-7 flex items-center justify-center rounded-md text-[var(--text-tertiary)] hover:bg-[var(--bg-row-hover)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="overflow-y-auto flex-1">
                {runs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
                    <BarChart2 className="h-5 w-5 text-[var(--text-tertiary)] mb-2" />
                    <p className="text-xs text-[var(--text-tertiary)]">No analyses yet</p>
                  </div>
                ) : (
                  <div>
                    {runs.map(run => {
                      const info = ANALYSIS_TYPES.find(t => t.type === run.analysis_type)
                      const ds   = run.dataset as { name: string } | null
                      const isViewing = viewingRunId === run.id
                      return (
                        <button
                          key={run.id}
                          onClick={() => { setViewingRunId(run.id); setHistoryOpen(false) }}
                          className={`group w-full text-left flex items-center gap-2.5 px-4 py-3 border-b border-[var(--border-row)] last:border-0 transition-colors ${
                            isViewing ? 'bg-[var(--bg-row-active)]' : 'hover:bg-[var(--bg-row-hover)]'
                          }`}
                        >
                          <span className={`status-dot ${statusDotClass[run.status] ?? 'status-dot--neutral'} flex-shrink-0`} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-[var(--text-primary)] truncate leading-snug">
                              {run.title ?? info?.label ?? run.analysis_type}
                            </p>
                            <p className="data-mono-xs text-[var(--text-tertiary)] mt-0.5 truncate">
                              {ds?.name ? `${ds.name} · ` : ''}{formatRelative(run.created_at)}
                            </p>
                          </div>
                          <button
                            onClick={e => { e.stopPropagation(); handleDelete(run.id) }}
                            className="opacity-0 group-hover:opacity-100 text-[var(--text-tertiary)] hover:text-[var(--timeline-flagged)] flex-shrink-0 p-0.5 transition-opacity"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Scrollable input form */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">

            {/* Dataset */}
            <div>
              <p className="subsection-label mb-2">Dataset</p>

              {dataLoaded ? (
                /* ── Selected state: just the chosen dataset + change link ── */
                <div
                  className="flex items-center gap-2.5 px-2.5 py-2.5 rounded-md"
                  style={{
                    border:      '1px solid var(--accent-blue)',
                    borderLeft:  '3px solid var(--accent-blue)',
                    background:  'var(--accent-blue-subtle)',
                  }}
                >
                  <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(59,130,246,0.15)' }}>
                    <Database className="h-3 w-3" style={{ color: 'var(--accent-blue)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{fileName}</p>
                    <p className="data-mono-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {data.length.toLocaleString()} rows · {columns.length} cols
                    </p>
                  </div>
                  <button
                    onClick={clearDataset}
                    className="flex items-center gap-1 text-[11px] font-medium flex-shrink-0 px-1.5 py-1 rounded transition-colors"
                    style={{ color: 'var(--text-tertiary)' }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-row-hover)' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.background = '' }}
                  >
                    <X className="h-3 w-3" />
                    Change
                  </button>
                </div>
              ) : datasetsLoading ? (
                /* ── Loading skeleton ── */
                <div className="space-y-1.5">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="skeleton h-10 rounded-md" />
                  ))}
                </div>
              ) : projectDatasets.length === 0 ? (
                /* ── Empty state ── */
                <div className="flex flex-col items-center text-center px-3 py-4 rounded-md"
                  style={{ border: '1px dashed var(--border-strong)' }}>
                  <Database className="h-5 w-5 mb-1.5" style={{ color: 'var(--text-tertiary)' }} />
                  <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>No datasets yet</p>
                  <Link
                    href={`/projects/${projectId}/data`}
                    className="text-[11px] mt-1 hover:underline"
                    style={{ color: 'var(--accent-blue)' }}
                  >
                    Go to Data Hub →
                  </Link>
                </div>
              ) : (
                /* ── Dataset list — one tap to select ── */
                <div className="flex flex-col gap-1">
                  <p className="text-[11px] mb-1" style={{ color: 'var(--text-tertiary)' }}>
                    Click a dataset to load it for analysis
                  </p>
                  {projectDatasets.map(ds => {
                    const isLoading = datasetLoadingId === ds.id
                    const v = ds.latestVersion
                    return (
                      <button
                        key={ds.id}
                        onClick={() => selectDataset(ds)}
                        disabled={!!datasetLoadingId}
                        className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left transition-colors disabled:opacity-60"
                        style={{ border: '1px solid var(--border-default)', background: 'var(--bg-app)' }}
                        onMouseEnter={e => { if (!datasetLoadingId) e.currentTarget.style.background = 'var(--bg-row-hover)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-app)' }}
                      >
                        <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
                          style={{ background: 'var(--bg-inset)' }}>
                          <Database className="h-3 w-3" style={{ color: 'var(--text-tertiary)' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{ds.name}</p>
                          {v ? (
                            <p className="data-mono-xs" style={{ color: 'var(--text-tertiary)' }}>
                              {v.row_count?.toLocaleString() ?? '—'} rows · {v.column_count ?? '—'} cols
                            </p>
                          ) : (
                            <p className="text-[11px] italic" style={{ color: 'var(--text-tertiary)' }}>No version</p>
                          )}
                        </div>
                        {isLoading && (
                          <div className="h-3.5 w-3.5 rounded-full border-2 border-t-transparent flex-shrink-0 animate-spin"
                            style={{ borderColor: 'var(--accent-blue)', borderTopColor: 'transparent' }} />
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* New Analysis button — shown when dataset is loaded but engine is closed */}
            {dataLoaded && !decisionMode && (
              <button
                onClick={() => setDecisionMode('entry')}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold text-white active:scale-[0.98] transition-all"
                style={{ background: 'linear-gradient(135deg,var(--color-clinical-deep),var(--color-clinical-blue))' }}
              >
                <Play className="h-3.5 w-3.5" />
                Run Analysis
              </button>
            )}

          </div>

        </div>

        {/* ── RIGHT: Results / Engine panel ─────────────── */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

          {/* ── Decision engine — takes over right panel ── */}
          {decisionMode !== null && dataLoaded && (() => {
            const engineSchema = profileFromDatasetColumns(columns, data.length)
            const engineContext: DatasetContext = {
              dataset_id: datasetId ?? '',
              version_id: versionId ?? '',
              dataset_name: fileName,
              row_count: data.length,
              complete_cases: data.length,
              schema: engineSchema,
            }
            return (
              <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
                {decisionMode === 'entry' && (
                  <AnalysisEntryPoint
                    dataset={{ id: datasetId ?? '', name: fileName, source: '', row_count: data.length, version_id: versionId ?? '' }}
                    onGuided={() => setDecisionMode('guided')}
                    onDirect={() => setDecisionMode('direct')}
                  />
                )}
                {decisionMode === 'guided' && (
                  <GuidedFlow
                    dataset={engineContext}
                    schema={engineSchema}
                    onRunWorkflow={runWorkflowSequentially}
                    onSwitchToDirect={preselected => {
                      setDecisionPreselect(preselected ?? null)
                      setDecisionMode('direct')
                    }}
                    onBack={() => setDecisionMode('entry')}
                  />
                )}
                {decisionMode === 'direct' && (
                  <DirectFlow
                    dataset={engineContext}
                    schema={engineSchema}
                    preselectedType={decisionPreselect ?? undefined}
                    onRunAnalysis={runWithTypeAndConfig}
                    onSwitchToGuided={() => setDecisionMode('guided')}
                    onBack={() => setDecisionMode('entry')}
                  />
                )}
              </div>
            )
          })()}

          {decisionMode === null && (viewingRunId && viewingRun ? (
            /* ── Viewing a historical run ── */
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between px-6 py-3 border-b border-[var(--border-row)] flex-shrink-0">
                <div className="flex items-center gap-2">
                  <span className={`status-dot ${statusDotClass[viewingRun.status] ?? 'status-dot--neutral'}`} />
                  <span className="text-sm font-medium text-[var(--text-primary)] truncate">
                    {viewingRun.title ?? ANALYSIS_TYPES.find(t => t.type === viewingRun.analysis_type)?.label ?? viewingRun.analysis_type}
                  </span>
                  <span className="data-mono-xs text-[var(--text-tertiary)]">· {formatRelative(viewingRun.created_at)}</span>
                </div>
                <button
                  onClick={() => setViewingRunId(null)}
                  className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-row-hover)] px-2.5 py-1 rounded transition-colors"
                >
                  ← Back
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {viewingRun.status === 'completed' && viewingResult ? (
                  <HubResultsPreview run={viewingRun} result={viewingResult} projectId={projectId} />
                ) : viewingRun.status === 'failed' ? (
                  <div className="flex flex-col items-center justify-center h-full text-center px-8">
                    <span className="status-dot status-dot--flagged mb-3" />
                    <p className="text-sm text-[var(--text-primary)]">Analysis failed</p>
                    <p className="text-xs text-[var(--text-tertiary)] mt-1">{(viewingRun as { error_message?: string }).error_message ?? 'An unknown error occurred.'}</p>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-xs text-[var(--text-tertiary)]">No results available.</p>
                  </div>
                )}
              </div>
            </div>

          ) : decisionMode === null && running ? (
            /* ── Running (single or workflow) ── */
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <div className="w-8 h-8 rounded-full border-2 border-[var(--accent-blue)] border-t-transparent animate-spin mb-4" />
              {workflowProgress ? (
                <>
                  <p className="text-sm font-medium text-[var(--text-primary)] mb-1">Running Analysis Workflow</p>
                  <p className="text-xs mb-6" style={{ color: 'var(--text-tertiary)' }}>
                    Step {workflowProgress.current + 1} of {workflowProgress.total}: {workflowProgress.label}
                  </p>
                  <div className="flex items-center gap-2">
                    {Array.from({ length: workflowProgress.total }).map((_, i) => (
                      <div
                        key={i}
                        className="w-2 h-2 rounded-full transition-colors"
                        style={{
                          background: i < workflowProgress.current
                            ? 'var(--status-success)'
                            : i === workflowProgress.current
                              ? 'var(--accent-blue)'
                              : 'var(--bg-inset)',
                        }}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-[var(--text-primary)]">Running analysis…</p>
                  <p className="text-xs text-[var(--text-tertiary)] mt-1">
                    {ANALYSIS_TYPES.find(t => t.type === selectedType)?.label ?? 'Processing'}
                  </p>
                </>
              )}
            </div>

          ) : decisionMode === null && result && !result.summary?.error ? (
            /* ── Fresh result ── */
            <div className="flex flex-col h-full">
              {/* Result header */}
              <div className="px-5 pt-4 pb-0 flex-shrink-0" style={{ background: 'var(--bg-surface)' }}>
                {/* Title + actions row */}
                <div className="flex items-start gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold leading-snug" style={{ color: 'var(--text-primary)' }}>
                      {ANALYSIS_TYPES.find(t => t.type === selectedType)?.label ?? 'Results'}
                      {fileName ? ` — ${fileName}` : ''}
                    </p>
                    <p className="data-mono-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                      {data.length > 0 ? `${data.length.toLocaleString()} observations` : ''}
                      {result && ' · Completed just now'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={handleSave}
                      disabled={!!savedRunId}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-row-hover)')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" style={{ color: savedRunId ? 'var(--status-success)' : undefined }} />
                      {savedRunId ? 'Saved' : 'Add to Report'}
                    </button>
                  </div>
                </div>
                {/* Tabs */}
                <div className="flex items-center gap-0">
                  {(['results', 'tables'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setResultTab(tab)}
                      className="relative px-3 py-2 text-xs font-medium transition-colors"
                      style={{ color: resultTab === tab ? 'var(--accent-blue)' : 'var(--text-tertiary)' }}
                    >
                      {tab === 'results' ? 'Results' : 'Tables'}
                      {resultTab === tab && (
                        <span className="absolute bottom-0 left-3 right-3 h-[2px] rounded-t-sm" style={{ background: 'var(--accent-blue)' }} />
                      )}
                    </button>
                  ))}
                </div>
                <div className="h-px" style={{ background: 'var(--border-row)' }} />
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-y-auto">
                {resultTab === 'results' ? (
                  <div className="px-6 py-5 space-y-5">
                    {/* Charts — hero */}
                    {(result.charts ?? []).length > 0 && (
                      <AnalysisCharts
                        charts={result.charts as Parameters<typeof AnalysisCharts>[0]['charts']}
                        analysisType={selectedType ?? 'descriptive'}
                      />
                    )}

                    {/* Summary chips */}
                    {(() => {
                      const findings = getKeyFindings(result, selectedType ?? '')
                      if (findings.length === 0) return null
                      return (
                        <div className="flex flex-wrap gap-2 pb-3 border-b border-[var(--border-row)]">
                          {findings.map((f, i) => {
                            // Colour-code: last chip (complete %) teal, second-to-last (missing %) amber, rest plain
                            const isComplete = i === findings.length - 1 && f.label.toLowerCase().includes('complet')
                            const isMissing  = f.label.toLowerCase().includes('miss')
                            const chipStyle = isComplete
                              ? { background: 'var(--accent-blue-subtle)', border: '1px solid var(--border-status-info)', color: 'var(--status-info-text)' }
                              : isMissing
                              ? { background: 'var(--status-warning-bg)', border: '1px solid var(--border-status-warning)', color: 'var(--status-warning-text)' }
                              : { background: 'var(--bg-surface)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }
                            return (
                              <div key={f.label} className="flex flex-col px-3 py-2 rounded-lg" style={chipStyle}>
                                <span className="text-[9px] uppercase tracking-[0.08em] mb-0.5" style={{ opacity: 0.7 }}>{f.label}</span>
                                <span className="text-sm font-bold" style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>{f.value}</span>
                              </div>
                            )
                          })}
                        </div>
                      )
                    })()}

                    {/* Interpretation */}
                    {result.interpretation && (
                      <div className="px-4 py-3 rounded-lg bg-[var(--bg-row-hover)] border border-[var(--border-row)]">
                        <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider mb-1.5 font-semibold">Interpretation</p>
                        <p className="text-sm text-[var(--text-primary)] leading-relaxed">{result.interpretation}</p>
                      </div>
                    )}

                    {/* Plain language */}
                    {(result as { plainLanguage?: string }).plainLanguage && (
                      <div className="px-4 py-3 rounded-lg border border-[var(--accent-blue)]/15 bg-blue-50/40">
                        <p className="text-[10px] text-[var(--accent-blue)] uppercase tracking-wider mb-1.5 font-semibold">Plain Language</p>
                        <p className="text-sm text-[var(--text-primary)] leading-relaxed">{(result as { plainLanguage?: string }).plainLanguage}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Tables tab */
                  <div className="px-6 py-5 space-y-6">
                    {(result.tables ?? []).length === 0 ? (
                      <p className="text-xs text-[var(--text-tertiary)] text-center py-8">No tables in this result.</p>
                    ) : (result.tables ?? []).map((table, i) => (
                      <div key={i}>
                        <p className="text-xs font-semibold text-[var(--text-secondary)] mb-2">{table.title}</p>
                        <div className="overflow-x-auto rounded-lg border border-[var(--border-row)]">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-[var(--bg-row-hover)]">
                                {table.headers.map((h, j) => (
                                  <th key={j} className="px-3 py-2 text-left font-semibold text-[var(--text-secondary)] whitespace-nowrap border-b border-[var(--border-row)]">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {table.rows.map((row, j) => (
                                <tr key={j} className="border-b border-[var(--border-row)] last:border-0 hover:bg-[var(--bg-row-hover)] transition-colors">
                                  {row.map((cell, k) => (
                                    <td key={k} className="px-3 py-2 text-[var(--text-primary)] whitespace-nowrap font-mono">
                                      {cell === null ? <span className="text-[var(--text-tertiary)]">—</span> : String(cell)}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          ) : decisionMode === null && result?.summary?.error ? (
            /* ── Error ── */
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <div className="rounded-lg border border-[var(--timeline-flagged)]/20 bg-red-50 px-6 py-5 max-w-md">
                <p className="text-sm font-semibold text-[var(--timeline-flagged)] mb-1">Analysis Error</p>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{String(result.summary.error)}</p>
              </div>
            </div>

          ) : (
            /* ── Empty / idle state ── */
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center mb-4"
                style={{ background: 'var(--bg-inset)', border: '1px solid var(--border-default)' }}
              >
                <BarChart2 className="h-7 w-7" style={{ color: 'var(--text-tertiary)' }} />
              </div>
              <p className="text-sm font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                {dataLoaded ? 'Ready to analyse' : 'Select a dataset to begin'}
              </p>
              <p className="text-xs max-w-[240px] leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
                {dataLoaded
                  ? 'Click "Run Analysis" on the left to start the guided or direct flow.'
                  : runs.length > 0
                    ? 'Pick a dataset on the left, or open History to revisit past results.'
                    : 'Pick a dataset on the left to get started.'}
              </p>
              {runs.length > 0 && (
                <button
                  onClick={() => setHistoryOpen(true)}
                  className="mt-4 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
                  style={{ border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-row-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  <Clock className="h-3.5 w-3.5" />
                  View History
                </button>
              )}
            </div>
          ))}
        </div>

      </div>

      {/* ── Modals ──────────────────────────────────────── */}
      {hubTableModalOpen && (
        <HubTableGeneratorModal projectId={projectId} onClose={() => setHubTableModalOpen(false)} />
      )}

      {showAssumptionModal && assumptionCheckResult && selectedType && (
        <AssumptionCheckModal
          isOpen={showAssumptionModal}
          onClose={() => setShowAssumptionModal(false)}
          checkResult={assumptionCheckResult}
          analysisType={selectedType}
          onProceed={async (notes) => {
            setShowAssumptionModal(false)
            if (assumptionCheckResult.requires_acknowledgement) {
              try {
                await fetch(`/api/analysis/assumption-checks/${assumptionCheckResult.check_id}/acknowledge`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ acknowledgement_notes: notes }),
                })
              } catch { /* non-blocking */ }
            }
            await executeAnalysis()
          }}
          onCancel={() => setShowAssumptionModal(false)}
        />
      )}
    </div>
  )
}

// ── Key findings per analysis type ──────────────────────
type Finding = { label: string; value: string }

function getKeyFindings(result: AnalysisResult, analysisType: string): Finding[] {
  const s = result.summary as Record<string, unknown>
  const tables = result.tables ?? []

  const get = (key: string): string | null =>
    s[key] !== undefined && s[key] !== null && s[key] !== '' ? String(s[key]) : null

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
    if (value !== null && findings.length < 6) findings.push({ label, value })
  }

  switch (analysisType) {
    case 'descriptive': {
      const t = tables.find(t => t.id === 'numeric_summary')
      if (t && t.rows.length > 0) {
        const r = t.rows[0]
        add('Variable', r[0] !== null ? String(r[0]) : null)
        add('N', r[1] !== null ? String(r[1]) : null)
        add('Mean', r[3] !== null ? String(r[3]) : null)
        add('Std Dev', r[4] !== null ? String(r[4]) : null)
      } else {
        const ct = tables.find(t => t.id === 'categorical_summary')
        if (ct && ct.rows.length > 0) {
          const r = ct.rows[0]
          add('Variable', r[0] !== null ? String(r[0]) : null)
          add('N', r[1] !== null ? String(r[1]) : null)
          add('Unique', r[3] !== null ? String(r[3]) : null)
          add('Mode', r[4] !== null ? String(r[4]) : null)
        } else {
          add('N', get('n')); add('Numeric Vars', get('numericVars')); add('Cat Vars', get('catVars'))
        }
      }
      break
    }
    case 'frequency': {
      add('N', get('n')); add('Variable', get('variable')); add('Categories', get('categories'))
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
      const tt = tables[0]
      if (tt) {
        const hi = (kw: string) => tt.headers.findIndex(h => h.toLowerCase().includes(kw))
        const r = tt.rows[0]
        if (r) {
          const nIdx = hi('n'); const meanIdx = hi('mean'); const tIdx = hi('t'); const pIdx = hi('p'); const dIdx = hi('cohen')
          if (nIdx >= 0) add('N', String(r[nIdx]))
          if (meanIdx >= 0) add('Mean', String(r[meanIdx]))
          if (tIdx >= 0) add('t', String(r[tIdx]))
          if (pIdx >= 0) add('p-value', String(r[pIdx]))
          if (dIdx >= 0) add("Cohen's d", String(r[dIdx]))
        }
      }
      if (findings.length === 0) { add('Test', get('testType')); add('Variable', get('variable')) }
      break
    }
    case 'anova':
      add('N', get('n')); add('F', get('fStat')); add('p-value', get('pValue')); add('η²', get('etaSq') ?? get('etaSquared'))
      break
    case 'correlation': {
      add('Variables', get('variables')); add('Method', get('method'))
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
      add('N', get('n')); add('R²', get('r2') ?? get('rSquared')); add('p-value', get('pValue'))
      add('β', fromTable('coefficients', 'estimate', 1) ?? fromTable('coeff', 'b', 1))
      break
    case 'multiple_regression':
      add('N', get('n')); add('R²', get('r2') ?? get('rSquared')); add('Adj R²', get('adjR2') ?? get('adjustedR2')); add('p-value', get('pValue'))
      break
    case 'logistic_regression':
      add('N', get('n')); add('Events', get('events')); add('AUC', get('auc')); add('Nagelkerke R²', get('nagelkerkeR2'))
      break
    case 'multinomial_regression':
    case 'ordinal_regression':
      add('N', get('n')); add('AIC', get('aic')); add('p-value', get('pValue')); add('Pseudo R²', get('pseudoR2') ?? get('mcfadden'))
      break
    case 'poisson_regression':
    case 'negbinomial_regression':
      add('N', get('n')); add('AIC', get('aic')); add('Deviance', get('deviance')); add('p-value', get('pValue'))
      break
    case 'kaplan_meier':
      add('N Total', get('n')); add('Events', get('events')); add('Groups', get('groups')); add('Log-rank p', get('logRankP'))
      break
    case 'cox_regression':
      add('N', get('n')); add('Events', get('events')); add('C-statistic', get('concordance')); add('LR p-value', get('lrP'))
      break
    case 'time_series':
      add('N', get('n')); add('Time Points', get('timePoints')); add('Classifications', get('classifications'))
      break
    case 'pca':
      add('N', get('n')); add('Components', get('nComp') ?? get('p')); add('PC1 Var %', get('varExplained1')); add('PC2 Var %', get('varExplained2'))
      break
    case 'factor_analysis':
      add('N', get('n')); add('Factors', get('nFactors') ?? get('factors')); add('KMO', get('kmo')); add('Total Var %', get('variance') ?? get('totalVariance'))
      break
    case 'cluster_analysis':
      add('N', get('n')); add('Clusters', get('nClusters') ?? get('k')); add('Silhouette', get('avgSilhouette') ?? get('silhouette')); add('WCSS', get('wcss'))
      break
    case 'meta_analysis':
      add('Studies', get('k')); add('Effect Size', get('summaryES')); add('I²', get('I2') ?? get('i2')); add('p-value', get('pValue'))
      break
    case 'sample_size':
      add('Design', get('design')); add('N per Group', get('nPerGroup')); add('Total N', get('totalN') ?? get('finalN')); add('Power', get('power'))
      break
    default: {
      const keys = Object.keys(s).filter(k => k !== 'error').slice(0, 6)
      for (const k of keys) add(formatKey(k), get(k))
    }
  }

  return findings
}

function formatKey(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim().replace(/^./, c => c.toUpperCase())
}
