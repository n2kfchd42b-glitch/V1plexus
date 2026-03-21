"use client"

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { AnalysisTypePicker, ANALYSIS_TYPES } from '@/components/analysis/AnalysisTypePicker'
import { DatasetUploader } from '@/components/analysis/DatasetUploader'
import { ResultsPanel } from '@/components/analysis/results/ResultsPanel'
import { runAnalysis } from '@/lib/analysis/engine'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import type { AnalysisType, DatasetColumn } from '@/types/database'
import type { DataRow, AnalysisResult } from '@/lib/analysis/engine'

// Dynamic config component loader
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

type Step = 'type' | 'config'

const STEPS: { id: Step; label: string }[] = [
  { id: 'type', label: 'Choose Analysis' },
  { id: 'config', label: 'Configure & Run' },
]

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
    case 'descriptive': return <DescriptiveConfig {...props} />
    case 'frequency': return <FrequencyConfig {...props} />
    case 'chi_square': return <ChiSquareConfig {...props} />
    case 't_test': return <TTestConfig {...props} />
    case 'anova': return <AnovaConfig {...props} />
    case 'correlation': return <CorrelationConfig {...props} />
    case 'simple_regression': return <SimpleRegressionConfig {...props} />
    case 'multiple_regression': return <MultipleRegressionConfig {...props} />
    case 'logistic_regression': return <LogisticRegressionConfig {...props} />
    case 'multinomial_regression': return <MultinomialConfig {...props} />
    case 'ordinal_regression': return <OrdinalConfig {...props} />
    case 'poisson_regression': case 'negbinomial_regression': return <PoissonConfig {...props} analysisType={type} />
    case 'kaplan_meier': return <KaplanMeierConfig {...props} />
    case 'cox_regression': return <CoxConfig {...props} />
    case 'time_series': return <TimeSeriesConfig {...props} />
    case 'pca': return <PCAConfig {...props} />
    case 'factor_analysis': return <FactorAnalysisConfig {...props} />
    case 'cluster_analysis': return <ClusterConfig {...props} />
    case 'meta_analysis': return <MetaAnalysisConfig {...props} />
    case 'spatial_analysis': return <SpatialConfig {...props} />
    case 'outbreak_investigation': return <OutbreakConfig {...props} />
    case 'sample_size': return <SampleSizeConfig {...props} />
    default: return <p className="text-sm text-muted-foreground">Configuration not available</p>
  }
}

export default function NewAnalysisPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string
  const { profile } = useAuth()
  const supabase = createClient()

  const [step, setStep] = useState<Step>('type')
  const [selectedType, setSelectedType] = useState<AnalysisType | null>(null)
  const [config, setConfig] = useState<Record<string, unknown>>({})
  const [data, setData] = useState<DataRow[]>([])
  const [columns, setColumns] = useState<DatasetColumn[]>([])
  const [fileName, setFileName] = useState<string>('')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [savedRunId, setSavedRunId] = useState<string | null>(null)

  const handleTypeSelect = (type: AnalysisType) => {
    setSelectedType(type)
    setResult(null)
    setConfig({})
  }

  const handleNextStep = () => {
    if (selectedType) setStep('config')
  }

  const handleData = (rows: DataRow[], cols: DatasetColumn[], name: string) => {
    setData(rows)
    setColumns(cols)
    setFileName(name)
    setResult(null)
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
        interpretation: 'Analysis failed.'
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
        project_id: projectId,
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

  const typeInfo = selectedType ? ANALYSIS_TYPES.find(t => t.type === selectedType) : null
  const needsData = selectedType !== 'sample_size'

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link href={`/projects/${projectId}/analysis`}>
          <Button variant="ghost" size="sm" className="mb-3 h-7 text-xs -ml-2">
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            Analysis Hub
          </Button>
        </Link>
        <h1 className="text-xl font-bold">New Analysis</h1>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 mb-6 text-sm">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <button
              onClick={() => s.id === 'type' && setStep('type')}
              className={`font-medium transition-colors ${step === s.id ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs mr-1.5 ${step === s.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{i + 1}</span>
              {s.label}
            </button>
            {i < STEPS.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        ))}
      </div>

      {/* Step 1: Type Picker */}
      {step === 'type' && (
        <div>
          <AnalysisTypePicker selected={selectedType} onSelect={handleTypeSelect} />
          {selectedType && (
            <div className="mt-4 flex justify-end">
              <Button onClick={handleNextStep}>
                Continue with {typeInfo?.label}
                <ChevronRight className="h-4 w-4 ml-1.5" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Config + Run */}
      {step === 'config' && selectedType && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left: Config */}
          <div className="lg:col-span-2">
            <div className="rounded-lg border p-4 sticky top-6">
              <div className="flex items-center gap-2 mb-4">
                <button onClick={() => setStep('type')} className="text-xs text-muted-foreground hover:text-foreground">← Change type</button>
                <span className="text-muted-foreground">|</span>
                <span className="text-sm font-semibold">{typeInfo?.label}</span>
              </div>

              {needsData && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Dataset</p>
                  <DatasetUploader onData={handleData} data={data} fileName={fileName} />
                  {data.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">{columns.length} columns detected</p>
                  )}
                </div>
              )}

              <div className="border-t pt-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Configuration</p>
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

          {/* Right: Results */}
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
              <div className="rounded-lg border bg-muted/10 h-full min-h-[300px] flex items-center justify-center">
                <div className="text-center">
                  <div className="text-4xl mb-3">📊</div>
                  <p className="text-sm font-medium">Results will appear here</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {needsData && data.length === 0
                      ? 'Upload a CSV file and configure the analysis'
                      : 'Configure the analysis and click Run'}
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
