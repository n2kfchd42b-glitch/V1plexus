"use client"

import { VariableSelector } from '../shared/VariableSelector'
import { MultiVariableSelector } from '../shared/MultiVariableSelector'
import { AnalysisRunButton } from '../shared/AnalysisRunButton'
import type { DatasetColumn } from '@/types/database'

interface Props {
  config: Record<string, unknown>
  onChange: (config: Record<string, unknown>) => void
  onRun: () => void
  loading: boolean
  columns: DatasetColumn[]
  analysisType?: string
}

export function PoissonConfig({ config, onChange, onRun, loading, columns, analysisType }: Props) {
  const predictors = (config.predictors as string[]) ?? []
  const isNegBin = analysisType === 'negbinomial_regression'
  return (
    <div className="space-y-4">
      <VariableSelector label="Count Outcome Variable" value={(config.outcome as string) ?? ''} onChange={v => onChange({ ...config, outcome: v })} columns={columns} required />
      <MultiVariableSelector label="Predictor Variables" value={predictors} onChange={v => onChange({ ...config, predictors: v })} columns={columns} required />
      <VariableSelector label="Offset Variable (optional — for rates)" value={(config.offsetVar as string) ?? ''} onChange={v => onChange({ ...config, offsetVar: v })} columns={columns} placeholder="Leave empty if not needed" />
      <p className="text-xs text-muted-foreground">
        {isNegBin ? 'Negative binomial regression for overdispersed count data.' : 'Poisson regression models count or rate outcomes. Results reported as Incidence Rate Ratios (IRR).'}
      </p>
      <AnalysisRunButton onClick={onRun} loading={loading} disabled={!config.outcome || predictors.length === 0} />
    </div>
  )
}
