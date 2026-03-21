"use client"

import { VariableSelector } from '../shared/VariableSelector'
import { MultiVariableSelector } from '../shared/MultiVariableSelector'
import { AnalysisRunButton } from '../shared/AnalysisRunButton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { DatasetColumn } from '@/types/database'

interface Props {
  config: Record<string, unknown>
  onChange: (config: Record<string, unknown>) => void
  onRun: () => void
  loading: boolean
  columns: DatasetColumn[]
}

export function LogisticRegressionConfig({ config, onChange, onRun, loading, columns }: Props) {
  const predictors = (config.predictors as string[]) ?? []
  return (
    <div className="space-y-4">
      <VariableSelector label="Outcome Variable (binary: 0/1)" value={(config.outcome as string) ?? ''} onChange={v => onChange({ ...config, outcome: v })} columns={columns} allowedTypes={['binary', 'categorical']} required />
      <MultiVariableSelector label="Predictor Variables" value={predictors} onChange={v => onChange({ ...config, predictors: v })} columns={columns} allowedTypes={['numeric', 'categorical', 'binary']} required />
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Confidence Level</label>
        <Select value={String(config.confidenceLevel ?? 0.95)} onValueChange={v => onChange({ ...config, confidenceLevel: parseFloat(v) })}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="0.90">90%</SelectItem>
            <SelectItem value="0.95">95%</SelectItem>
            <SelectItem value="0.99">99%</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <AnalysisRunButton onClick={onRun} loading={loading} disabled={!config.outcome || predictors.length === 0} />
    </div>
  )
}
