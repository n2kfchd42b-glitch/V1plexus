"use client"

import { VariableSelector } from '../shared/VariableSelector'
import { AnalysisRunButton } from '../shared/AnalysisRunButton'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import type { DatasetColumn } from '@/types/database'

interface Props {
  config: Record<string, unknown>
  onChange: (config: Record<string, unknown>) => void
  onRun: () => void
  loading: boolean
  columns: DatasetColumn[]
}

export function TimeSeriesConfig({ config, onChange, onRun, loading, columns }: Props) {
  return (
    <div className="space-y-4">
      <VariableSelector label="Date/Time Variable" value={(config.dateVariable as string) ?? ''} onChange={v => onChange({ ...config, dateVariable: v })} columns={columns} required />
      <VariableSelector label="Value Variable" value={(config.valueVariable as string) ?? ''} onChange={v => onChange({ ...config, valueVariable: v })} columns={columns} required />
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Moving Average Window</label>
        <Input type="number" className="h-8 text-sm" min={2} max={52} value={String(config.movingAvgWindow ?? 12)} onChange={e => onChange({ ...config, movingAvgWindow: parseInt(e.target.value) })} />
      </div>
      <div className="flex items-center justify-between">
        <Label className="text-sm">Seasonal decomposition</Label>
        <Switch checked={config.decompose !== false} onCheckedChange={v => onChange({ ...config, decompose: v })} />
      </div>
      <AnalysisRunButton onClick={onRun} loading={loading} disabled={!config.dateVariable || !config.valueVariable} />
    </div>
  )
}
