"use client"

import { VariableSelector } from '../shared/VariableSelector'
import { AnalysisRunButton } from '../shared/AnalysisRunButton'
import { Input } from '@/components/ui/input'
import type { DatasetColumn } from '@/types/database'

interface Props {
  config: Record<string, unknown>
  onChange: (config: Record<string, unknown>) => void
  onRun: () => void
  loading: boolean
  columns: DatasetColumn[]
}

export function SpatialConfig({ config, onChange, onRun, loading, columns }: Props) {
  return (
    <div className="space-y-4">
      <VariableSelector label="Location Variable (district/region name)" value={(config.locationVariable as string) ?? ''} onChange={v => onChange({ ...config, locationVariable: v })} columns={columns} required />
      <VariableSelector label="Value Variable (cases, rates, prevalence)" value={(config.valueVariable as string) ?? ''} onChange={v => onChange({ ...config, valueVariable: v })} columns={columns} allowedTypes={['numeric']} required />
      <VariableSelector label="Population Variable (optional — for rates)" value={(config.populationVariable as string) ?? ''} onChange={v => onChange({ ...config, populationVariable: v })} columns={columns} allowedTypes={['numeric']} placeholder="Optional" />
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Rate Denominator</label>
        <Input type="number" className="h-8 text-sm" placeholder="e.g. 1000 or 100000" value={String(config.rateDenominator ?? 1000)} onChange={e => onChange({ ...config, rateDenominator: parseInt(e.target.value) })} />
      </div>
      <p className="text-xs text-muted-foreground">Note: Full choropleth mapping requires GeoJSON boundary files. Summary statistics will be computed regardless.</p>
      <AnalysisRunButton onClick={onRun} loading={loading} disabled={!config.locationVariable || !config.valueVariable} />
    </div>
  )
}
