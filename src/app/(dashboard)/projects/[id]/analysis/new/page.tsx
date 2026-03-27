"use client"

import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { AnalysisTypePicker, ANALYSIS_TYPES } from '@/components/analysis/AnalysisTypePicker'
import { ProjectDatasetSelector } from '@/components/analysis/ProjectDatasetSelector'
import { AISuggestions } from '@/components/analysis/AISuggestions'
import { ResultsPanel } from '@/components/analysis/results/ResultsPanel'
import { runAnalysis } from '@/lib/analysis/engine'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import type { AnalysisType, DatasetColumn } from '@/types/database'
import type { DataRow, AnalysisResult } from '@/lib/analysis/engine'

// Config components
import { DescriptiveConfig } from '@/components/analysis/configs/DescriptiveConfig'
import { FrequencyConfig } from '@/components/analysis/configs/FrequencyConfig'
import { ChiSquareConfig } from '@/components/analysis/configs/ChiSquareConfig'
import { TTestConfig } from '@/components/analysis/configs/TTestConfig'
import { AnovaConfig } from '@/components/analysis/configs/AnovaConfig'
import { CorrelationConfig } from '@/components/analysis/configs/CorrelationConfig'
import { SimpleRegressionConfig } from '@/components/analysis/configs/SimpleRegressionConfig'
import { MultipleRegressionConfig } from '@/components/analysis/configs/MultipleRegressionConfig'
import { LogisticRegressionConfig } from '@/components/analysis/configs/LogisticRegressionConfig'
import { MultinomialConfig } from '@/components/analysis/configs/MultinomialConfig'
import { OrdinalConfig } from '@/components/analysis/configs/OrdinalConfig'
import { PoissonConfig } from '@/components/analysis/configs/PoissonConfig'
import { KaplanMeierConfig } from '@/components/analysis/configs/KaplanMeierConfig'
import { CoxConfig } from '@/components/analysis/configs/CoxConfig'
import { TimeSeriesConfig } from '@/components/analysis/configs/TimeSeriesConfig'
import { PCAConfig } from '@/components/analysis/configs/PCAConfig'
import { FactorAnalysisConfig } from '@/components/analysis/configs/FactorAnalysisConfig'
import { ClusterConfig } from '@/components/analysis/configs/ClusterConfig'
import { MetaAnalysisConfig } from '@/components/analysis/configs/MetaAnalysisConfig'
import { SpatialConfig } from '@/components/analysis/configs/SpatialConfig'
import { OutbreakConfig } from '@/components/analysis/configs/OutbreakConfig'
import { SampleSizeConfig } from '@/components/analysis/configs/SampleSizeConfig'

type Step = 'dataset' | 'type' | 'config'

const STEPS: { id: Step; label: string }[] = [
  { id: 'dataset', label: 'Select Dataset' },
  { id: 'type',    label: 'Choose Analysis' },
  { id: 'config',  label: 'Configure & Run' },
]

interface ProjectMeta {
  title: string
  description: string | null
  methodology: string | null
  research_objectives: string | null
}

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
    case 'descriptive':          return <DescriptiveConfig {...props} />
    case 'frequency':            return <FrequencyConfig {...props} />
    case 'chi_square':           return <ChiSquareConfig {...props} />
    case 't_test':               return <TTestConfig {...props} />
    case 'anova':                return <AnovaConfig {...props} />
    case 'correlation':          return <CorrelationConfig {...props} />
    case 'simple_regression':    return <SimpleRegressionConfig {...props} />
    case 'multiple_regression':  return <MultipleRegressionConfig {...props} />
    case 'logistic_regression':  return <LogisticRegressionConfig {...props} />
    case 'multinomial_regression': return <MultinomialConfig {...props} />
    case 'ordinal_regression':   return <OrdinalConfig {...props} />
    case 'poisson_regression':
    case 'negbinomial_regression': return <PoissonConfig {...props} analysisType={type} />
    case 'kaplan_meier':         return <KaplanMeierConfig {...props} />
    case 'cox_regression':       return <CoxConfig {...props} />
    case 'time_series':          return <TimeSeriesConfig {...props} />
    case 'pca':                  return <PCAConfig {...props} />
    case 'factor_analysis':      return <FactorAnalysisConfig {...props} />
    case 'cluster_analysis':     return <ClusterConfig {...props} />
    case 'meta_analysis':        return <MetaAnalysisConfig {...props} />
    case 'spatial_analysis':     return <SpatialConfig {...props} />
    case 'outbreak_investigation': return <OutbreakConfig {...props} />
    case 'sample_size':          return <SampleSizeConfig {...props} />
    default: return <p className="text-sm text-muted-foreground">Configuration not available for this analysis type.</p>
  }
}

export default function NewAnalysisPage() {
  const params   = useParams()
  const router   = useRouter()
  const projectId = params.id as string
  const { profile } = useAuth()
  const supabase = useMemo(() => createClient(), [])

  // Step state
  const [step, setStep] = useState<Step>('dataset')

  // Project context (for AI suggestions)
  const [project, setProject] = useState<ProjectMeta | null>(null)

  // Dataset state
  const [data, setData]           = useState<DataRow[]>([])
  const [columns, setColumns]     = useState<DatasetColumn[]>([])
  const [fileName, setFileName]   = useState<string>('')
  const [datasetId, setDatasetId] = useState<string | undefined>()
  const [versionId, setVersionId] = useState<string | undefined>()

  // Analysis state
  const [selectedType, setSelectedType] = useState<AnalysisType | null>(null)
  const [config, setConfig]             = useState<Record<string, unknown>>({})
  const [running, setRunning]           = useState(false)
  const [result, setResult]             = useState<AnalysisResult | null>(null)
  const [savedRunId, setSavedRunId]     = useState<string | null>(null)

  // Load project metadata for AI context
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

  const handleData = (
    rows: DataRow[],
    cols: DatasetColumn[],
    name: string,
    dsId?: string,
    vsId?: string
  ) => {
    setData(rows)
    setColumns(cols)
    setFileName(name)
    setDatasetId(dsId)
    setVersionId(vsId)
    setResult(null)
  }

  const handleTypeSelect = (type: AnalysisType) => {
    setSelectedType(type)
    setResult(null)
    setConfig({})
    setStep('config')
  }

  const handleRun = async () => {
    if (!selectedType) return
    setRunning(true)
    setResult(null)
    try {
      const analysisResult = await runAnalysis(selectedType, data, config)
      setResult(analysisResult)
    } catch (err) {
      setResult({
        type: selectedType,
        summary: { error: err instanceof Error ? err.message : 'Analysis failed' },
        tables: [],
        charts: [],
        interpretation: 'Analysis failed.',
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
      router.push(`/projects/${projectId}/analysis/${run.id}`)
    }
  }

  const typeInfo   = selectedType ? ANALYSIS_TYPES.find(t => t.type === selectedType) : null
  const needsData  = selectedType !== 'sample_size'
  const dataLoaded = data.length > 0

  // Columns in the shape the AI API expects
  const columnsForAI = columns.map(c => ({
    name: c.name,
    type: c.type,
    unique_values: c.unique_values,
    missing: c.missing,
  }))

  const stepIndex = STEPS.findIndex(s => s.id === step)

  return (
    <div className="min-h-screen bg-[#f7f9fb]">
      {/* Page header */}
      <div className="bg-[#f7f9fb] px-8 pt-7 pb-6">
        <div className="max-w-7xl mx-auto">
          <Link href={`/projects/${projectId}/analysis`}>
            <button className="flex items-center gap-1.5 text-[#A1A1AA] hover:text-[#18181B] transition-colors mb-5 text-xs font-medium">
              <ArrowLeft className="h-3.5 w-3.5" />
              Analysis Hub
            </button>
          </Link>

          <div className="flex items-end justify-between gap-6 flex-wrap mb-6">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#0040a2] font-manrope block mb-2">
                Analysis Engine
              </span>
              <h1 className="font-manrope font-extrabold text-[2rem] leading-tight tracking-tight text-[#18181B]">
                New <span className="text-[#0052cc]">Analysis</span>
              </h1>
            </div>
          </div>

          {/* Stepper */}
          <div className="flex items-center gap-1 bg-[#f2f4f6] rounded-[10px] p-1 w-fit">
            {STEPS.map((s, i) => (
              <button
                key={s.id}
                onClick={() => { if (i < stepIndex) setStep(s.id) }}
                disabled={i > stepIndex}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-[0.06em] transition-all ${
                  step === s.id
                    ? 'bg-white text-[#003d9b] shadow-[0_2px_8px_rgba(0,24,72,0.08)]'
                    : i < stepIndex
                    ? 'text-[#166534] hover:text-[#003d9b] cursor-pointer'
                    : 'text-[#A1A1AA] cursor-default'
                }`}
              >
                <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold flex-shrink-0 ${
                  step === s.id
                    ? 'bg-[#003d9b] text-white'
                    : i < stepIndex
                    ? 'bg-[#22C55E] text-white'
                    : 'bg-[#e0e3e5] text-[#A1A1AA]'
                }`}>
                  {i < stepIndex ? '✓' : i + 1}
                </span>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 pb-10">

      {/* ── Step 1: Dataset selection ─────────────────────────── */}
      {step === 'dataset' && (
        <div className="max-w-xl">
          <p className="text-sm text-[var(--text-secondary)] mb-4">
            Select a dataset that has already been uploaded to this project, or upload a new file.
            The dataset will be used directly — no need to re-upload data you have already versioned.
          </p>

          <ProjectDatasetSelector
            projectId={projectId}
            onData={handleData}
            datasetId={datasetId}
            versionId={versionId}
            data={data}
            fileName={fileName}
          />

          <div className="flex items-center gap-3 mt-5">
            <Button
              disabled={!dataLoaded}
              onClick={() => setStep('type')}
              className="flex items-center gap-2"
            >
              Continue to Analysis Selection
              <ChevronRight className="h-4 w-4" />
            </Button>
            {/* Sample size doesn't need data */}
            <button
              onClick={() => { setStep('type') }}
              className="text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] underline"
            >
              Skip (sample size calculator)
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Analysis type + AI suggestions ────────────── */}
      {step === 'type' && (
        <div>
          {/* AI Suggestions (auto-loads) */}
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

          {/* Dataset status bar */}
          {dataLoaded ? (
            <div className="flex items-center justify-between mb-4 px-3 py-2 rounded-lg bg-[var(--bg-inset)] border border-[var(--border-default)] text-sm">
              <span className="text-[var(--text-secondary)]">
                Using <span className="font-medium text-[var(--text-primary)]">{fileName}</span>
                <span className="text-[var(--text-tertiary)] ml-1">· {data.length.toLocaleString()} rows · {columns.length} columns</span>
              </span>
              <button
                onClick={() => setStep('dataset')}
                className="text-xs text-blue-600 hover:underline"
              >
                Change dataset
              </button>
            </div>
          ) : (
            <div className="mb-4 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-400 flex items-center justify-between">
              <span>No dataset loaded — only sample size calculator available without data.</span>
              <button onClick={() => setStep('dataset')} className="font-medium underline ml-2">
                Select dataset
              </button>
            </div>
          )}

          <AnalysisTypePicker selected={selectedType} onSelect={handleTypeSelect} />
        </div>
      )}

      {/* ── Step 3: Config + Run ──────────────────────────────── */}
      {step === 'config' && selectedType && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left panel */}
          <div className="lg:col-span-2">
            <div
              className="bg-white rounded-2xl p-6 sticky top-6"
              style={{ boxShadow: '0 20px 50px rgba(0,24,72,0.04), 0 4px 12px rgba(0,24,72,0.03)' }}
            >
              {/* Header */}
              <div className="flex items-center gap-2 mb-5">
                <button
                  onClick={() => setStep('type')}
                  className="text-xs text-[#A1A1AA] hover:text-[#0052cc] transition-colors font-medium"
                >
                  ← Change analysis
                </button>
                <span className="text-[#e0e3e5]">|</span>
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#0040a2] font-manrope">{typeInfo?.label}</span>
              </div>

              {/* Dataset */}
              {needsData && (
                <div className="mb-5">
                  <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#A1A1AA] font-manrope mb-2">Dataset</p>
                  <ProjectDatasetSelector
                    projectId={projectId}
                    onData={handleData}
                    datasetId={datasetId}
                    versionId={versionId}
                    data={data}
                    fileName={fileName}
                  />
                  {data.length > 0 && (
                    <p className="text-xs text-[#A1A1AA] mt-1.5">{columns.length} columns available</p>
                  )}
                </div>
              )}

              {/* Config */}
              <div className="border-t border-[#f2f4f6] pt-5">
                <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#A1A1AA] font-manrope mb-3">Configuration</p>
                <ConfigComponent
                  type={selectedType}
                  config={config}
                  onChange={setConfig}
                  onRun={handleRun}
                  loading={running}
                  columns={needsData ? (data.length > 0 ? columns : []) : []}
                />
              </div>
            </div>
          </div>

          {/* Right panel — results */}
          <div className="lg:col-span-3">
            {result ? (
              <ResultsPanel
                result={result}
                analysisType={selectedType}
                title={typeInfo?.label}
                datasetName={fileName}
                onSave={handleSave}
                isSaved={!!savedRunId}
              />
            ) : (
              <div
                className="bg-white rounded-2xl h-full min-h-[300px] flex items-center justify-center"
                style={{ boxShadow: '0 20px 50px rgba(0,24,72,0.04)' }}
              >
                <div className="text-center px-6">
                  <div className="text-5xl mb-3">📊</div>
                  <p className="text-sm font-manrope font-bold text-[#18181B]">Results will appear here</p>
                  <p className="text-xs text-[#A1A1AA] mt-1.5">
                    {needsData && data.length === 0
                      ? 'Load a dataset and configure the analysis, then click Run'
                      : 'Configure the analysis above and click Run'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
