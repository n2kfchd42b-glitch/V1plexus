"use client"

import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart2, CheckCircle2, ChevronRight, Clock, X, Database, Table2, Play,
} from 'lucide-react'
import { AssumptionStatusBar } from './AssumptionStatusBar'
import { ReasoningPrompt } from './ReasoningPrompt'
import Link from 'next/link'
import type {
  AssumptionCheck,
  AssumptionCheckResult,
  PostAnalysisAssumptionIssue,
  PostAnalysisReport,
  ResearchContext,
  StudyDesign,
  AssumptionOverallStatus,
  SensitivityScenario,
  RobustnessBounds,
} from '@/types/analysisIntegrity'
import { ANALYSIS_TYPES } from './AnalysisTypePicker'
import { ProjectDatasetSelector } from './ProjectDatasetSelector'
import { AnalysisEntryPoint } from './AnalysisEntryPoint'
import { profileFromDatasetColumns } from '@/lib/decision-engine/variableProfiler'
import { ANALYSIS_TYPE_MAPPING, buildBackendConfig, buildExecutableWorkflow, getRecommendation } from '@/lib/decision-engine/index'
import { checkFeasibility, canRun as engineCanRun } from '@/lib/decision-engine/feasibilityChecker'
import { ANALYSIS_REGISTRY } from '@/lib/decision-engine/analysisRegistry'
import type { DatasetContext, AnalysisTypeId, EngineColumnSchema, AnalysisConfig, ResearchIntent, AnalysisRecommendation } from '@/lib/decision-engine/types'
import type { ExecutableWorkflowStep } from '@/lib/decision-engine/index'
import { createClient } from '@/lib/supabase/client'
import { loadVersionData } from '@/lib/data/storage'
import { runAnalysis } from '@/lib/analysis/engine'
import {
  getProjectAnalysisRuns,
  createAnalysisRun,
  softDeleteAnalysisRun,
  getProjectMeta,
} from '@/lib/data'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'
import { formatRelative } from '@/lib/utils'
import { logAudit } from '@/lib/audit'
import type { AnalysisRun, AnalysisType, DatasetColumn } from '@/types/database'
import type { DataRow, AnalysisResult } from '@/lib/analysis/types'

// Heavy components and engines — lazy-loaded to split the initial bundle
import dynamic from 'next/dynamic'

const HubTableGeneratorModal  = dynamic(() => import('./HubTableGeneratorModal').then(m => ({ default: m.HubTableGeneratorModal })))
const ResearchDesignModal     = dynamic(() => import('./ResearchDesignModal').then(m => ({ default: m.ResearchDesignModal })))
const AssumptionReportModal   = dynamic(() => import('./AssumptionReportModal').then(m => ({ default: m.AssumptionReportModal })))
const GuidedFlow              = dynamic(() => import('./GuidedFlow').then(m => ({ default: m.GuidedFlow })))
const DirectFlow              = dynamic(() => import('./DirectFlow').then(m => ({ default: m.DirectFlow })))
const DecisionVariableSelector     = dynamic(() => import('./DecisionVariableSelector').then(m => ({ default: m.DecisionVariableSelector })))
const MultiDecisionVariableSelector = dynamic(() => import('./MultiDecisionVariableSelector').then(m => ({ default: m.MultiDecisionVariableSelector })))
const HubResultsPreview       = dynamic(() => import('./HubResultsPreview').then(m => ({ default: m.HubResultsPreview })))
const AnalysisCharts          = dynamic(() => import('./results/AnalysisCharts').then(m => ({ default: m.AnalysisCharts })))

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
  const [promptDismissed, setPromptDismissed] = useState(false)

  // Modals
  const [hubTableModalOpen, setHubTableModalOpen] = useState(false)

  // Research design context — collected once per dataset load via ResearchDesignModal
  const [researchContext, setResearchContext] = useState<ResearchContext | null>(null)
  const [showDesignModal, setShowDesignModal] = useState(false)

  // Post-analysis assumption report (non-blocking, appears after results)
  const [assumptionReport, setAssumptionReport] = useState<PostAnalysisReport | null>(null)
  const [assumptionChecking, setAssumptionChecking] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)

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
    setResult(null); setSavedRunId(null); setApprovalBlock(null); setPromptDismissed(false)
    setResearchContext(null); setShowDesignModal(false)
    setAssumptionReport(null); setAssumptionChecking(false); setShowReportModal(false)
    resetEngineVars()
    setDecisionMode(null)
  }

  // Config panel collapse — kept for assumption modal path
  const [configCollapsed, setConfigCollapsed] = useState(false)

  // Decision engine mode
  type DecisionMode = 'entry' | 'guided' | 'direct' | null
  const [decisionMode, setDecisionMode] = useState<DecisionMode>(null)
  const [decisionPreselect, setDecisionPreselect] = useState<AnalysisTypeId | null>(null)

  // ── Engine variable state (lifted from GuidedFlow / DirectFlow) ──────────────
  const [engineIntent, setEngineIntent] = useState<ResearchIntent | null>(null)
  const [engineSelectedType, setEngineSelectedType] = useState<AnalysisTypeId | null>(null)
  const [engineOutcome, setEngineOutcome] = useState<EngineColumnSchema | null>(null)
  const [engineExposure, setEngineExposure] = useState<EngineColumnSchema | null>(null)
  const [engineCovariates, setEngineCovariates] = useState<EngineColumnSchema[]>([])
  const [engineTimeVar, setEngineTimeVar] = useState<EngineColumnSchema | null>(null)
  const [engineEventVar, setEngineEventVar] = useState<EngineColumnSchema | null>(null)
  const [engineGroupVar, setEngineGroupVar] = useState<EngineColumnSchema | null>(null)
  const [engineStratVar, setEngineStratVar] = useState<EngineColumnSchema | null>(null)
  const [engineConfidenceLevel, setEngineConfidenceLevel] = useState<0.90 | 0.95 | 0.99>(0.95)
  const [engineDescriptiveVars, setEngineDescriptiveVars] = useState<string[]>([])

  // Lifted recommendation state (from GuidedFlow)
  const [engineRecommendation, setEngineRecommendation] = useState<AnalysisRecommendation | null>(null)


  // Stale result state — result exists but user is reconfiguring
  const [resultIsStale, setResultIsStale] = useState(false)
  const [lastDecisionMode, setLastDecisionMode] = useState<'guided' | 'direct' | null>(null)

  const resetEngineVars = () => {
    setEngineIntent(null)
    setEngineSelectedType(null)
    setEngineOutcome(null)
    setEngineExposure(null)
    setEngineCovariates([])
    setEngineTimeVar(null)
    setEngineEventVar(null)
    setEngineGroupVar(null)
    setEngineStratVar(null)
    setEngineDescriptiveVars([])
    setEngineRecommendation(null)
  }

  // ── Post-analysis assumption report (rich, non-blocking) ───────────────────
  const firePostAnalysisCheck = useCallback(async (
    analysisType: AnalysisType,
    analysisConfig: Record<string, unknown>,
    analysisResult?: AnalysisResult | null,
  ) => {
    if (!datasetId || !versionId) return
    setAssumptionReport(null)
    setAssumptionChecking(true)
    try {
      // Build analysis_result payload from the result summary
      const summary = (analysisResult?.summary ?? {}) as Record<string, unknown>
      const toNum = (v: unknown): number | null => (typeof v === 'number' ? v : null)
      const analysisResultPayload: EffectPayload = {
        odds_ratio:   toNum(summary.odds_ratio),
        hazard_ratio: toNum(summary.hazard_ratio),
        coefficient:  toNum(summary.coefficient),
        correlation:  toNum(summary.correlation),
        estimate:     toNum(summary.estimate),
        ci_lower:     toNum(summary.ci_lower),
        ci_upper:     toNum(summary.ci_upper),
        p_value:      toNum(summary.p_value),
        n:            toNum(summary.n),
      }

      const body: Record<string, unknown> = {
        dataset_id: datasetId,
        version_id: versionId,
        project_id: projectId,
        analysis_type: analysisType,
        analysis_config: analysisConfig,
        analysis_result: analysisResultPayload,
        study_design: researchContext?.study_design ?? null,
        research_question: researchContext?.research_question ?? null,
        outcome_variable: researchContext?.outcome_variable ?? null,
        exposure_variable: researchContext?.exposure_variable ?? null,
      }

      const res = await fetch('/api/analysis/assumption-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      // Treat any non-200 or unavailable response as needing the fallback
      const reportData = res.ok ? await res.json().catch(() => ({ unavailable: true })) : { unavailable: true }

      if (!reportData.unavailable) {
        // Full report from Python backend — map checks → all_checks
        setAssumptionReport({ ...reportData, all_checks: reportData.checks ?? [] } as PostAnalysisReport)
      } else {
        // Fall back to basic checks (also works when ANALYTICS_API_URL is not set)
        const fallbackRes = await fetch('/api/analysis/assumption-checks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (fallbackRes.ok) {
          const checkResult = await fallbackRes.json() as AssumptionCheckResult
          setAssumptionReport(checkResultToReport(
            checkResult,
            analysisType,
            analysisResultPayload,
            researchContext?.study_design ?? null,
            researchContext?.research_question ?? null,
            researchContext?.outcome_variable ?? null,
            researchContext?.exposure_variable ?? null,
            analysisResultPayload.n,
          ))
        }
      }
    } catch {
      // Non-blocking — assumption check failure must never surface as an error
    } finally {
      setAssumptionChecking(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasetId, versionId, projectId, researchContext])

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
    getProjectAnalysisRuns(supabase, projectId)
      .then(result => {
        setRuns(result.data as AnalysisRun[])
        setLoading(false)
      })
  }, [projectId, supabase])

  useEffect(() => {
    getProjectMeta(supabase, projectId)
      .then(result => { if (result.data) setProject(result.data as ProjectMeta) })
  }, [projectId, supabase])

  // ── Engine functions (unchanged) ────────────────────────

  const handleDelete = async (id: string) => {
    const result = await softDeleteAnalysisRun(supabase, id)
    if (result.status === 'error') { toast.error('Failed to delete analysis'); return }
    setRuns(prev => prev.filter(r => r.id !== id))
    if (viewingRunId === id) setViewingRunId(null)
    await logAudit('analysis.run.deleted', 'analysis_run', id, {}, projectId)
    toast.success('Analysis deleted')
  }

  const handleData = async (rows: DataRow[], cols: DatasetColumn[], name: string, dsId?: string, vsId?: string) => {
    setData(rows); setColumns(cols); setFileName(name)
    setDatasetId(dsId); setVersionId(vsId); setResult(null); setSavedRunId(null); setPromptDismissed(false)
    setApprovalBlock(null)
    setResearchContext(null); setAssumptionReport(null); setAssumptionChecking(false); setShowReportModal(false)
    setShowDesignModal(true)
    resetEngineVars()
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
    setSelectedType(type); setConfig({}); setResult(null); setSavedRunId(null); setPromptDismissed(false)
  }

  // ── Non-blocking analysis runner — runs analysis then fires assumption check ─
  const gateOnAssumptionCheck = useCallback(async (
    analysisType: AnalysisType,
    analysisConfig: Record<string, unknown>,
    proceed: () => Promise<AnalysisResult | void>,
  ) => {
    setAssumptionReport(null)
    const analysisResult = await proceed()
    // Fire assumption check after analysis completes — never blocks results
    firePostAnalysisCheck(analysisType, analysisConfig, analysisResult ?? null)
  }, [firePostAnalysisCheck])

  // ── Decision engine run — called by GuidedFlow and DirectFlow ──────────────
  const runWithTypeAndConfig = async (
    backendType: string,
    backendConfig: Record<string, unknown>,
  ) => {
    console.log('[run] runWithTypeAndConfig called:', backendType)
    const t = backendType as AnalysisType
    setSelectedType(t)
    setConfig(backendConfig)
    setLastDecisionMode(decisionMode === 'guided' || decisionMode === 'direct' ? decisionMode : lastDecisionMode)
    setDecisionMode(null)
    setResultIsStale(false)
    setResult(null)
    setSavedRunId(null)
    setViewingRunId(null)
    setPromptDismissed(false)
    setConfigCollapsed(true)

    const doRun = async (): Promise<AnalysisResult | void> => {
      setRunning(true)
      try {
        const r = await runAnalysis(t, data, backendConfig)
        setResult(r)
        setResultTab('results')
        return r
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

    await gateOnAssumptionCheck(t, backendConfig, doRun)
  }

  // ── Sequential workflow runner — called from GuidedFlow ────────────────────
  const runWorkflowSequentially = async (steps: ExecutableWorkflowStep[]) => {
    const executableSteps = steps.filter(s => s.executable_config)
    if (executableSteps.length === 0) return

    setLastDecisionMode(decisionMode === 'guided' || decisionMode === 'direct' ? decisionMode : lastDecisionMode)
    setDecisionMode(null)
    setResultIsStale(false)
    setResult(null)
    setSavedRunId(null)
    setViewingRunId(null)
    setRunning(true)
    setWorkflowProgress({ total: executableSteps.length, current: 0, label: executableSteps[0].name })

    for (let i = 0; i < executableSteps.length; i++) {
      const step = executableSteps[i]
      const { backendType, config: rawConfig } = step.executable_config!
      // Inject user-selected descriptive variables for descriptive steps
      const stepConfig = backendType === 'descriptive' && engineDescriptiveVars.length > 0
        ? { ...rawConfig, variables: engineDescriptiveVars }
        : rawConfig

      setWorkflowProgress({ total: executableSteps.length, current: i, label: step.name })

      if (step.is_final) {
        // Set selectedType now so the assumption modal condition is satisfied
        setSelectedType(backendType as AnalysisType)
        setConfig(stepConfig)
        // Gate the primary analysis on assumption checks before executing
        await gateOnAssumptionCheck(backendType as AnalysisType, stepConfig, async (): Promise<AnalysisResult | void> => {
          setRunning(true)
          try {
            const analysisResult = await runAnalysis(backendType as AnalysisType, data, stepConfig)
            setSelectedType(backendType as AnalysisType)
            setConfig(stepConfig)
            setResult(analysisResult)
            setResultTab('results')
            setPromptDismissed(false)
            return analysisResult
          } catch {
            setResult({
              type: backendType as AnalysisType,
              summary: { error: 'Final analysis step failed. Check variable selections.' },
              tables: [], charts: [], interpretation: 'Analysis failed.',
            })
          } finally {
            setRunning(false)
            setWorkflowProgress(null)
          }
        })
        // gateOnAssumptionCheck handles setRunning/setWorkflowProgress inside the callback
        return
      }

      try {
        const analysisResult = await runAnalysis(backendType as AnalysisType, data, stepConfig)

        if (false) {
          // (dead branch — kept for structural symmetry; is_final handled above)
        } else {
          // Intermediate → auto-save to history silently
          if (profile && datasetId) {
            const runResult = await createAnalysisRun(supabase, {
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
            })
            const savedRun = runResult.data
            if (savedRun) {
              setRuns(prev => [savedRun as AnalysisRun, ...prev])
              await logAudit(
                'analysis.run.saved',
                'analysis_run',
                savedRun.id,
                {
                  summary: `Auto-saved intermediate step: ${step.name}`,
                  operation: {
                    step_name: step.name,
                    intermediate: true,
                    backend_type: backendType,
                    config: stepConfig,
                  },
                  analysis_type: backendType,
                  dataset_version_id: versionId ?? undefined,
                },
                projectId,
              )
            }
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        if (step.is_final) {
          setResult({
            type: backendType as AnalysisType,
            summary: { error: 'Final analysis step failed. Check variable selections.' },
            tables: [], charts: [], interpretation: 'Analysis failed.',
          })
        } else {
          toast.warning(`Step ${step.number} (${step.name}) failed and was skipped: ${msg}`)
        }
      }
    }

    setRunning(false)
    setWorkflowProgress(null)
  }

  // ── Alternative run — checks feasibility before executing ───────────────────
  const handleRunAlternative = (altId: AnalysisTypeId) => {
    const variables = {
      outcome: engineOutcome,
      exposure: engineExposure,
      covariates: engineCovariates,
      time_variable: engineTimeVar,
      event_variable: engineEventVar,
      group_variable: engineGroupVar,
      strat_variable: engineStratVar,
    }

    const feasibility = checkFeasibility(altId, variables, engineContext)
    if (!engineCanRun(feasibility)) {
      const failedChecks = feasibility.filter(c => c.status === 'fail')
      toast.error(
        `Cannot run ${altId.replace(/_/g, ' ')}: ${failedChecks.map(c => c.label).join(', ')} failed. Update variable selections and try again.`
      )
      return
    }

    const config: AnalysisConfig = {
      analysis_type: altId,
      dataset_id: engineContext.dataset_id,
      version_id: engineContext.version_id,
      outcome_variable: engineOutcome?.name ?? null,
      exposure_variable: engineExposure?.name ?? null,
      covariate_variables: engineCovariates.map(c => c.name),
      time_variable: engineTimeVar?.name ?? null,
      event_variable: engineEventVar?.name ?? null,
      group_variable: engineGroupVar?.name ?? null,
      strat_variable: engineStratVar?.name ?? null,
      confidence_level: engineConfidenceLevel,
      reference_category: 'first',
    }
    const backendType = ANALYSIS_TYPE_MAPPING[altId]
    const backendConfig = buildBackendConfig(config)
    runWithTypeAndConfig(backendType, backendConfig)
  }

  const handleEngineDirectRun = () => {
    console.log('[run] handleEngineDirectRun called, engineSelectedType:', engineSelectedType)
    if (!engineSelectedType) return
    const config: AnalysisConfig = {
      analysis_type: engineSelectedType,
      dataset_id: engineContext.dataset_id,
      version_id: engineContext.version_id,
      outcome_variable: engineOutcome?.name ?? null,
      exposure_variable: engineExposure?.name ?? null,
      // For descriptive_statistics: use engineDescriptiveVars as the variable list
      covariate_variables: engineIsDesc ? engineDescriptiveVars : engineCovariates.map(c => c.name),
      time_variable: engineTimeVar?.name ?? null,
      event_variable: engineEventVar?.name ?? null,
      group_variable: engineGroupVar?.name ?? null,
      strat_variable: engineStratVar?.name ?? null,
      confidence_level: engineConfidenceLevel,
      reference_category: 'first',
    }
    const backendType = ANALYSIS_TYPE_MAPPING[engineSelectedType]
    const backendConfig = buildBackendConfig(config)
    runWithTypeAndConfig(backendType, backendConfig)
  }

  const handleRun = async () => {
    console.log('[run] handleRun called, selectedType:', selectedType)
    if (!selectedType) return
    if (approvalBlock) return
    setAssumptionReport(null)
    await gateOnAssumptionCheck(selectedType, config, async (): Promise<AnalysisResult | void> => {
      setRunning(true); setResult(null); setSavedRunId(null); setViewingRunId(null); setPromptDismissed(false)
      setConfigCollapsed(true)
      try {
        const r = await runAnalysis(selectedType, data, config)
        setResult(r); setResultTab('results')
        return r
      } catch (err) {
        setResult({ type: selectedType, summary: { error: err instanceof Error ? err.message : 'Analysis failed' }, tables: [], charts: [], interpretation: 'Analysis failed.' })
      } finally {
        setRunning(false)
      }
    })
  }

  const handleSave = async (reasoning?: string) => {
    if (!result || !profile || !selectedType) return
    if (approvalBlock) return
    const typeInfo = ANALYSIS_TYPES.find(t => t.type === selectedType)
    const trimmedReasoning = reasoning?.trim() || null
    const runResult = await createAnalysisRun(supabase, {
      project_id: projectId, dataset_id: datasetId ?? null, version_id: versionId ?? null,
      analysis_type: selectedType,
      title: `${typeInfo?.label ?? selectedType} — ${new Date().toLocaleDateString()}`,
      config, results: result as unknown as Record<string, unknown>,
      interpretation: result.interpretation, status: 'completed', created_by: profile.id,
      user_reasoning: trimmedReasoning,
    })
    const run = runResult.data
    if (run) {
      await logAudit(
        'analysis.run.saved',
        'analysis_run',
        run.id,
        {
          summary: `Saved analysis: ${run.title}`,
          analysis_type: selectedType,
          dataset_version_id: versionId ?? undefined,
          user_reasoning: trimmedReasoning,
          operation: {
            type: selectedType,
            title: run.title,
            dataset_id: datasetId ?? null,
            variables: {
              outcome: (config as Record<string, unknown>).outcome_variable ?? null,
              exposure: (config as Record<string, unknown>).exposure_variable ?? null,
              covariates: (config as Record<string, unknown>).covariate_variables ?? null,
              time: (config as Record<string, unknown>).time_variable ?? null,
              event: (config as Record<string, unknown>).event_variable ?? null,
              group: (config as Record<string, unknown>).group_variable ?? null,
              strat: (config as Record<string, unknown>).strat_variable ?? null,
            },
            config,
            user_reasoning: trimmedReasoning,
          },
        },
        projectId,
      )

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

  // ── Decision engine derived ──────────────────────────────
  const engineSchema = useMemo(
    () => dataLoaded ? profileFromDatasetColumns(columns, data.length) : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dataLoaded, columns.length, data.length],
  )
  const engineContext = useMemo<DatasetContext>(() => ({
    dataset_id: datasetId ?? '',
    version_id: versionId ?? '',
    dataset_name: fileName,
    row_count: data.length,
    complete_cases: data.length,
    schema: engineSchema,
  }), [datasetId, versionId, fileName, data.length, engineSchema])

  const engineExcluded = [engineOutcome, engineExposure, ...engineCovariates, engineTimeVar, engineEventVar, engineGroupVar, engineStratVar]
    .filter(Boolean).map(v => v!.name)

  const engineMeta        = engineSelectedType ? ANALYSIS_REGISTRY[engineSelectedType] : null
  const engineIsSurvival  = engineSelectedType === 'kaplan_meier' || engineSelectedType === 'cox_ph'
  const engineIsCorr      = engineSelectedType === 'pearson_correlation' || engineSelectedType === 'spearman_correlation'
  const engineIsCat       = engineSelectedType === 'chi_square' || engineSelectedType === 'fisher_exact'
  const engineIsDesc      = engineSelectedType === 'descriptive_statistics'

  const canEngineDirectRun = (() => {
    if (!engineSelectedType) return false
    if (engineIsDesc) return true
    if (engineSelectedType === 'prevalence_estimation') return !!engineOutcome
    if (engineIsSurvival) return !!engineTimeVar && !!engineEventVar
    if (engineIsCorr || engineIsCat) return !!engineOutcome && !!engineExposure
    if (engineMeta?.requires_grouping) return !!engineOutcome && !!(engineExposure ?? engineGroupVar)
    return !!engineOutcome
  })()

  const canEngineGuidedAnalyse = !!engineIntent && (
    engineIntent === 'describe' ? true :
    engineIntent === 'survive'
      // KM needs time + event; Cox needs time + event + at least one predictor
      ? (!!engineTimeVar && !!engineEventVar) :
    !!engineOutcome
  )


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
          className="relative flex-shrink-0 border-r border-[var(--border-row)] flex flex-col overflow-hidden transition-all duration-200"
          style={{ background: 'var(--bg-surface)', width: decisionMode ? '300px' : '260px' }}
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
                        <div
                          key={run.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => { setViewingRunId(run.id); setHistoryOpen(false) }}
                          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { setViewingRunId(run.id); setHistoryOpen(false) } }}
                          className={`group w-full text-left flex items-center gap-2.5 px-4 py-3 border-b border-[var(--border-row)] last:border-0 transition-colors cursor-pointer ${
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
                        </div>
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
                <div
                  className="flex items-center gap-2.5 px-2.5 py-2.5 rounded-md"
                  style={{ border: '1px solid var(--accent-blue)', borderLeft: '3px solid var(--accent-blue)', background: 'var(--accent-blue-subtle)' }}
                >
                  <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(59,130,246,0.15)' }}>
                    <Database className="h-3 w-3" style={{ color: 'var(--accent-blue)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{fileName}</p>
                    <p className="data-mono-xs" style={{ color: 'var(--text-tertiary)' }}>{data.length.toLocaleString()} rows · {columns.length} cols</p>
                  </div>
                  <button
                    onClick={clearDataset}
                    className="flex items-center gap-1 text-[11px] font-medium flex-shrink-0 px-1.5 py-1 rounded transition-colors"
                    style={{ color: 'var(--text-tertiary)' }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-row-hover)' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.background = '' }}
                  >
                    <X className="h-3 w-3" />Change
                  </button>
                </div>
              ) : datasetsLoading ? (
                <div className="space-y-1.5">{[1, 2, 3].map(i => <div key={i} className="skeleton h-10 rounded-md" />)}</div>
              ) : projectDatasets.length === 0 ? (
                <div className="flex flex-col items-center text-center px-3 py-4 rounded-md" style={{ border: '1px dashed var(--border-strong)' }}>
                  <Database className="h-5 w-5 mb-1.5" style={{ color: 'var(--text-tertiary)' }} />
                  <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>No datasets yet</p>
                  <Link href={`/projects/${projectId}/data`} className="text-[11px] mt-1 hover:underline" style={{ color: 'var(--accent-blue)' }}>Go to Data Hub →</Link>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <p className="text-[11px] mb-1" style={{ color: 'var(--text-tertiary)' }}>Click a dataset to load it for analysis</p>
                  {projectDatasets.map(ds => {
                    const isLoading = datasetLoadingId === ds.id
                    const v = ds.latestVersion
                    return (
                      <button key={ds.id} onClick={() => selectDataset(ds)} disabled={!!datasetLoadingId}
                        className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left transition-colors disabled:opacity-60"
                        style={{ border: '1px solid var(--border-default)', background: 'var(--bg-app)' }}
                        onMouseEnter={e => { if (!datasetLoadingId) e.currentTarget.style.background = 'var(--bg-row-hover)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-app)' }}
                      >
                        <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0" style={{ background: 'var(--bg-inset)' }}>
                          <Database className="h-3 w-3" style={{ color: 'var(--text-tertiary)' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{ds.name}</p>
                          {v
                            ? <p className="data-mono-xs" style={{ color: 'var(--text-tertiary)' }}>{v.row_count?.toLocaleString() ?? '—'} rows · {v.column_count ?? '—'} cols</p>
                            : <p className="text-[11px] italic" style={{ color: 'var(--text-tertiary)' }}>No version</p>}
                        </div>
                        {isLoading && <div className="h-3.5 w-3.5 rounded-full border-2 border-t-transparent flex-shrink-0 animate-spin" style={{ borderColor: 'var(--accent-blue)', borderTopColor: 'transparent' }} />}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* ── Breadcrumb stepper ── */}
            {dataLoaded && (
              <div className="flex items-center gap-1 -mt-1">
                {([
                  { key: 'dataset',  label: 'Dataset',    done: true,              active: !decisionMode && !result },
                  { key: 'mode',     label: 'Mode',       done: !!decisionMode || !!result, active: decisionMode === 'entry' },
                  { key: 'vars',     label: 'Variables',  done: (decisionMode === 'guided' || decisionMode === 'direct') || !!result, active: decisionMode === 'guided' || decisionMode === 'direct' },
                  { key: 'result',   label: 'Result',     done: !!result && !resultIsStale, active: !!result && !decisionMode },
                ] as { key: string; label: string; done: boolean; active: boolean }[]).map((step, idx) => (
                  <div key={step.key} className="flex items-center">
                    <div
                      className="flex items-center gap-1"
                      style={{ opacity: step.done || step.active ? 1 : 0.35 }}
                    >
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0 transition-colors"
                        style={{
                          background: step.done && !step.active
                            ? 'var(--status-success)'
                            : step.active
                              ? 'var(--accent-blue)'
                              : 'var(--border-strong)',
                        }}
                      />
                      <span
                        className="text-[10px] font-medium"
                        style={{ color: step.active ? 'var(--accent-blue)' : step.done ? 'var(--text-secondary)' : 'var(--text-tertiary)' }}
                      >
                        {step.label}
                      </span>
                    </div>
                    {idx < 3 && (
                      <span className="mx-1 text-[10px]" style={{ color: 'var(--text-tertiary)' }}>›</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Run Analysis button — when loaded, no decision mode, no result */}
            {dataLoaded && !decisionMode && !result && (
              <button
                onClick={() => setDecisionMode('entry')}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold text-white active:scale-[0.98] transition-all"
                style={{ background: 'linear-gradient(135deg,var(--color-clinical-deep),var(--color-clinical-blue))' }}
              >
                <Play className="h-3.5 w-3.5" />
                Run Analysis
              </button>
            )}

            {/* Adjust / New Analysis — when result exists and not in decision mode */}
            {dataLoaded && !decisionMode && result && !running && (
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setResultIsStale(true)
                    setAssumptionReport(null); setAssumptionChecking(false)
                    setDecisionMode(lastDecisionMode ?? 'entry')
                  }}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors"
                  style={{ border: '1px solid var(--border-default)', color: 'var(--text-secondary)', background: 'var(--bg-surface)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-row-hover)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-surface)' }}
                >
                  Adjust
                </button>
                <button
                  onClick={() => {
                    resetEngineVars()
                    setResult(null)
                    setSavedRunId(null)
                    setResultIsStale(false)
                    setAssumptionReport(null); setAssumptionChecking(false)
                    setDecisionMode('entry')
                  }}
                  className="flex-1 py-2 rounded-lg text-xs font-bold text-white active:scale-[0.98] transition-all"
                  style={{ background: 'linear-gradient(135deg,var(--color-clinical-deep),var(--color-clinical-blue))' }}
                >
                  New Analysis
                </button>
              </div>
            )}

            {/* ── Variable configuration panel ────────────── */}
            {(decisionMode === 'guided' || decisionMode === 'direct') && dataLoaded && engineSchema.length > 0 && (
              <div>
                <div className="h-px mb-4" style={{ background: 'var(--border-row)' }} />
                <p className="subsection-label mb-3">Variables</p>

                {/* ── DIRECT FLOW ── */}
                {decisionMode === 'direct' && (
                  !engineSelectedType ? (
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
                      Choose an analysis type on the right to configure variables.
                    </p>
                  ) : engineIsDesc ? (
                    /* Multi-variable select for descriptive statistics */
                    <div className="space-y-2">
                      <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                        Leave all unchecked to describe every variable
                      </p>
                      <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-default)' }}>
                        <div className="max-h-52 overflow-y-auto">
                          {engineSchema.filter(c => c.type !== 'id' && c.type !== 'text').map(col => {
                            const checked = engineDescriptiveVars.includes(col.name)
                            const TYPE_BG: Record<string, string> = {
                              continuous: 'var(--accent-blue-subtle)', binary: 'var(--status-success-bg)',
                              categorical: 'var(--bg-inset)', date: 'var(--status-warning-bg)', time_to_event: 'var(--status-error-bg)',
                            }
                            const TYPE_TX: Record<string, string> = {
                              continuous: 'var(--accent-blue-hover)', binary: 'var(--status-success-text)',
                              categorical: 'var(--phase-data)', date: 'var(--status-warning-text)', time_to_event: 'var(--status-error-hover)',
                            }
                            return (
                              <label key={col.name}
                                className="flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors border-b last:border-0"
                                style={{ borderColor: 'var(--border-row)', background: checked ? 'var(--accent-blue-subtle)' : undefined }}
                                onMouseEnter={e => { if (!checked) (e.currentTarget as HTMLElement).style.background = 'var(--bg-row-hover)' }}
                                onMouseLeave={e => { if (!checked) (e.currentTarget as HTMLElement).style.background = '' }}
                              >
                                <input type="checkbox" checked={checked}
                                  onChange={e => setEngineDescriptiveVars(prev =>
                                    e.target.checked ? [...prev, col.name] : prev.filter(n => n !== col.name)
                                  )}
                                  className="rounded flex-shrink-0 accent-[var(--accent-blue)]"
                                />
                                <span className="text-xs font-medium truncate flex-1" style={{ color: 'var(--text-primary)' }}>{col.name}</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0"
                                  style={{ background: TYPE_BG[col.type] ?? 'var(--bg-inset)', color: TYPE_TX[col.type] ?? 'var(--text-tertiary)' }}>
                                  {col.type}
                                </span>
                              </label>
                            )
                          })}
                        </div>
                      </div>
                      {engineDescriptiveVars.length > 0 && (
                        <button onClick={() => setEngineDescriptiveVars([])} className="text-[11px] transition-colors"
                          style={{ color: 'var(--text-tertiary)' }}
                          onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-blue)' }}
                          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-tertiary)' }}
                        >
                          Clear ({engineDescriptiveVars.length} selected)
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {engineIsSurvival ? (
                        <>
                          <DecisionVariableSelector label="Time Variable" required schema={engineSchema} allowedTypes={['continuous', 'date']} value={engineTimeVar} onChange={setEngineTimeVar} row_count={data.length} excludeNames={engineExcluded.filter(n => n !== engineTimeVar?.name)} />
                          <DecisionVariableSelector label="Event Indicator (1=event, 0=censored)" required schema={engineSchema} allowedTypes={['binary', 'continuous']} value={engineEventVar} onChange={setEngineEventVar} row_count={data.length} excludeNames={engineExcluded.filter(n => n !== engineEventVar?.name)} />
                          {engineSelectedType === 'kaplan_meier' && (
                            <DecisionVariableSelector label="Group Variable (optional)" schema={engineSchema} allowedTypes={['binary', 'categorical']} value={engineExposure} onChange={setEngineExposure} placeholder="Leave empty for single curve" row_count={data.length} excludeNames={engineExcluded.filter(n => n !== engineExposure?.name)} />
                          )}
                          {engineSelectedType === 'cox_ph' && (
                            <DecisionVariableSelector label="Exposure / Primary Predictor" schema={engineSchema} allowedTypes={['binary', 'categorical', 'continuous']} value={engineExposure} onChange={setEngineExposure} row_count={data.length} excludeNames={engineExcluded.filter(n => n !== engineExposure?.name)} />
                          )}
                          <DecisionVariableSelector label="Stratify by (optional)" schema={engineSchema} allowedTypes={['binary', 'categorical']} value={engineStratVar} onChange={setEngineStratVar} placeholder="Adjust for a known confounder" row_count={data.length} excludeNames={engineExcluded.filter(n => n !== engineStratVar?.name)} />
                        </>
                      ) : (engineIsCorr || engineIsCat) ? (
                        <>
                          <DecisionVariableSelector label={engineIsCat ? 'Variable 1 (Outcome)' : 'Variable 1'} required schema={engineSchema} allowedTypes={engineMeta && engineMeta.outcome_types.length > 0 ? engineMeta.outcome_types : undefined} value={engineOutcome} onChange={setEngineOutcome} row_count={data.length} excludeNames={engineExcluded.filter(n => n !== engineOutcome?.name)} />
                          <DecisionVariableSelector label={engineIsCat ? 'Variable 2 (Exposure)' : 'Variable 2'} required schema={engineSchema} allowedTypes={engineMeta && engineMeta.predictor_types.length > 0 ? engineMeta.predictor_types : undefined} value={engineExposure} onChange={setEngineExposure} row_count={data.length} excludeNames={engineExcluded.filter(n => n !== engineExposure?.name)} />
                        </>
                      ) : (
                        <>
                          {engineSelectedType !== 'prevalence_estimation' && (
                            <DecisionVariableSelector label="Outcome Variable" required schema={engineSchema} allowedTypes={engineMeta && engineMeta.outcome_types.length > 0 ? engineMeta.outcome_types : undefined} value={engineOutcome} onChange={setEngineOutcome} row_count={data.length} excludeNames={engineExcluded.filter(n => n !== engineOutcome?.name)} />
                          )}
                          <DecisionVariableSelector
                            label={engineMeta?.requires_grouping ? 'Group Variable' : 'Exposure / Predictor'}
                            required={!!engineMeta?.requires_grouping}
                            schema={engineSchema}
                            allowedTypes={engineMeta && engineMeta.predictor_types.length > 0 ? engineMeta.predictor_types : undefined}
                            value={engineExposure} onChange={setEngineExposure} row_count={data.length}
                            excludeNames={engineExcluded.filter(n => n !== engineExposure?.name)}
                          />
                          {/* Covariates — regression types + cox_ph */}
                          {(['logistic_regression', 'linear_regression', 'poisson_regression', 'cox_ph'] as AnalysisTypeId[]).includes(engineSelectedType) && (
                            <MultiDecisionVariableSelector
                              label="Covariates (optional)"
                              schema={engineSchema}
                              value={engineCovariates}
                              onChange={setEngineCovariates}
                              row_count={data.length}
                              excludeNames={engineExcluded.filter(n => !engineCovariates.some(c => c.name === n))}
                            />
                          )}
                        </>
                      )}
                      {/* Confidence level */}
                      {!engineIsCat && (
                        <div>
                          <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Confidence Level</p>
                          <div className="flex gap-1.5">
                            {([0.90, 0.95, 0.99] as const).map(lvl => (
                              <button key={lvl} type="button" onClick={() => setEngineConfidenceLevel(lvl)}
                                className="flex-1 py-1.5 rounded-md text-xs font-semibold transition-colors"
                                style={{
                                  background: engineConfidenceLevel === lvl ? 'var(--accent-blue)' : 'var(--bg-surface)',
                                  color: engineConfidenceLevel === lvl ? '#fff' : 'var(--text-secondary)',
                                  border: `1px solid ${engineConfidenceLevel === lvl ? 'var(--accent-blue)' : 'var(--border-default)'}`,
                                }}
                              >{Math.round(lvl * 100)}%</button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                )}

                {/* ── GUIDED FLOW ── */}
                {decisionMode === 'guided' && (
                  !engineIntent ? (
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
                      Choose your research question on the right to configure variables.
                    </p>
                  ) : engineIntent === 'describe' ? (
                    /* Multi-variable select for describe intent */
                    <div className="space-y-2">
                      <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>Leave all unchecked to describe every variable</p>
                      <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-default)' }}>
                        <div className="max-h-52 overflow-y-auto">
                          {engineSchema.filter(c => c.type !== 'id' && c.type !== 'text').map(col => {
                            const checked = engineDescriptiveVars.includes(col.name)
                            const TYPE_BG: Record<string, string> = {
                              continuous: 'var(--accent-blue-subtle)', binary: 'var(--status-success-bg)',
                              categorical: 'var(--bg-inset)', date: 'var(--status-warning-bg)', time_to_event: 'var(--status-error-bg)',
                            }
                            const TYPE_TX: Record<string, string> = {
                              continuous: 'var(--accent-blue-hover)', binary: 'var(--status-success-text)',
                              categorical: 'var(--phase-data)', date: 'var(--status-warning-text)', time_to_event: 'var(--status-error-hover)',
                            }
                            return (
                              <label key={col.name}
                                className="flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors border-b last:border-0"
                                style={{ borderColor: 'var(--border-row)', background: checked ? 'var(--accent-blue-subtle)' : undefined }}
                                onMouseEnter={e => { if (!checked) (e.currentTarget as HTMLElement).style.background = 'var(--bg-row-hover)' }}
                                onMouseLeave={e => { if (!checked) (e.currentTarget as HTMLElement).style.background = '' }}
                              >
                                <input type="checkbox" checked={checked}
                                  onChange={e => setEngineDescriptiveVars(prev =>
                                    e.target.checked ? [...prev, col.name] : prev.filter(n => n !== col.name)
                                  )}
                                  className="rounded flex-shrink-0 accent-[var(--accent-blue)]"
                                />
                                <span className="text-xs font-medium truncate flex-1" style={{ color: 'var(--text-primary)' }}>{col.name}</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0"
                                  style={{ background: TYPE_BG[col.type] ?? 'var(--bg-inset)', color: TYPE_TX[col.type] ?? 'var(--text-tertiary)' }}>
                                  {col.type}
                                </span>
                              </label>
                            )
                          })}
                        </div>
                      </div>
                      {engineDescriptiveVars.length > 0 && (
                        <button onClick={() => setEngineDescriptiveVars([])} className="text-[11px] transition-colors" style={{ color: 'var(--text-tertiary)' }}
                          onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-blue)' }}
                          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-tertiary)' }}
                        >Clear ({engineDescriptiveVars.length} selected)</button>
                      )}
                    </div>
                  ) : engineIntent === 'survive' ? (
                    <div className="space-y-3">
                      <DecisionVariableSelector label="Time Variable" required schema={engineSchema} allowedTypes={['continuous', 'date']} value={engineTimeVar} onChange={setEngineTimeVar} row_count={data.length} excludeNames={engineExcluded.filter(n => n !== engineTimeVar?.name)} />
                      <DecisionVariableSelector label="Event Indicator (1=event, 0=censored)" required schema={engineSchema} allowedTypes={['binary', 'continuous']} value={engineEventVar} onChange={setEngineEventVar} row_count={data.length} excludeNames={engineExcluded.filter(n => n !== engineEventVar?.name)} />
                      <DecisionVariableSelector label="Group Variable (optional)" schema={engineSchema} allowedTypes={['binary', 'categorical']} value={engineExposure} onChange={setEngineExposure} placeholder="Leave empty for single curve" row_count={data.length} excludeNames={engineExcluded.filter(n => n !== engineExposure?.name)} />
                      <DecisionVariableSelector label="Stratify by (optional)" schema={engineSchema} allowedTypes={['binary', 'categorical']} value={engineStratVar} onChange={setEngineStratVar} placeholder="Adjust for a known confounder" row_count={data.length} excludeNames={engineExcluded.filter(n => n !== engineStratVar?.name)} />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <DecisionVariableSelector label="Outcome Variable" required schema={engineSchema} value={engineOutcome} onChange={setEngineOutcome} row_count={data.length} excludeNames={engineExcluded.filter(n => n !== engineOutcome?.name)} />
                      <DecisionVariableSelector
                        label={engineIntent === 'compare' ? 'Group Variable' : 'Exposure / Predictor'}
                        schema={engineSchema} value={engineExposure} onChange={setEngineExposure} row_count={data.length}
                        excludeNames={engineExcluded.filter(n => n !== engineExposure?.name)}
                      />
                      {(engineIntent === 'predict' || engineIntent === 'associate') && (
                        <MultiDecisionVariableSelector
                          label="Covariates (optional)"
                          schema={engineSchema}
                          value={engineCovariates}
                          onChange={setEngineCovariates}
                          row_count={data.length}
                          excludeNames={engineExcluded.filter(n => !engineCovariates.some(c => c.name === n))}
                        />
                      )}
                    </div>
                  )
                )}
              </div>
            )}

          </div>


        </div>

        {/* ── RIGHT: Results / Engine panel ─────────────── */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

          {/* ── Decision engine — takes over right panel ── */}
          {decisionMode !== null && dataLoaded && (
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
                  intent={engineIntent}
                  onIntentChange={setEngineIntent}
                  outcome={engineOutcome}
                  exposure={engineExposure}
                  covariates={engineCovariates}
                  timeVar={engineTimeVar}
                  eventVar={engineEventVar}
                  groupVar={engineGroupVar}
                  stratVar={engineStratVar}
                  confidenceLevel={engineConfidenceLevel}
                  canAnalyse={canEngineGuidedAnalyse}
                  recommendation={engineRecommendation}
                  onRecommendation={setEngineRecommendation}
                  onRunWorkflow={runWorkflowSequentially}
                  onRunAlternative={handleRunAlternative}
                  onSwitchToDirect={preselected => {
                    if (preselected) setEngineSelectedType(preselected)
                    setDecisionPreselect(preselected ?? null)
                    setDecisionMode('direct')
                  }}
                  onBack={() => setDecisionMode('entry')}
                />
              )}
              {decisionMode === 'direct' && (
                <DirectFlow
                  dataset={engineContext}
                  selectedType={engineSelectedType}
                  onSelectType={type => { setEngineSelectedType(type) }}
                  canRun={canEngineDirectRun}
                  onRun={handleEngineDirectRun}
                  onSwitchToGuided={() => setDecisionMode('guided')}
                  onBack={() => setDecisionMode('entry')}
                />
              )}
            </div>
          )}

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
            <div className="flex flex-col h-full" style={{ opacity: resultIsStale ? 0.55 : 1, transition: 'opacity 0.2s' }}>
              {/* Stale banner */}
              {resultIsStale && (
                <div
                  className="flex items-center justify-between px-4 py-2 flex-shrink-0 text-xs"
                  style={{ background: 'var(--status-warning-bg)', borderBottom: '1px solid var(--border-status-warning)', color: 'var(--status-warning-text)' }}
                >
                  <span>Previous result — reconfigure in the left panel and run again.</span>
                </div>
              )}
              {/* Result header */}
              <div className="px-5 pt-4 pb-0 flex-shrink-0" style={{ background: 'var(--bg-surface)' }}>
                {/* Title row */}
                <div className="flex items-start gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold leading-snug" style={{ color: 'var(--text-primary)' }}>
                      {ANALYSIS_TYPES.find(t => t.type === selectedType)?.label ?? 'Results'}
                      {fileName ? ` — ${fileName}` : ''}
                    </p>
                    <p className="data-mono-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                      {data.length > 0 ? `${data.length.toLocaleString()} observations` : ''}
                      {result && ' · Completed just now'}
                      {savedRunId && ' · Saved to ledger'}
                    </p>
                  </div>
                </div>

                {/* Reasoning prompt — shown inline after a fresh run, gated by reason to commit */}
                <AnimatePresence>
                  {!savedRunId && !promptDismissed && !resultIsStale && (
                    <ReasoningPrompt
                      onSaveNote={async (text) => {
                        await handleSave(text)
                        setPromptDismissed(true)
                      }}
                      onDismiss={() => setPromptDismissed(true)}
                    />
                  )}
                </AnimatePresence>
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

              {/* Post-analysis assumption status bar */}
              <AssumptionStatusBar
                report={assumptionReport}
                checking={assumptionChecking}
                onOpen={() => setShowReportModal(true)}
              />

              {/* Tab content */}
              <div className="flex-1 overflow-y-auto">
                {resultTab === 'results' ? (
                  <div className="px-6 py-5 space-y-5">
                    {/* Charts — hero */}
                    {(result.charts ?? []).length > 0 && (
                      <AnalysisCharts
                        charts={result.charts as never}
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
                              {table.rows.map((row, j) => {
                                // A continuation row in the categorical table has an empty string in col 0
                                const isContinuation = table.id === 'categorical_summary' && row[0] === ''
                                return (
                                <tr key={j} className={`border-b border-[var(--border-row)] last:border-0 transition-colors ${isContinuation ? '' : 'hover:bg-[var(--bg-row-hover)]'}`}
                                  style={isContinuation ? { background: 'var(--bg-app)' } : undefined}
                                >
                                  {row.map((cell, k) => (
                                    <td key={k} className={`px-3 py-2 whitespace-nowrap font-mono ${isContinuation && k === 0 ? '' : 'text-[var(--text-primary)]'} ${isContinuation && k === 1 ? 'text-[var(--text-secondary)]' : ''}`}>
                                      {cell === null ? <span className="text-[var(--text-tertiary)]">—</span> : cell === '' ? '' : String(cell)}
                                    </td>
                                  ))}
                                </tr>
                                )
                              })}
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

      {showDesignModal && (
        <ResearchDesignModal
          isOpen={showDesignModal}
          columns={columns.map(c => c.name)}
          onConfirm={(ctx) => { setResearchContext(ctx); setShowDesignModal(false) }}
          onSkip={() => setShowDesignModal(false)}
        />
      )}

      {showReportModal && assumptionReport && (
        <AssumptionReportModal
          isOpen={showReportModal}
          report={assumptionReport}
          onClose={() => setShowReportModal(false)}
        />
      )}
    </div>
  )
}

// ── Assumption check result → summary converter ─────────────────────────────

const ASSUMPTION_FRIENDLY_TITLES: Record<string, string> = {
  'No multicollinearity':               'Predictor Correlation',
  'Adequate sample size':               'Sample Size Adequacy',
  'Adequate outcome distribution':      'Outcome Balance',
  'Normality of residuals':             'Residual Distribution',
  'Homoscedasticity':                   'Error Variance Stability',
  'No highly influential observations': 'Influential Data Points',
  'Minimum expected cell frequency':    'Cell Frequency Check',
  'Independence of observations':       'Independent Observations',
  'Normality within groups':            'Group Normality',
  'Homogeneity of variances':           'Equal Group Variances',
  'Adequate event count':               'Event Count',
  'Non-informative censoring':          'Censoring Mechanism',
  'Proportional hazards':               'Hazard Ratio Stability',
  'Missing data mechanism':             'Missing Data Pattern',
  'Reverse causation':                  'Temporal Ordering',
  'Informative censoring':              'Loss-to-Follow-Up Pattern',
  'Selection bias':                     'Sample Representativeness',
  'Recall bias':                        'Exposure Recall Accuracy',
  'Publication bias':                   'Publication Bias',
  'Randomisation integrity':            'Randomisation Balance',
  'Exposure group balance':             'Exposure Group Balance',
}

const ANALYSIS_METHOD_LABELS: Record<string, string> = {
  logistic_regression:    'binary logistic regression',
  linear_regression:      'multiple linear regression',
  simple_regression:      'simple linear regression',
  multiple_regression:    'multiple linear regression',
  multinomial_logistic:   'multinomial logistic regression',
  cox_ph:                 'Cox proportional hazards regression',
  kaplan_meier:           'Kaplan–Meier survival analysis',
  anova:                  'one-way ANOVA',
  chi_square:             'chi-square test of independence',
  t_test:                 'independent samples t-test',
  correlation:            'Pearson correlation analysis',
  poisson_regression:     'Poisson regression',
  descriptive:            'descriptive statistical analysis',
}

const DESIGN_LABELS: Record<string, string> = {
  cross_sectional: 'cross-sectional',
  cohort: 'cohort',
  case_control: 'case-control',
  rct: 'randomised controlled trial',
  time_series: 'longitudinal',
  meta_analysis: 'meta-analytic',
  other: 'observational',
}

const DESIGN_LIMITATIONS: Record<string, string> = {
  cross_sectional: 'The cross-sectional design precludes causal inference; temporal ordering between exposure and outcome cannot be established from these data.',
  cohort: 'As an observational cohort study, residual confounding from unmeasured variables may influence estimates despite covariate adjustment.',
  case_control: 'Differential recall of past exposures between cases and controls (recall bias) and potential non-representativeness of the control group may influence effect estimates.',
  rct: 'Generalisability of findings may be limited by trial eligibility criteria and the characteristics of the enrolled population.',
  time_series: 'Secular trends and unmeasured time-varying confounders may introduce bias in longitudinal analyses.',
  meta_analysis: 'Publication bias may overrepresent statistically significant findings; between-study heterogeneity in design and population may limit precision of pooled estimates.',
}

// ── Sensitivity analysis (deterministic, no AI) ─────────────────────────────

interface EffectPayload {
  odds_ratio: number | null
  hazard_ratio: number | null
  coefficient: number | null
  correlation: number | null
  estimate: number | null
  ci_lower: number | null
  ci_upper: number | null
  p_value: number | null
  n: number | null
}

function eValueFromOR(or: number): number {
  const r = or > 1 ? or : 1 / or
  return r + Math.sqrt(r * (r - 1))
}

function buildSensitivity(
  analysisType: string,
  effect: EffectPayload,
): { e_value: number | null; sensitivity_scenarios: SensitivityScenario[]; robustness: RobustnessBounds | null; metric_label: string } {
  const none = { e_value: null, sensitivity_scenarios: [], robustness: null, metric_label: '' }

  // Logistic regression — OR-based unmeasured-confounding sensitivity
  const or = effect.odds_ratio
  if ((analysisType === 'logistic_regression' || analysisType === 'multinomial_logistic') && or != null && or > 0) {
    const lo = effect.ci_lower ?? or * 0.75
    const hi = effect.ci_upper ?? or * 1.33
    const e_value = or === 1 ? 1 : Math.round(eValueFromOR(or) * 100) / 100

    // γ = confounder association strength; adjusted OR = observed OR / γ
    const gammas = [1.0, 1.5, 2.0, 3.0, 5.0]
    const labels = [
      'Observed — no unmeasured confounding',
      'Weak confounder (γ\u2009=\u20091.5)',
      'Moderate confounder (γ\u2009=\u20092.0)',
      'Strong confounder (γ\u2009=\u20093.0)',
      'Very strong confounder (γ\u2009=\u20095.0)',
    ]
    const scenarios: SensitivityScenario[] = gammas.map((g, i) => {
      const adj = round3(or / g)
      const adjLo = round3(lo / g)
      const adjHi = round3(hi / g)
      const interpretation =
        adjLo > 1 ? 'OR remains significant (lower CI > 1)' :
        adjHi < 1 ? 'Direction reversed under this level of confounding' :
        'Effect no longer significant — confounding of this magnitude could explain the result'
      return { delta: g - 1, label: labels[i], estimate: adj, ci_lower: adjLo, ci_upper: adjHi, interpretation }
    })

    const bpScenario = scenarios.find(s => s.ci_lower <= 1 && s.ci_upper >= 1)
    const stableCount = scenarios.filter(s => s.ci_lower > 1 || s.ci_upper < 1).length
    return {
      e_value,
      metric_label: 'OR',
      sensitivity_scenarios: scenarios,
      robustness: {
        estimate_range: [scenarios[scenarios.length - 1].estimate, scenarios[0].estimate],
        breaking_point_delta: bpScenario?.delta ?? null,
        stability_pct: Math.round((stableCount / scenarios.length) * 100),
      },
    }
  }

  // Survival (Cox PH / Kaplan-Meier) — HR-based
  const hr = effect.hazard_ratio
  if ((analysisType === 'cox_ph' || analysisType === 'kaplan_meier') && hr != null && hr > 0) {
    const lo = effect.ci_lower ?? hr * 0.75
    const hi = effect.ci_upper ?? hr * 1.33
    const e_value = hr === 1 ? 1 : Math.round(eValueFromOR(hr) * 100) / 100

    const gammas = [1.0, 1.5, 2.0, 3.0, 5.0]
    const labels = [
      'Observed — no unmeasured confounding',
      'Weak confounder (γ\u2009=\u20091.5)',
      'Moderate confounder (γ\u2009=\u20092.0)',
      'Strong confounder (γ\u2009=\u20093.0)',
      'Very strong confounder (γ\u2009=\u20095.0)',
    ]
    const scenarios: SensitivityScenario[] = gammas.map((g, i) => {
      const adj = round3(hr / g)
      const adjLo = round3(lo / g)
      const adjHi = round3(hi / g)
      const interpretation =
        adjLo > 1 ? 'HR remains significant (lower CI > 1)' :
        adjHi < 1 ? 'Direction reversed under this level of confounding' :
        'Effect no longer significant — confounding of this magnitude could explain the result'
      return { delta: g - 1, label: labels[i], estimate: adj, ci_lower: adjLo, ci_upper: adjHi, interpretation }
    })

    const bpScenario = scenarios.find(s => s.ci_lower <= 1 && s.ci_upper >= 1)
    const stableCount = scenarios.filter(s => s.ci_lower > 1 || s.ci_upper < 1).length
    return {
      e_value,
      metric_label: 'HR',
      sensitivity_scenarios: scenarios,
      robustness: {
        estimate_range: [scenarios[scenarios.length - 1].estimate, scenarios[0].estimate],
        breaking_point_delta: bpScenario?.delta ?? null,
        stability_pct: Math.round((stableCount / scenarios.length) * 100),
      },
    }
  }

  // Linear regression — omitted-variable bias (OVB) sensitivity
  const coeff = effect.coefficient
  if (analysisType === 'linear_regression' && coeff != null) {
    const lo = effect.ci_lower ?? coeff - Math.abs(coeff) * 0.4
    const hi = effect.ci_upper ?? coeff + Math.abs(coeff) * 0.4

    // delta = fraction of residual variance attributable to omitted variable
    const deltas = [0, 0.10, 0.20, 0.35, 0.50]
    const labels = [
      'Observed — no omitted variable',
      '10% additional R² (weak OVB)',
      '20% additional R² (moderate OVB)',
      '35% additional R² (strong OVB)',
      '50% additional R² (severe OVB)',
    ]
    const crossesZero = (a: number, b: number) => a <= 0 && b >= 0
    const scenarios: SensitivityScenario[] = deltas.map((d, i) => {
      const adj  = round4(coeff  * (1 - d))
      const adjLo = round4(lo    * (1 - d))
      const adjHi = round4(hi    * (1 - d))
      const interpretation =
        crossesZero(adjLo, adjHi) ? 'Effect no longer significant — an omitted variable of this size could explain the result' :
        (coeff > 0 ? adj > 0 : adj < 0) ? 'Coefficient direction preserved and significant' :
        'Direction reversed under this degree of confounding'
      return { delta: d, label: labels[i], estimate: adj, ci_lower: adjLo, ci_upper: adjHi, interpretation }
    })

    const bpScenario = scenarios.find(s => crossesZero(s.ci_lower, s.ci_upper))
    const stableCount = scenarios.filter(s => !crossesZero(s.ci_lower, s.ci_upper)).length
    return {
      e_value: null,
      metric_label: 'β',
      sensitivity_scenarios: scenarios,
      robustness: {
        estimate_range: [scenarios[scenarios.length - 1].estimate, scenarios[0].estimate],
        breaking_point_delta: bpScenario?.delta ?? null,
        stability_pct: Math.round((stableCount / scenarios.length) * 100),
      },
    }
  }

  return none
}

function round3(x: number) { return Math.round(x * 1000) / 1000 }
function round4(x: number) { return Math.round(x * 10000) / 10000 }

function buildMethodsText(
  analysisType: string,
  studyDesign: StudyDesign | null,
  checks: AssumptionCheck[],
  n: number | null,
  outcomeVar: string | null,
  exposureVar: string | null,
): string {
  const method = ANALYSIS_METHOD_LABELS[analysisType] ?? (analysisType ? analysisType.replace(/_/g, ' ') : 'the selected analysis')
  const design = studyDesign ? DESIGN_LABELS[studyDesign] : null
  const nText = n && n > 0 ? ` (n\u2009=\u2009${n.toLocaleString()})` : ''
  const outcomeText = outcomeVar ? ` of ${outcomeVar}` : ''
  const exposureText = exposureVar ? `, with ${exposureVar} as the primary predictor` : ''

  const active = checks.filter(c => c.status !== 'not_applicable')
  const checkSentences = active.map(c => {
    const testPart = c.test_used ? ` (${c.test_used}` : ''
    const statPart = c.statistic != null ? `, stat\u2009=\u2009${c.statistic.toFixed(3)}` : ''
    const pPart = c.p_value != null ? `, p\u2009${c.p_value < 0.001 ? '<\u20090.001' : '=\u2009' + c.p_value.toFixed(3)}` : ''
    const closePart = testPart ? ')' : ''
    const outcome = c.status === 'passed' ? 'satisfied' : c.status === 'warning' ? 'borderline' : 'violated'
    return `${c.assumption_name}${testPart}${statPart}${pPart}${closePart}: ${outcome}`
  })

  const violations = checks.filter(c => c.status === 'violated')
  const correctionText = violations.length > 0
    ? ` Violations were detected for ${violations.map(v => v.assumption_name.toLowerCase()).join(' and ')}; recommended corrective measures are noted against each finding.`
    : ' All verifiable assumptions were satisfied.'

  const intro = design
    ? `A ${design} study${nText} was analysed.`
    : `Analysis was conducted${nText}.`

  return `${intro} ${method.charAt(0).toUpperCase() + method.slice(1)} was used to estimate the association${outcomeText}${exposureText}. Prior to inference, all relevant statistical assumptions were formally assessed: ${checkSentences.join('; ')}.${correctionText}`
}

function buildLimitations(
  checks: AssumptionCheck[],
  studyDesign: StudyDesign | null,
): string[] {
  const lims: string[] = []
  if (studyDesign && DESIGN_LIMITATIONS[studyDesign]) lims.push(DESIGN_LIMITATIONS[studyDesign])
  for (const v of checks.filter(c => c.status === 'violated' && c.severity !== 'minor').slice(0, 3)) {
    if (v.implication) lims.push(v.implication)
  }
  return lims
}

function buildReviewerQuestions(
  checks: AssumptionCheck[],
  studyDesign: StudyDesign | null,
): { question: string; answer: string }[] {
  const qs: { question: string; answer: string }[] = []
  for (const v of checks.filter(c => c.status === 'violated' && (c.severity === 'critical' || c.severity === 'moderate')).slice(0, 3)) {
    const alts = v.alternative_tests?.length ? ` Alternative approaches considered: ${v.alternative_tests.join(', ')}.` : ''
    qs.push({
      question: `How was the ${v.assumption_name.toLowerCase()} violation addressed?`,
      answer: v.suggested_action
        ? `${v.suggested_action}${alts} Finding: ${v.finding}.`
        : `The violation (${v.finding}) was documented and acknowledged.${alts}`,
    })
  }
  const designQA: Record<string, { question: string; answer: string }> = {
    cross_sectional: {
      question: 'Can causal inferences be drawn from this cross-sectional analysis?',
      answer: 'No. Cross-sectional data establish association, not causation. Temporal ordering of exposure and outcome cannot be determined. Findings should be interpreted as associational and hypothesis-generating.',
    },
    rct: {
      question: 'Was randomisation successful in balancing baseline characteristics?',
      answer: 'Baseline characteristics by trial arm are reported in Table 1. Residual imbalances were addressed through covariate adjustment in the primary analysis model.',
    },
    cohort: {
      question: 'How was residual confounding addressed?',
      answer: 'Potential confounders identified a priori were included as model covariates. Residual confounding from unmeasured variables remains an inherent limitation of observational designs.',
    },
    case_control: {
      question: 'Are controls representative of the source population?',
      answer: 'Controls were selected to represent the population from which cases arose. The selection rationale is described in the Methods section.',
    },
  }
  if (studyDesign && designQA[studyDesign]) qs.push(designQA[studyDesign])
  return qs.slice(0, 5)
}

function buildDesignGuidance(
  checks: AssumptionCheck[],
): { item: string; status: 'done' | 'consider' | 'not_applicable'; note: string }[] {
  return checks
    .filter(c => c.status !== 'not_applicable')
    .map(c => ({
      item: c.assumption_name,
      status: (c.status === 'passed' ? 'done' : c.status === 'warning' ? 'consider' : 'done') as 'done' | 'consider' | 'not_applicable',
      note: c.finding.slice(0, 120),
    }))
}

function checkResultToReport(
  result: AssumptionCheckResult,
  analysisTypeOverride: string,
  effect: EffectPayload,
  studyDesign: StudyDesign | null,
  researchQuestion: string | null,
  outcomeVariable: string | null = null,
  exposureVariable: string | null = null,
  n: number | null = null,
): PostAnalysisReport {
  const critical = result.critical_violations
  const moderate = result.moderate_violations

  let overall_status: AssumptionOverallStatus
  if (critical > 0) {
    overall_status = 'high_risk'
  } else if (moderate > 0) {
    overall_status = 'needs_review'
  } else {
    overall_status = 'stable'
  }

  const priorityOrder: Record<string, number> = { critical: 0, moderate: 1, minor: 2 }
  const top_issues: PostAnalysisAssumptionIssue[] = (result.checks ?? [])
    .filter(c => c.status !== 'passed')
    .sort((a, b) => (priorityOrder[a.severity] ?? 99) - (priorityOrder[b.severity] ?? 99))
    .slice(0, 6)
    .map(c => ({
      title: ASSUMPTION_FRIENDLY_TITLES[c.assumption_name] ?? c.assumption_name,
      one_liner: c.implication || c.finding,
      severity: c.severity,
      status: c.status,
      finding: c.finding,
      suggested_action: c.suggested_action,
      alternative_tests: c.alternative_tests ?? [],
      assumption_name: c.assumption_name,
    }))

  const allChecks = result.checks ?? []
  const effectiveType = result.analysis_type ?? analysisTypeOverride
  const sens = buildSensitivity(effectiveType, effect)

  return {
    overall_status,
    analysis_type: effectiveType,
    metric_label: sens.metric_label,
    study_design: studyDesign,
    research_question: researchQuestion,
    outcome_variable: outcomeVariable,
    exposure_variable: exposureVariable,
    top_issues,
    all_checks: allChecks,
    all_passed: result.all_passed,
    critical_violations: critical,
    moderate_violations: moderate,
    minor_violations: result.minor_violations,
    not_applicable_count: result.not_applicable_count,
    e_value: sens.e_value,
    sensitivity_scenarios: sens.sensitivity_scenarios,
    robustness: sens.robustness,
    methods_text: allChecks.length > 0
      ? buildMethodsText(effectiveType, studyDesign, allChecks, n, outcomeVariable, exposureVariable)
      : '',
    limitations: buildLimitations(allChecks, studyDesign),
    reviewer_questions: buildReviewerQuestions(allChecks, studyDesign),
    design_guidance: buildDesignGuidance(allChecks),
  }
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
      add('N', get('n'))
      const nv = get('numericVars'); const cv = get('catVars')
      if (nv !== null) add('Numeric Vars', nv)
      if (cv !== null) add('Cat Vars', cv)
      const nt = tables.find(t => t.id === 'numeric_summary')
      if (nt && nt.rows.length > 0) {
        const r = nt.rows[0]
        if (r[3] !== null) add('Mean', String(r[3]))
        if (r[4] !== null) add('SD', String(r[4]))
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
      add('N', get('n')); add('Categories', get('categories')); add('Reference', get('reference'))
      break
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
