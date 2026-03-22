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

export function CoxConfig({ config, onChange, onRun, loading, columns }: Props) {
  const predictors = (config.predictors as string[]) ?? []
  return (
    <div className="space-y-4">
      <VariableSelector label="Time Variable" value={(config.timeVariable as string) ?? ''} onChange={v => onChange({ ...config, timeVariable: v })} columns={columns} required />
      <VariableSelector label="Event Variable (1=event, 0=censored)" value={(config.eventVariable as string) ?? ''} onChange={v => onChange({ ...config, eventVariable: v })} columns={columns} required />
      <MultiVariableSelector label="Predictor Variables" value={predictors} onChange={v => onChange({ ...config, predictors: v })} columns={columns} required />
      <p className="text-xs text-muted-foreground">Results reported as Hazard Ratios (HR) with 95% CIs. Concordance index measures model discrimination.</p>
      <AnalysisRunButton onClick={onRun} loading={loading} disabled={!config.timeVariable || !config.eventVariable || predictors.length === 0} />
    </div>
  )
}
