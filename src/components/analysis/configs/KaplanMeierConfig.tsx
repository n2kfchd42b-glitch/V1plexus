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

export function KaplanMeierConfig({ config, onChange, onRun, loading, columns }: Props) {
  return (
    <div className="space-y-4">
      <VariableSelector label="Time Variable" value={(config.timeVariable as string) ?? ''} onChange={v => onChange({ ...config, timeVariable: v })} columns={columns} allowedTypes={['numeric']} required />
      <VariableSelector label="Event Variable (1=event, 0=censored)" value={(config.eventVariable as string) ?? ''} onChange={v => onChange({ ...config, eventVariable: v })} columns={columns} allowedTypes={['binary', 'numeric']} required />
      <VariableSelector label="Group Variable (optional — for comparison)" value={(config.groupVariable as string) ?? ''} onChange={v => onChange({ ...config, groupVariable: v })} columns={columns} allowedTypes={['categorical', 'binary']} placeholder="Leave empty for single curve" />
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
      <AnalysisRunButton onClick={onRun} loading={loading} disabled={!config.timeVariable || !config.eventVariable} />
    </div>
  )
}
