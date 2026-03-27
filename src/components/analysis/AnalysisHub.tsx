"use client"

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Plus, BarChart2, CheckCircle2, Clock, AlertCircle,
  Search, LayoutGrid, List, Activity, X, ChevronRight,
  Database, ArrowLeft,
} from 'lucide-react'
import { AnalysisRunCard } from './AnalysisRunCard'
import { AnalysisTypePicker, ANALYSIS_TYPES } from './AnalysisTypePicker'
import { ProjectDatasetSelector } from './ProjectDatasetSelector'
import { AISuggestions } from './AISuggestions'
import { createClient } from '@/lib/supabase/client'
import { runAnalysis } from '@/lib/analysis/engine'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'
import type { AnalysisRun, AnalysisType, DatasetColumn } from '@/types/database'
import type { DataRow, AnalysisResult } from '@/lib/analysis/engine'

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

interface Props {
  projectId: string
}

type ViewMode = 'grid' | 'list'
type FilterStatus = 'all' | 'completed' | 'running' | 'failed'
type DrawerStep = 'dataset' | 'type' | 'config'

interface ProjectMeta {
  title: string
  description: string | null
  methodology: string | null
  research_objectives: string | null
}

// ── Config dispatcher ───────────────────────────────────
function ConfigComponent({ type, config, onChange, onRun, loading, columns }: {
  type: AnalysisType
  config: Record<string, unknown>
  onChange: (c: Record<string, unknown>) => void
  onRun: () => void
  loading: boolean
  columns: DatasetColumn[]
}) {
  const props = { config, onChange, onRun, loading, columns }
  switch (type) {
    case 'descriptive':              return <DescriptiveConfig {...props} />
    case 'frequency':                return <FrequencyConfig {...props} />
    case 'chi_square':               return <ChiSquareConfig {...props} />
    case 't_test':                   return <TTestConfig {...props} />
    case 'anova':                    return <AnovaConfig {...props} />
    case 'correlation':              return <CorrelationConfig {...props} />
    case 'simple_regression':        return <SimpleRegressionConfig {...props} />
    case 'multiple_regression':      return <MultipleRegressionConfig {...props} />
    case 'logistic_regression':      return <LogisticRegressionConfig {...props} />
    case 'multinomial_regression':   return <MultinomialConfig {...props} />
    case 'ordinal_regression':       return <OrdinalConfig {...props} />
    case 'poisson_regression':
    case 'negbinomial_regression':   return <PoissonConfig {...props} analysisType={type} />
    case 'kaplan_meier':             return <KaplanMeierConfig {...props} />
    case 'cox_regression':           return <CoxConfig {...props} />
    case 'time_series':              return <TimeSeriesConfig {...props} />
    case 'pca':                      return <PCAConfig {...props} />
    case 'factor_analysis':          return <FactorAnalysisConfig {...props} />
    case 'cluster_analysis':         return <ClusterConfig {...props} />
    case 'meta_analysis':            return <MetaAnalysisConfig {...props} />
    case 'spatial_analysis':         return <SpatialConfig {...props} />
    case 'outbreak_investigation':   return <OutbreakConfig {...props} />
    case 'sample_size':              return <SampleSizeConfig {...props} />
    default:
      return <p className="text-sm text-[#A1A1AA]">No configuration available for this analysis type.</p>
  }
}

// ── Main Component ──────────────────────────────────────
export function AnalysisHub({ projectId }: Props) {
  const router = useRouter()
  const { profile } = useAuth()
  const supabase = useMemo(() => createClient(), [])

  // Hub state
  const [runs, setRuns] = useState<AnalysisRun[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [project, setProject] = useState<ProjectMeta | null>(null)

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerStep, setDrawerStep] = useState<DrawerStep>('dataset')

  // Analysis wizard state (lives inside drawer)
  const [data, setData] = useState<DataRow[]>([])
  const [columns, setColumns] = useState<DatasetColumn[]>([])
  const [fileName, setFileName] = useState('')
  const [datasetId, setDatasetId] = useState<string | undefined>()
  const [versionId, setVersionId] = useState<string | undefined>()
  const [selectedType, setSelectedType] = useState<AnalysisType | null>(null)
  const [config, setConfig] = useState<Record<string, unknown>>({})
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [savedRunId, setSavedRunId] = useState<string | null>(null)

  // Fetch runs
  useEffect(() => {
    const fetchRuns = async () => {
      const { data } = await supabase
        .from('analysis_runs')
        .select('*, dataset:datasets(id, name)')
        .eq('project_id', projectId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(50)
      if (data) setRuns(data as AnalysisRun[])
      setLoading(false)
    }
    fetchRuns()
  }, [projectId, supabase])

  // Fetch project for AI suggestions
  useEffect(() => {
    const fetchProject = async () => {
      const { data } = await supabase
        .from('projects')
        .select('title, description, methodology, research_objectives')
        .eq('id', projectId)
        .maybeSingle()
      if (data) setProject(data as ProjectMeta)
    }
    fetchProject()
  }, [projectId, supabase])

  const openDrawer = () => {
    setDrawerOpen(true)
    setDrawerStep(data.length > 0 ? 'type' : 'dataset')
    setResult(null)
    setSavedRunId(null)
    setSelectedType(null)
    setConfig({})
  }

  const closeDrawer = () => setDrawerOpen(false)

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('analysis_runs')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
    if (error) { toast.error('Failed to delete analysis'); return }
    setRuns(prev => prev.filter(r => r.id !== id))
    toast.success('Analysis deleted')
  }

  const handleData = (rows: DataRow[], cols: DatasetColumn[], name: string, dsId?: string, vsId?: string) => {
    setData(rows); setColumns(cols); setFileName(name)
    setDatasetId(dsId); setVersionId(vsId); setResult(null)
  }

  const handleTypeSelect = (type: AnalysisType) => {
    setSelectedType(type); setConfig({}); setResult(null)
    setDrawerStep('config')
  }

  const handleRun = async () => {
    if (!selectedType) return
    setRunning(true); setResult(null)
    try {
      const analysisResult = await runAnalysis(selectedType, data, config)
      setResult(analysisResult)
    } catch (err) {
      setResult({
        type: selectedType,
        summary: { error: err instanceof Error ? err.message : 'Analysis failed' },
        tables: [], charts: [], interpretation: 'Analysis failed.',
      })
    } finally {
      setRunning(false)
    }
  }

  const handleSave = async () => {
    if (!result || !profile || !selectedType) return
    const typeInfo = ANALYSIS_TYPES.find(t => t.type === selectedType)
    const { data: run } = await supabase
      .from('analysis_runs')
      .insert({
        project_id:    projectId,
        dataset_id:    datasetId ?? null,
        version_id:    versionId ?? null,
        analysis_type: selectedType,
        title: `${typeInfo?.label ?? selectedType} — ${new Date().toLocaleDateString()}`,
        config,
        results: result as unknown as Record<string, unknown>,
        interpretation: result.interpretation,
        status: 'completed',
        created_by: profile.id,
      })
      .select()
      .single()
    if (run) {
      setSavedRunId(run.id)
      closeDrawer()
      router.push(`/projects/${projectId}/analysis/${run.id}`)
    }
  }

  const stats = useMemo(() => {
    const completed = runs.filter(r => r.status === 'completed').length
    const active    = runs.filter(r => r.status === 'running' || r.status === 'pending').length
    const failed    = runs.filter(r => r.status === 'failed').length
    return { total: runs.length, completed, active, failed }
  }, [runs])

  const filteredRuns = useMemo(() => {
    let result = runs
    if (filterStatus !== 'all') {
      result = result.filter(r =>
        filterStatus === 'running'
          ? r.status === 'running' || r.status === 'pending'
          : r.status === filterStatus
      )
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(r =>
        (r.title ?? '').toLowerCase().includes(q) ||
        r.analysis_type.toLowerCase().includes(q) ||
        (r.dataset as { name: string } | null)?.name?.toLowerCase().includes(q)
      )
    }
    return result
  }, [runs, filterStatus, searchQuery])

  const typeInfo    = selectedType ? ANALYSIS_TYPES.find(t => t.type === selectedType) : null
  const needsData   = selectedType !== 'sample_size'
  const dataLoaded  = data.length > 0
  const columnsForAI = columns.map(c => ({
    name: c.name, type: c.type, unique_values: c.unique_values, missing: c.missing,
  }))

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
      <div className="min-h-screen bg-[#f7f9fb]">
        <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="col-span-2 h-44 rounded-2xl bg-white animate-pulse" style={{ boxShadow: '0 20px 50px rgba(0,24,72,0.04)' }} />
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-44 rounded-2xl bg-white animate-pulse" style={{ boxShadow: '0 20px 50px rgba(0,24,72,0.04)' }} />
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-44 rounded-2xl bg-white animate-pulse" style={{ boxShadow: '0 20px 50px rgba(0,24,72,0.04)' }} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f7f9fb]">
      {/* ── Page header ────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-6 pt-8 pb-6">
        <Link href={`/projects/${projectId}`}>
          <button className="flex items-center gap-1.5 text-[#A1A1AA] hover:text-[#18181B] transition-colors mb-5 text-xs font-medium">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Project
          </button>
        </Link>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#0040a2] font-manrope block mb-2">
              Analysis Engine
            </span>
            <h1 className="font-manrope font-extrabold text-[2.25rem] leading-tight tracking-tight text-[#18181B]">
              Analysis <span className="text-[#0052cc]">Hub</span>
            </h1>
            <p className="text-sm text-[#52525B] mt-1.5 max-w-lg">
              Run guided statistical analyses on your research data with AI-powered interpretations.
            </p>
          </div>
          <button
            onClick={openDrawer}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #003d9b, #0052cc)', boxShadow: '0 4px 20px rgba(0,82,204,0.28)' }}
          >
            <Plus className="h-4 w-4" />
            New Analysis
          </button>
        </div>
      </div>

      {/* ── Main content ───────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-6 pb-12">

        {/* ── Bento Stats Grid ─────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">

          {/* Hero: Total */}
          <div
            className="col-span-2 relative overflow-hidden rounded-2xl p-7 flex flex-col justify-between min-h-[168px] cursor-default"
            style={{ background: 'linear-gradient(135deg, #001a5c 0%, #003d9b 55%, #0052cc 100%)' }}
          >
            <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full opacity-[0.08]"
              style={{ background: 'radial-gradient(circle, #fff, transparent)' }} />
            <div className="absolute right-12 -bottom-4 w-28 h-28 rounded-full opacity-[0.05]"
              style={{ background: 'radial-gradient(circle, #fff, transparent)' }} />
            <div className="relative">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40 font-manrope mb-3">
                Total Analyses
              </p>
              <p className="font-manrope font-extrabold text-[3.25rem] leading-none tracking-tight text-white">
                {stats.total}
              </p>
              <p className="text-white/50 text-sm font-medium mt-1.5">
                {stats.total === 1 ? 'run recorded' : 'runs recorded'}
              </p>
            </div>
            <button
              onClick={openDrawer}
              className="relative self-start flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-[0.06em] transition-all hover:scale-[1.04] active:scale-[0.97]"
              style={{ background: 'rgba(255,255,255,0.13)', color: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              <Plus className="h-3 w-3" />
              New Analysis
            </button>
          </div>

          {/* Completed */}
          <div
            className="rounded-2xl p-6 flex flex-col justify-between bg-white"
            style={{ boxShadow: '0 20px 50px rgba(0,24,72,0.04), 0 4px 12px rgba(0,24,72,0.03)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#A1A1AA] font-manrope">Completed</p>
              <div className="w-7 h-7 rounded-xl bg-[#F0FDF4] flex items-center justify-center">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#22C55E]" />
              </div>
            </div>
            <div>
              <p className="font-manrope font-extrabold text-[2rem] leading-none tracking-tight text-[#166534]">
                {stats.completed}
              </p>
              {stats.total > 0 && (
                <p className="text-[10px] text-[#A1A1AA] mt-1.5 font-medium">
                  {Math.round((stats.completed / stats.total) * 100)}% success rate
                </p>
              )}
            </div>
          </div>

          {/* Running + Failed stacked */}
          <div className="flex flex-col gap-3">
            <div
              className="rounded-2xl px-5 py-4 flex items-center justify-between bg-white flex-1"
              style={{ boxShadow: '0 20px 50px rgba(0,24,72,0.04), 0 4px 12px rgba(0,24,72,0.03)' }}
            >
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#A1A1AA] font-manrope">Active</p>
                <p className="font-manrope font-extrabold text-xl leading-none tracking-tight text-[#1E40AF] mt-1">{stats.active}</p>
              </div>
              <div className="w-7 h-7 rounded-xl bg-[#EFF6FF] flex items-center justify-center">
                <Activity className="h-3.5 w-3.5 text-[#3B82F6]" />
              </div>
            </div>
            <div
              className="rounded-2xl px-5 py-4 flex items-center justify-between bg-white flex-1"
              style={{ boxShadow: '0 20px 50px rgba(0,24,72,0.04), 0 4px 12px rgba(0,24,72,0.03)' }}
            >
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#A1A1AA] font-manrope">Failed</p>
                <p className="font-manrope font-extrabold text-xl leading-none tracking-tight text-[#991B1B] mt-1">{stats.failed}</p>
              </div>
              <div className="w-7 h-7 rounded-xl bg-[#FEF2F2] flex items-center justify-center">
                <AlertCircle className="h-3.5 w-3.5 text-[#EF4444]" />
              </div>
            </div>
          </div>
        </div>

        {/* ── Runs Section ─────────────────────────────── */}
        {runs.length === 0 ? (
          <EmptyState onNew={openDrawer} />
        ) : (
          <>
            {/* Section header */}
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-2.5">
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#0040a2] font-manrope">All Analyses</span>
                <span className="w-1 h-1 bg-[#c3c6d6] rounded-full inline-block" />
                <span className="text-xs text-[#A1A1AA]">{runs.length} {runs.length === 1 ? 'run' : 'runs'}</span>
              </div>
            </div>

            {/* Filter bar */}
            <div className="flex items-center justify-between gap-4 mb-5">
              <div className="flex items-center gap-3 flex-1">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#A1A1AA]" />
                  <input
                    type="text"
                    placeholder="Search analyses..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-sm rounded-lg bg-[#f2f4f6] border border-[rgba(195,198,214,0.3)] text-[#18181B] placeholder:text-[#A1A1AA] outline-none focus:border-[rgba(0,82,204,0.4)] focus:shadow-[0_0_0_3px_rgba(0,82,204,0.08)] transition-all"
                  />
                </div>
                <div className="flex items-center gap-1 bg-[#f2f4f6] rounded-[10px] p-1">
                  {(['all', 'completed', 'running', 'failed'] as FilterStatus[]).map(s => (
                    <button
                      key={s}
                      onClick={() => setFilterStatus(s)}
                      className={`px-3 py-1.5 text-[11px] font-bold rounded-lg uppercase tracking-[0.06em] transition-all ${
                        filterStatus === s
                          ? 'bg-white text-[#003d9b] shadow-[0_2px_8px_rgba(0,24,72,0.08)]'
                          : 'text-[#52525B] hover:text-[#003d9b]'
                      }`}
                    >
                      {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1 bg-[#f2f4f6] rounded-[10px] p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-white text-[#003d9b] shadow-[0_2px_8px_rgba(0,24,72,0.08)]' : 'text-[#A1A1AA] hover:text-[#18181B]'}`}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-white text-[#003d9b] shadow-[0_2px_8px_rgba(0,24,72,0.08)]' : 'text-[#A1A1AA] hover:text-[#18181B]'}`}
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>

            {filteredRuns.length === 0 ? (
              <div className="text-center py-14">
                <Search className="h-8 w-8 mx-auto text-[#A1A1AA] mb-3" />
                <p className="text-sm text-[#52525B]">No analyses match your filters</p>
                <button
                  onClick={() => { setFilterStatus('all'); setSearchQuery('') }}
                  className="text-[#0052CC] text-xs mt-2 hover:underline"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className={viewMode === 'grid'
                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
                : 'space-y-2'
              }>
                {filteredRuns.map(run => (
                  <AnalysisRunCard
                    key={run.id}
                    run={run}
                    projectId={projectId}
                    onDelete={handleDelete}
                    viewMode={viewMode}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── New Analysis Drawer ─────────────────────────── */}
      {/* Backdrop */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px]"
          onClick={closeDrawer}
        />
      )}

      {/* Slide-over panel */}
      <div
        className={`fixed inset-y-0 right-0 z-50 flex flex-col w-full max-w-[620px] bg-white overflow-y-auto transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
          drawerOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ boxShadow: '-20px 0 80px rgba(0,24,72,0.14), -4px 0 20px rgba(0,24,72,0.07)' }}
      >
        {/* Drawer header */}
        <div className="flex-shrink-0 px-8 pt-7 pb-6 border-b border-[#f2f4f6]">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#0040a2] font-manrope">
              Analysis Engine
            </span>
            <button
              onClick={closeDrawer}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-[#A1A1AA] hover:bg-[#f2f4f6] hover:text-[#18181B] transition-all"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <h2 className="font-manrope font-extrabold text-[1.6rem] leading-tight tracking-tight text-[#18181B] mb-5">
            New <span className="text-[#0052cc]">Analysis</span>
          </h2>

          {/* Step pills */}
          <div className="flex items-center gap-1 bg-[#f2f4f6] rounded-[10px] p-1 w-fit">
            {DRAWER_STEPS.map((step, i) => {
              const isPast    = i < drawerStepIdx
              const isCurrent = drawerStep === step.id
              return (
                <button
                  key={step.id}
                  onClick={() => { if (isPast) setDrawerStep(step.id) }}
                  disabled={!isPast && !isCurrent}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-[0.06em] transition-all ${
                    isCurrent
                      ? 'bg-white text-[#003d9b] shadow-[0_2px_8px_rgba(0,24,72,0.08)]'
                      : isPast
                      ? 'text-[#166534] hover:text-[#003d9b] cursor-pointer'
                      : 'text-[#A1A1AA] cursor-default'
                  }`}
                >
                  <span className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-[8px] font-bold flex-shrink-0 ${
                    isCurrent ? 'bg-[#003d9b] text-white' : isPast ? 'bg-[#22C55E] text-white' : 'bg-[#e0e3e5] text-[#A1A1AA]'
                  }`}>
                    {isPast ? '✓' : i + 1}
                  </span>
                  {step.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Drawer body */}
        <div className="flex-1 px-8 py-7 space-y-6">

          {/* ─ Step 1: Dataset ─ */}
          {drawerStep === 'dataset' && (
            <>
              <p className="text-sm text-[#52525B] leading-relaxed">
                Select an existing dataset from this project or upload a new file. Your data is processed locally — nothing is re-uploaded.
              </p>
              <ProjectDatasetSelector
                projectId={projectId}
                onData={handleData}
                datasetId={datasetId}
                versionId={versionId}
                data={data}
                fileName={fileName}
              />
              <div className="flex items-center gap-4 pt-1">
                <button
                  disabled={!dataLoaded}
                  onClick={() => setDrawerStep('type')}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
                  style={{ background: 'linear-gradient(135deg, #003d9b, #0052cc)', boxShadow: dataLoaded ? '0 4px 16px rgba(0,82,204,0.28)' : 'none' }}
                >
                  Continue to Analysis
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setDrawerStep('type')}
                  className="text-sm text-[#A1A1AA] hover:text-[#18181B] transition-colors"
                >
                  Skip (sample size only)
                </button>
              </div>
            </>
          )}

          {/* ─ Step 2: Analysis type ─ */}
          {drawerStep === 'type' && (
            <>
              {/* Dataset status chip */}
              {dataLoaded ? (
                <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-[#f2f4f6]">
                  <div className="flex items-center gap-2">
                    <Database className="h-3.5 w-3.5 text-[#0052cc]" />
                    <span className="text-sm font-medium text-[#18181B]">{fileName}</span>
                    <span className="text-xs text-[#A1A1AA]">· {data.length.toLocaleString()} rows · {columns.length} cols</span>
                  </div>
                  <button onClick={() => setDrawerStep('dataset')} className="text-xs text-[#0052cc] hover:underline font-medium">
                    Change
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200">
                  <span className="text-xs text-amber-700">No dataset — only sample size calculator available without data</span>
                  <button onClick={() => setDrawerStep('dataset')} className="text-xs text-amber-700 font-bold underline ml-2">Add data</button>
                </div>
              )}

              {/* AI suggestions */}
              {project && (
                <AISuggestions
                  projectId={projectId}
                  projectTitle={project.title}
                  projectDescription={project.description}
                  methodology={project.methodology}
                  researchObjectives={project.research_objectives}
                  columns={dataLoaded ? columnsForAI : undefined}
                  onSelect={handleTypeSelect}
                  selectedType={selectedType}
                />
              )}

              <AnalysisTypePicker selected={selectedType} onSelect={handleTypeSelect} />
            </>
          )}

          {/* ─ Step 3: Configure & Run ─ */}
          {drawerStep === 'config' && selectedType && (
            <>
              {/* Breadcrumb */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDrawerStep('type')}
                  className="text-xs text-[#A1A1AA] hover:text-[#0052cc] transition-colors font-medium"
                >
                  ← Change analysis
                </button>
                <span className="text-[#e0e3e5]">|</span>
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#0040a2] font-manrope">
                  {typeInfo?.label}
                </span>
              </div>

              {/* Dataset (if needed) */}
              {needsData && !dataLoaded ? (
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#A1A1AA] font-manrope mb-2">Dataset Required</p>
                  <ProjectDatasetSelector
                    projectId={projectId}
                    onData={handleData}
                    datasetId={datasetId}
                    versionId={versionId}
                    data={data}
                    fileName={fileName}
                  />
                </div>
              ) : needsData && dataLoaded ? (
                <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-[#f2f4f6]">
                  <div className="flex items-center gap-2">
                    <Database className="h-3.5 w-3.5 text-[#0052cc]" />
                    <span className="text-sm font-medium text-[#18181B]">{fileName}</span>
                    <span className="text-xs text-[#A1A1AA]">{columns.length} columns</span>
                  </div>
                  <button onClick={() => setDrawerStep('dataset')} className="text-xs text-[#0052cc] hover:underline font-medium">
                    Change
                  </button>
                </div>
              ) : null}

              {/* Config form */}
              <div className="bg-[#f7f9fb] rounded-2xl p-5">
                <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#A1A1AA] font-manrope mb-4">
                  Configuration
                </p>
                <ConfigComponent
                  type={selectedType}
                  config={config}
                  onChange={setConfig}
                  onRun={handleRun}
                  loading={running}
                  columns={needsData ? (dataLoaded ? columns : []) : []}
                />
              </div>

              {/* Results preview */}
              {result && !result.summary?.error && (
                <div>
                  <div className="flex items-center gap-2.5 mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#0040a2] font-manrope">Results Preview</span>
                    <span className="w-1 h-1 bg-[#c3c6d6] rounded-full" />
                    <span className="text-xs text-[#A1A1AA]">Save to view full analysis</span>
                  </div>
                  {result.summary && Object.keys(result.summary).filter(k => k !== 'error').length > 0 && (
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      {Object.entries(result.summary)
                        .filter(([k]) => k !== 'error')
                        .slice(0, 4)
                        .map(([key, val]) => (
                          <div key={key} className="bg-white rounded-xl px-4 py-3" style={{ boxShadow: '0 4px 12px rgba(0,24,72,0.04)' }}>
                            <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#A1A1AA] truncate font-manrope">{formatKey(key)}</p>
                            <p className="text-sm font-manrope font-bold text-[#18181B] truncate mt-0.5">{String(val)}</p>
                          </div>
                        ))}
                    </div>
                  )}
                  <button
                    onClick={handleSave}
                    disabled={!!savedRunId}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{ background: 'linear-gradient(135deg, #003d9b, #0052cc)', boxShadow: '0 4px 20px rgba(0,82,204,0.3)' }}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Save &amp; View Full Results
                  </button>
                </div>
              )}

              {/* Error */}
              {result?.summary?.error && (
                <div className="bg-[#FEF2F2] rounded-xl p-4">
                  <p className="text-sm font-semibold text-[#991B1B]">Analysis Error</p>
                  <p className="text-xs text-[#52525B] mt-1">{String(result.summary.error)}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Empty State ─────────────────────────────────────────
function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div
      className="text-center py-20 bg-white rounded-2xl"
      style={{ boxShadow: '0 20px 50px rgba(0,24,72,0.04)' }}
    >
      <div
        className="mx-auto w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
        style={{ background: 'linear-gradient(135deg, #003d9b, #0052cc)' }}
      >
        <BarChart2 className="h-7 w-7 text-white" />
      </div>
      <h3 className="font-manrope font-bold text-lg text-[#18181B]">No analyses yet</h3>
      <p className="text-sm text-[#52525B] mt-2 max-w-sm mx-auto leading-relaxed">
        Run your first statistical analysis to unlock results, interactive visualizations, and AI-powered interpretations.
      </p>
      <button
        onClick={onNew}
        className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
        style={{ background: 'linear-gradient(135deg, #003d9b, #0052cc)', boxShadow: '0 4px 20px rgba(0,82,204,0.25)' }}
      >
        <Plus className="h-4 w-4" />
        Start Your First Analysis
      </button>
    </div>
  )
}

function formatKey(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .trim()
    .replace(/^./, c => c.toUpperCase())
}
