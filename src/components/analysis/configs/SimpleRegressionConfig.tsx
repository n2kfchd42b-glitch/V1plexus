"use client"

import { VariableSelector } from '../shared/VariableSelector'
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

export function SimpleRegressionConfig({ config, onChange, onRun, loading, columns }: Props) {
  return (
    <div className="space-y-4">
      <VariableSelector label="Dependent Variable (Y)" value={(config.dependent as string) ?? ''} onChange={v => onChange({ ...config, dependent: v })} columns={columns} allowedTypes={['numeric']} required />
      <VariableSelector label="Independent Variable (X)" value={(config.independent as string) ?? ''} onChange={v => onChange({ ...config, independent: v })} columns={columns} allowedTypes={['numeric']} required />
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
      <AnalysisRunButton onClick={onRun} loading={loading} disabled={!config.dependent || !config.independent} />
    </div>
  )
}
