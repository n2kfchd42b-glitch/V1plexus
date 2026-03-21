"use client"

import { MultiVariableSelector } from '../shared/MultiVariableSelector'
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

export function PCAConfig({ config, onChange, onRun, loading, columns }: Props) {
  const variables = (config.variables as string[]) ?? []
  return (
    <div className="space-y-4">
      <MultiVariableSelector label="Numeric Variables" value={variables} onChange={v => onChange({ ...config, variables: v })} columns={columns} allowedTypes={['numeric']} required />
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Number of Components</label>
        <Input type="number" className="h-8 text-sm" min={2} max={Math.min(variables.length, 10)} value={String(config.nComponents ?? 2)} onChange={e => onChange({ ...config, nComponents: parseInt(e.target.value) })} />
      </div>
      <div className="flex items-center justify-between">
        <Label className="text-sm">Standardize variables (recommended)</Label>
        <Switch checked={config.standardize !== false} onCheckedChange={v => onChange({ ...config, standardize: v })} />
      </div>
      <AnalysisRunButton onClick={onRun} loading={loading} disabled={variables.length < 2} />
    </div>
  )
}
