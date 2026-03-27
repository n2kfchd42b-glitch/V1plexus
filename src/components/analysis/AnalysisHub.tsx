"use client"

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Plus, BarChart2, CheckCircle2, AlertCircle,
  Search, Activity, X, ChevronRight, Database,
  ArrowLeft, ArrowRight, Download, FileText,
} from 'lucide-react'
import { AnalysisTypePicker, ANALYSIS_TYPES } from './AnalysisTypePicker'
import { ProjectDatasetSelector } from './ProjectDatasetSelector'
import { AISuggestions } from './AISuggestions'
import { AnalysisCharts } from './results/AnalysisCharts'
import { createClient } from '@/lib/supabase/client'
import { runAnalysis } from '@/lib/analysis/engine'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'
import { formatRelative } from '@/lib/utils'
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

  useEffect(() => {
    supabase.from('analysis_runs')
      .select('*, dataset:datasets(id, name)')
      .eq('project_id', projectId).is('deleted_at', null)
      .order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => { if (data) setRuns(data as AnalysisRun[]); setLoading(false) })
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
    toast.success('Analysis deleted')
  }

  const handleData = (rows: DataRow[], cols: DatasetColumn[], name: string, dsId?: string, vsId?: string) => {
    setData(rows); setColumns(cols); setFileName(name)
    setDatasetId(dsId); setVersionId(vsId); setResult(null)
  }

  const handleTypeSelect = (type: AnalysisType) => {
    setSelectedType(type); setConfig({}); setResult(null); setDrawerStep('config')
  }

  const handleRun = async () => {
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

  const handleSave = async () => {
    if (!result || !profile || !selectedType) return
    const typeInfo = ANALYSIS_TYPES.find(t => t.type === selectedType)
    const { data: run } = await supabase.from('analysis_runs').insert({
      project_id: projectId, dataset_id: datasetId ?? null, version_id: versionId ?? null,
      analysis_type: selectedType,
      title: `${typeInfo?.label ?? selectedType} — ${new Date().toLocaleDateString()}`,
      config, results: result as unknown as Record<string, unknown>,
      interpretation: result.interpretation, status: 'completed', created_by: profile.id,
    }).select().single()
    if (run) { setSavedRunId(run.id); closeDrawer(); router.push(`/projects/${projectId}/analysis/${run.id}`) }
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
      <div className="min-h-screen bg-[#f7f9fb]">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="h-3 w-20 bg-[#f2f4f6] rounded-full animate-pulse mb-6" />
          <div className="h-10 w-64 bg-[#f2f4f6] rounded-xl animate-pulse mb-8" />
          <div className="grid grid-cols-3 gap-5">
            <div className="col-span-2 h-[480px] rounded-2xl bg-white animate-pulse" style={{ boxShadow: '0 20px 50px rgba(0,24,72,0.04)' }} />
            <div className="flex flex-col gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-24 rounded-2xl bg-white animate-pulse" style={{ boxShadow: '0 20px 50px rgba(0,24,72,0.04)' }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f7f9fb]">
      {/* ── Page header ──────────────────────────────── */}
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
              {project?.title
                ? <>{project.title.split(' ').slice(0, 3).join(' ')} <span className="text-[#0052cc]">Analysis</span></>
                : <>Analysis <span className="text-[#0052cc]">Hub</span></>
              }
            </h1>
            <p className="text-sm text-[#52525B] mt-1.5 max-w-xl">
              {project?.description
                ? project.description.slice(0, 120) + (project.description.length > 120 ? '…' : '')
                : 'Run guided statistical analyses on your research data with AI-powered interpretations.'
              }
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

      {/* ── Main grid ────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-6 pb-12">

        {runs.length === 0 ? (
          <EmptyState onNew={openDrawer} />
        ) : (
          <>
            <div className="grid grid-cols-3 gap-5 mb-8">

              {/* ── Left: Latest analysis chart ──────── */}
              <div className="col-span-2">
                {latestCompleted ? (
                  <div>
                    {/* Card header */}
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#0040a2] font-manrope block mb-1">
                          Latest Analysis
                        </span>
                        <h2 className="font-manrope font-bold text-lg text-[#18181B] truncate">
                          {latestCompleted.title ?? latestTypeInfo?.label ?? latestCompleted.analysis_type}
                        </h2>
                        <p className="text-xs text-[#A1A1AA] mt-0.5 flex items-center gap-2 flex-wrap">
                          {latestTypeInfo?.label && <span>{latestTypeInfo.label}</span>}
                          {latestDataset && (
                            <>
                              <span className="text-[#e0e3e5]">·</span>
                              <span className="flex items-center gap-1">
                                <Database className="h-3 w-3" />
                                {latestDataset.name}
                              </span>
                            </>
                          )}
                          <span className="text-[#e0e3e5]">·</span>
                          <span>{formatRelative(latestCompleted.created_at)}</span>
                        </p>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => exportToWord(latestCompleted)}
                          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-bold uppercase tracking-[0.06em] text-[#52525B] bg-white border border-[rgba(195,198,214,0.4)] hover:bg-[#f2f4f6] transition-all"
                          style={{ boxShadow: '0 4px 12px rgba(0,24,72,0.04)' }}
                        >
                          <Download className="h-3.5 w-3.5" />
                          Export
                        </button>
                        <Link href={`/projects/${projectId}/documents`}>
                          <button
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-bold uppercase tracking-[0.06em] text-white transition-all hover:scale-[1.02]"
                            style={{ background: 'linear-gradient(135deg, #003d9b, #0052cc)', boxShadow: '0 4px 16px rgba(0,82,204,0.25)' }}
                          >
                            <FileText className="h-3.5 w-3.5" />
                            Draft Manuscript
                          </button>
                        </Link>
                      </div>
                    </div>

                    {/* Chart */}
                    {latestCharts.length > 0 ? (
                      <AnalysisCharts charts={latestCharts as Parameters<typeof AnalysisCharts>[0]['charts']} />
                    ) : (
                      /* No chart: show summary stats */
                      <div
                        className="bg-white rounded-2xl p-8"
                        style={{ boxShadow: '0 20px 50px rgba(0,24,72,0.04), 0 4px 12px rgba(0,24,72,0.03)' }}
                      >
                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#0040a2] font-manrope mb-4">Summary Statistics</p>
                        {latestResult?.summary && Object.keys(latestResult.summary).filter(k => k !== 'error').length > 0 ? (
                          <div className="grid grid-cols-3 gap-3">
                            {Object.entries(latestResult.summary)
                              .filter(([k]) => k !== 'error')
                              .slice(0, 6)
                              .map(([key, val]) => (
                                <div key={key} className="bg-[#f7f9fb] rounded-xl px-4 py-3">
                                  <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#A1A1AA] font-manrope truncate">{formatKey(key)}</p>
                                  <p className="font-manrope font-bold text-lg text-[#18181B] mt-0.5">{String(val)}</p>
                                </div>
                              ))}
                          </div>
                        ) : (
                          <p className="text-sm text-[#A1A1AA]">No summary data available.</p>
                        )}
                      </div>
                    )}

                    {/* View full results */}
                    <div className="mt-3 flex justify-end">
                      <Link href={`/projects/${projectId}/analysis/${latestCompleted.id}`}>
                        <button className="flex items-center gap-1.5 text-xs font-bold text-[#0052cc] hover:text-[#003d9b] transition-colors">
                          View Full Results
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div
                    className="bg-white rounded-2xl h-full min-h-[300px] flex items-center justify-center"
                    style={{ boxShadow: '0 20px 50px rgba(0,24,72,0.04)' }}
                  >
                    <div className="text-center px-8">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
                        style={{ background: 'linear-gradient(135deg, #003d9b, #0052cc)' }}>
                        <BarChart2 className="h-6 w-6 text-white" />
                      </div>
                      <p className="font-manrope font-bold text-[#18181B]">No completed analyses yet</p>
                      <p className="text-sm text-[#A1A1AA] mt-1">Charts will appear here once you run an analysis.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Right: Stat cards ────────────────── */}
              <div className="flex flex-col gap-4">
                {/* Total */}
                <div
                  className="rounded-2xl p-6 flex flex-col justify-between flex-1"
                  style={{
                    background: 'linear-gradient(135deg, #001a5c 0%, #003d9b 60%, #0052cc 100%)',
                    boxShadow: '0 20px 50px rgba(0,24,72,0.12)',
                  }}
                >
                  <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/40 font-manrope">Total Analyses</p>
                  <p className="font-manrope font-extrabold text-[2.5rem] leading-none tracking-tight text-white mt-2">
                    {stats.total}
                  </p>
                  <p className="text-white/40 text-[10px] font-medium mt-1">{stats.total === 1 ? 'run recorded' : 'runs recorded'}</p>
                </div>

                {/* Completed */}
                <div
                  className="rounded-2xl px-5 py-4 flex items-center justify-between bg-white flex-1"
                  style={{ boxShadow: '0 20px 50px rgba(0,24,72,0.04), 0 4px 12px rgba(0,24,72,0.03)' }}
                >
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#A1A1AA] font-manrope">Completed</p>
                    <p className="font-manrope font-extrabold text-[1.75rem] leading-none tracking-tight text-[#166534] mt-1">{stats.completed}</p>
                    {stats.total > 0 && (
                      <p className="text-[10px] text-[#A1A1AA] mt-1">{Math.round((stats.completed / stats.total) * 100)}% success</p>
                    )}
                  </div>
                  <div className="w-8 h-8 rounded-xl bg-[#F0FDF4] flex items-center justify-center">
                    <CheckCircle2 className="h-4 w-4 text-[#22C55E]" />
                  </div>
                </div>

                {/* Active */}
                <div
                  className="rounded-2xl px-5 py-4 flex items-center justify-between bg-white flex-1"
                  style={{ boxShadow: '0 20px 50px rgba(0,24,72,0.04), 0 4px 12px rgba(0,24,72,0.03)' }}
                >
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#A1A1AA] font-manrope">Active</p>
                    <p className="font-manrope font-extrabold text-[1.75rem] leading-none tracking-tight text-[#1E40AF] mt-1">{stats.active}</p>
                  </div>
                  <div className="w-8 h-8 rounded-xl bg-[#EFF6FF] flex items-center justify-center">
                    <Activity className="h-4 w-4 text-[#3B82F6]" />
                  </div>
                </div>

                {/* Failed */}
                <div
                  className="rounded-2xl px-5 py-4 flex items-center justify-between bg-white flex-1"
                  style={{ boxShadow: '0 20px 50px rgba(0,24,72,0.04), 0 4px 12px rgba(0,24,72,0.03)' }}
                >
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#A1A1AA] font-manrope">Failed</p>
                    <p className="font-manrope font-extrabold text-[1.75rem] leading-none tracking-tight text-[#991B1B] mt-1">{stats.failed}</p>
                  </div>
                  <div className="w-8 h-8 rounded-xl bg-[#FEF2F2] flex items-center justify-center">
                    <AlertCircle className="h-4 w-4 text-[#EF4444]" />
                  </div>
                </div>
              </div>
            </div>

            {/* ── Analysis history ─────────────────────── */}
            <div>
              {/* Section header + search */}
              <div className="flex items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-2.5">
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#0040a2] font-manrope">Analysis History</span>
                  <span className="w-1 h-1 bg-[#c3c6d6] rounded-full" />
                  <span className="text-xs text-[#A1A1AA]">{runs.length} {runs.length === 1 ? 'run' : 'runs'} total</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#A1A1AA]" />
                    <input
                      type="text" placeholder="Search…" value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="pl-9 pr-4 py-2 text-sm rounded-lg bg-[#f2f4f6] border border-[rgba(195,198,214,0.3)] text-[#18181B] placeholder:text-[#A1A1AA] outline-none focus:border-[rgba(0,82,204,0.4)] focus:shadow-[0_0_0_3px_rgba(0,82,204,0.08)] transition-all w-44"
                    />
                  </div>
                  <div className="flex items-center gap-1 bg-[#f2f4f6] rounded-[10px] p-1">
                    {(['all', 'completed', 'running', 'failed'] as FilterStatus[]).map(s => (
                      <button key={s} onClick={() => setFilterStatus(s)}
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
              </div>

              {/* Compact list */}
              {filteredRuns.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-sm text-[#52525B]">No analyses match your filters</p>
                  <button onClick={() => { setFilterStatus('all'); setSearchQuery('') }}
                    className="text-[#0052CC] text-xs mt-2 hover:underline">Clear filters</button>
                </div>
              ) : (
                <div
                  className="bg-white rounded-2xl overflow-hidden"
                  style={{ boxShadow: '0 20px 50px rgba(0,24,72,0.04), 0 4px 12px rgba(0,24,72,0.03)' }}
                >
                  {filteredRuns.map((run, i) => {
                    const info   = ANALYSIS_TYPES.find(t => t.type === run.analysis_type)
                    const ds     = run.dataset as { name: string } | null
                    const isLast = i === filteredRuns.length - 1
                    const statusMap: Record<string, { color: string; label: string }> = {
                      completed: { color: 'bg-[#F0FDF4] text-[#166534]', label: 'Completed' },
                      failed:    { color: 'bg-[#FEF2F2] text-[#991B1B]', label: 'Failed' },
                      running:   { color: 'bg-[#EFF6FF] text-[#1E40AF]', label: 'Running' },
                      pending:   { color: 'bg-[#F0F0F0] text-[#52525B]', label: 'Pending' },
                      cancelled: { color: 'bg-[#F0F0F0] text-[#52525B]', label: 'Cancelled' },
                    }
                    const status = statusMap[run.status] ?? statusMap.pending
                    return (
                      <Link key={run.id} href={`/projects/${projectId}/analysis/${run.id}`}>
                        <div
                          className={`group flex items-center gap-4 px-6 py-4 cursor-pointer transition-all duration-150 hover:bg-[rgba(0,61,155,0.02)] ${!isLast ? 'border-b border-[#f2f4f6]' : ''}`}
                        >
                          {/* Status dot */}
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            run.status === 'completed' ? 'bg-[#22C55E]' :
                            run.status === 'failed'    ? 'bg-[#EF4444]' :
                            run.status === 'running'   ? 'bg-[#3B82F6]' : 'bg-[#A1A1AA]'
                          }`} />

                          {/* Title + type */}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-manrope font-semibold text-[#18181B] truncate group-hover:text-[#0052cc] transition-colors">
                              {run.title ?? info?.label ?? run.analysis_type}
                            </p>
                            <p className="text-xs text-[#A1A1AA] mt-0.5">
                              {info?.label ?? run.analysis_type.replace(/_/g, ' ')}
                              {ds && <span className="ml-2">· {ds.name}</span>}
                            </p>
                          </div>

                          {/* Date */}
                          <span className="text-xs text-[#A1A1AA] flex-shrink-0 hidden sm:block">
                            {formatRelative(run.created_at)}
                          </span>

                          {/* Status badge */}
                          <span className={`text-[10px] font-bold uppercase tracking-[0.08em] px-2.5 py-1 rounded-lg flex-shrink-0 ${status.color}`}>
                            {status.label}
                          </span>

                          {/* Delete (on hover) */}
                          {run.id !== latestCompleted?.id && (
                            <button
                              onClick={e => { e.preventDefault(); e.stopPropagation(); handleDelete(run.id) }}
                              className="opacity-0 group-hover:opacity-100 text-[#A1A1AA] hover:text-[#EF4444] transition-all p-1 rounded-lg hover:bg-[#FEF2F2]"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}

                          <ArrowRight className="h-4 w-4 text-transparent group-hover:text-[#0052cc] transition-all flex-shrink-0" />
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── New Analysis Drawer ─────────────────────── */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px]" onClick={closeDrawer} />
      )}
      <div
        className={`fixed inset-y-0 right-0 z-50 flex flex-col w-full max-w-[620px] bg-white overflow-y-auto transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${drawerOpen ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ boxShadow: '-20px 0 80px rgba(0,24,72,0.14), -4px 0 20px rgba(0,24,72,0.07)' }}
      >
        {/* Drawer header */}
        <div className="flex-shrink-0 px-8 pt-7 pb-6 border-b border-[#f2f4f6]">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#0040a2] font-manrope">Analysis Engine</span>
            <button onClick={closeDrawer} className="w-8 h-8 rounded-xl flex items-center justify-center text-[#A1A1AA] hover:bg-[#f2f4f6] hover:text-[#18181B] transition-all">
              <X className="h-4 w-4" />
            </button>
          </div>
          <h2 className="font-manrope font-extrabold text-[1.6rem] leading-tight tracking-tight text-[#18181B] mb-5">
            New <span className="text-[#0052cc]">Analysis</span>
          </h2>
          <div className="flex items-center gap-1 bg-[#f2f4f6] rounded-[10px] p-1 w-fit">
            {DRAWER_STEPS.map((step, i) => {
              const isPast = i < drawerStepIdx; const isCurrent = drawerStep === step.id
              return (
                <button key={step.id} onClick={() => { if (isPast) setDrawerStep(step.id) }} disabled={!isPast && !isCurrent}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-[0.06em] transition-all ${
                    isCurrent ? 'bg-white text-[#003d9b] shadow-[0_2px_8px_rgba(0,24,72,0.08)]'
                    : isPast ? 'text-[#166534] hover:text-[#003d9b] cursor-pointer'
                    : 'text-[#A1A1AA] cursor-default'
                  }`}
                >
                  <span className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-[8px] font-bold flex-shrink-0 ${
                    isCurrent ? 'bg-[#003d9b] text-white' : isPast ? 'bg-[#22C55E] text-white' : 'bg-[#e0e3e5] text-[#A1A1AA]'
                  }`}>{isPast ? '✓' : i + 1}</span>
                  {step.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Drawer body */}
        <div className="flex-1 px-8 py-7 space-y-6">

          {drawerStep === 'dataset' && (
            <>
              <p className="text-sm text-[#52525B] leading-relaxed">Select a dataset or upload a new file. Your data is processed locally.</p>
              <ProjectDatasetSelector projectId={projectId} onData={handleData} datasetId={datasetId} versionId={versionId} data={data} fileName={fileName} />
              <div className="flex items-center gap-4 pt-1">
                <button disabled={!dataLoaded} onClick={() => setDrawerStep('type')}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
                  style={{ background: 'linear-gradient(135deg, #003d9b, #0052cc)', boxShadow: dataLoaded ? '0 4px 16px rgba(0,82,204,0.28)' : 'none' }}>
                  Continue to Analysis <ChevronRight className="h-4 w-4" />
                </button>
                <button onClick={() => setDrawerStep('type')} className="text-sm text-[#A1A1AA] hover:text-[#18181B] transition-colors">
                  Skip (sample size only)
                </button>
              </div>
            </>
          )}

          {drawerStep === 'type' && (
            <>
              {dataLoaded ? (
                <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-[#f2f4f6]">
                  <div className="flex items-center gap-2">
                    <Database className="h-3.5 w-3.5 text-[#0052cc]" />
                    <span className="text-sm font-medium text-[#18181B]">{fileName}</span>
                    <span className="text-xs text-[#A1A1AA]">· {data.length.toLocaleString()} rows · {columns.length} cols</span>
                  </div>
                  <button onClick={() => setDrawerStep('dataset')} className="text-xs text-[#0052cc] hover:underline font-medium">Change</button>
                </div>
              ) : (
                <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200">
                  <span className="text-xs text-amber-700">No dataset — only sample size calculator available</span>
                  <button onClick={() => setDrawerStep('dataset')} className="text-xs text-amber-700 font-bold underline ml-2">Add data</button>
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
                <button onClick={() => setDrawerStep('type')} className="text-xs text-[#A1A1AA] hover:text-[#0052cc] transition-colors font-medium">← Change type</button>
                <span className="text-[#e0e3e5]">|</span>
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#0040a2] font-manrope">{typeInfo?.label}</span>
              </div>

              {needsData && !dataLoaded ? (
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#A1A1AA] font-manrope mb-2">Dataset Required</p>
                  <ProjectDatasetSelector projectId={projectId} onData={handleData} datasetId={datasetId} versionId={versionId} data={data} fileName={fileName} />
                </div>
              ) : needsData && dataLoaded ? (
                <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-[#f2f4f6]">
                  <div className="flex items-center gap-2">
                    <Database className="h-3.5 w-3.5 text-[#0052cc]" />
                    <span className="text-sm font-medium text-[#18181B]">{fileName}</span>
                    <span className="text-xs text-[#A1A1AA]">{columns.length} columns</span>
                  </div>
                  <button onClick={() => setDrawerStep('dataset')} className="text-xs text-[#0052cc] hover:underline font-medium">Change</button>
                </div>
              ) : null}

              <div className="bg-[#f7f9fb] rounded-2xl p-5">
                <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#A1A1AA] font-manrope mb-4">Configuration</p>
                <ConfigComponent type={selectedType} config={config} onChange={setConfig} onRun={handleRun}
                  loading={running} columns={needsData ? (dataLoaded ? columns : []) : []} />
              </div>

              {result && !result.summary?.error && (
                <div>
                  <div className="flex items-center gap-2.5 mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#0040a2] font-manrope">Results Preview</span>
                    <span className="w-1 h-1 bg-[#c3c6d6] rounded-full" />
                    <span className="text-xs text-[#A1A1AA]">Save to view full analysis</span>
                  </div>
                  {result.summary && Object.keys(result.summary).filter(k => k !== 'error').length > 0 && (
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      {Object.entries(result.summary).filter(([k]) => k !== 'error').slice(0, 4).map(([key, val]) => (
                        <div key={key} className="bg-white rounded-xl px-4 py-3" style={{ boxShadow: '0 4px 12px rgba(0,24,72,0.04)' }}>
                          <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#A1A1AA] truncate font-manrope">{formatKey(key)}</p>
                          <p className="text-sm font-manrope font-bold text-[#18181B] truncate mt-0.5">{String(val)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  <button onClick={handleSave} disabled={!!savedRunId}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{ background: 'linear-gradient(135deg, #003d9b, #0052cc)', boxShadow: '0 4px 20px rgba(0,82,204,0.3)' }}>
                    <CheckCircle2 className="h-4 w-4" />
                    Save &amp; View Full Results
                  </button>
                </div>
              )}

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
    <div className="text-center py-24 bg-white rounded-2xl" style={{ boxShadow: '0 20px 50px rgba(0,24,72,0.04)' }}>
      <div className="mx-auto w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
        style={{ background: 'linear-gradient(135deg, #003d9b, #0052cc)' }}>
        <BarChart2 className="h-7 w-7 text-white" />
      </div>
      <h3 className="font-manrope font-bold text-lg text-[#18181B]">No analyses yet</h3>
      <p className="text-sm text-[#52525B] mt-2 max-w-sm mx-auto leading-relaxed">
        Run your first statistical analysis to unlock results, interactive visualizations, and AI-powered interpretations.
      </p>
      <button onClick={onNew}
        className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
        style={{ background: 'linear-gradient(135deg, #003d9b, #0052cc)', boxShadow: '0 4px 20px rgba(0,82,204,0.25)' }}>
        <Plus className="h-4 w-4" />
        Start Your First Analysis
      </button>
    </div>
  )
}

function formatKey(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim().replace(/^./, c => c.toUpperCase())
}
