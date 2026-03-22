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
    <div className="p-6 max-w-7xl mx-auto">
      {/* Back link */}
      <Link href={`/projects/${projectId}/analysis`}>
        <Button variant="ghost" size="sm" className="mb-4 h-7 text-xs -ml-2">
          <ArrowLeft className="h-3.5 w-3.5 mr-1" />
          Analysis Hub
        </Button>
      </Link>

      <h1 className="text-xl font-bold mb-5">New Analysis</h1>

      {/* Stepper */}
      <div className="flex items-center gap-2 mb-7 text-sm">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <button
              onClick={() => {
                if (i < stepIndex) setStep(s.id)
              }}
              disabled={i > stepIndex}
              className={`flex items-center gap-1.5 font-medium transition-colors ${
                step === s.id
                  ? 'text-[var(--text-primary)]'
                  : i < stepIndex
                  ? 'text-blue-600 hover:underline cursor-pointer'
                  : 'text-[var(--text-tertiary)] cursor-default'
              }`}
            >
              <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs ${
                step === s.id
                  ? 'bg-blue-600 text-white'
                  : i < stepIndex
                  ? 'bg-green-500 text-white'
                  : 'bg-[var(--bg-inset)] text-[var(--text-tertiary)]'
              }`}>
                {i < stepIndex ? '✓' : i + 1}
              </span>
              {s.label}
            </button>
            {i < STEPS.length - 1 && <ChevronRight className="h-4 w-4 text-[var(--text-tertiary)]" />}
          </div>
        ))}
      </div>

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
            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 sticky top-6">
              {/* Header */}
              <div className="flex items-center gap-2 mb-4">
                <button
                  onClick={() => setStep('type')}
                  className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                >
                  ← Change analysis
                </button>
                <span className="text-[var(--text-tertiary)]">|</span>
                <span className="text-sm font-semibold text-[var(--text-primary)]">{typeInfo?.label}</span>
              </div>

              {/* Dataset — shown as read-only info, with option to change */}
              {needsData && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-2">Dataset</p>
                  <ProjectDatasetSelector
                    projectId={projectId}
                    onData={handleData}
                    datasetId={datasetId}
                    versionId={versionId}
                    data={data}
                    fileName={fileName}
                  />
                  {data.length > 0 && (
                    <p className="text-xs text-[var(--text-tertiary)] mt-1">{columns.length} columns available</p>
                  )}
                </div>
              )}

              {/* Config */}
              <div className="border-t border-[var(--border-default)] pt-4">
                <p className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-3">Configuration</p>
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
              <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-inset)]/40 h-full min-h-[300px] flex items-center justify-center">
                <div className="text-center px-6">
                  <div className="text-5xl mb-3">📊</div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">Results will appear here</p>
                  <p className="text-xs text-[var(--text-tertiary)] mt-1">
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
  )
}
