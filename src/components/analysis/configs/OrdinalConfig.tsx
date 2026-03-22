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
}

export function OrdinalConfig({ config, onChange, onRun, loading, columns }: Props) {
  const predictors = (config.predictors as string[]) ?? []
  return (
    <div className="space-y-4">
      <VariableSelector label="Ordinal Outcome Variable" value={(config.outcome as string) ?? ''} onChange={v => onChange({ ...config, outcome: v })} columns={columns} required />
      <MultiVariableSelector label="Predictor Variables" value={predictors} onChange={v => onChange({ ...config, predictors: v })} columns={columns} required />
      <p className="text-xs text-muted-foreground">Proportional odds logistic regression for ordinal outcomes (e.g., severity: mild/moderate/severe).</p>
      <AnalysisRunButton onClick={onRun} loading={loading} disabled={!config.outcome || predictors.length === 0} />
    </div>
  )
}
