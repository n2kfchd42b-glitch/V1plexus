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

export function OutbreakConfig({ config, onChange, onRun, loading, columns }: Props) {
  const exposures = (config.exposures as string[]) ?? []
  return (
    <div className="space-y-4">
      <VariableSelector label="Onset Date Variable" value={(config.dateVariable as string) ?? ''} onChange={v => onChange({ ...config, dateVariable: v })} columns={columns} allowedTypes={['date', 'text']} required />
      <VariableSelector label="Case Classification Variable (optional)" value={(config.caseClassVariable as string) ?? ''} onChange={v => onChange({ ...config, caseClassVariable: v })} columns={columns} allowedTypes={['categorical']} placeholder="Leave empty if not available" />
      <VariableSelector label="Location Variable (optional)" value={(config.locationVariable as string) ?? ''} onChange={v => onChange({ ...config, locationVariable: v })} columns={columns} placeholder="For spot map" />
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Epidemic Curve Interval</label>
        <Select value={(config.interval as string) ?? 'day'} onValueChange={v => onChange({ ...config, interval: v })}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Daily</SelectItem>
            <SelectItem value="week">Weekly</SelectItem>
            <SelectItem value="2week">2-Weekly</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <VariableSelector label="Outcome Variable (for attack rates)" value={(config.outcomeVariable as string) ?? ''} onChange={v => onChange({ ...config, outcomeVariable: v })} columns={columns} allowedTypes={['binary']} placeholder="Optional — for 2×2 tables" />
      {!!config.outcomeVariable && (
        <MultiVariableSelector label="Exposure Variables (for attack rate tables)" value={exposures} onChange={v => onChange({ ...config, exposures: v })} columns={columns} allowedTypes={['binary', 'categorical']} />
      )}
      <AnalysisRunButton onClick={onRun} loading={loading} disabled={!config.dateVariable} />
    </div>
  )
}
