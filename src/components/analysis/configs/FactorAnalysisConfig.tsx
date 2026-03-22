"use client"

import { MultiVariableSelector } from '../shared/MultiVariableSelector'
import { AnalysisRunButton } from '../shared/AnalysisRunButton'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { DatasetColumn } from '@/types/database'

interface Props {
  config: Record<string, unknown>
  onChange: (config: Record<string, unknown>) => void
  onRun: () => void
  loading: boolean
  columns: DatasetColumn[]
}

export function FactorAnalysisConfig({ config, onChange, onRun, loading, columns }: Props) {
  const variables = (config.variables as string[]) ?? []
  return (
    <div className="space-y-4">
      <MultiVariableSelector label="Variables" value={variables} onChange={v => onChange({ ...config, variables: v })} columns={columns} required />
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Number of Factors</label>
        <Input type="number" className="h-8 text-sm" min={1} max={Math.min(variables.length, 10)} value={String(config.nFactors ?? 3)} onChange={e => onChange({ ...config, nFactors: parseInt(e.target.value) })} />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Rotation</label>
        <Select value={(config.rotation as string) ?? 'varimax'} onValueChange={v => onChange({ ...config, rotation: v })}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="varimax">Varimax (orthogonal)</SelectItem>
            <SelectItem value="promax">Promax (oblique)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <AnalysisRunButton onClick={onRun} loading={loading} disabled={variables.length < 3} />
    </div>
  )
}
