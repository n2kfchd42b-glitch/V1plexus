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

export function MultipleRegressionConfig({ config, onChange, onRun, loading, columns }: Props) {
  const independents = (config.independents as string[]) ?? []
  return (
    <div className="space-y-4">
      <VariableSelector label="Dependent Variable" value={(config.dependent as string) ?? ''} onChange={v => onChange({ ...config, dependent: v })} columns={columns} allowedTypes={['numeric']} required />
      <MultiVariableSelector label="Independent Variables (numeric + categorical)" value={independents} onChange={v => onChange({ ...config, independents: v })} columns={columns} allowedTypes={['numeric', 'categorical', 'binary']} required />
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
      <AnalysisRunButton onClick={onRun} loading={loading} disabled={!config.dependent || independents.length === 0} />
    </div>
  )
}
