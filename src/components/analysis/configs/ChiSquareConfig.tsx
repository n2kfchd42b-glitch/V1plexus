"use client"

import { VariableSelector } from '../shared/VariableSelector'
import { AnalysisRunButton } from '../shared/AnalysisRunButton'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { DatasetColumn } from '@/types/database'

interface Props {
  config: Record<string, unknown>
  onChange: (config: Record<string, unknown>) => void
  onRun: () => void
  loading: boolean
  columns: DatasetColumn[]
}

export function ChiSquareConfig({ config, onChange, onRun, loading, columns }: Props) {
  return (
    <div className="space-y-4">
      <VariableSelector label="Variable 1" value={(config.variable1 as string) ?? ''} onChange={v => onChange({ ...config, variable1: v })} columns={columns} required />
      <VariableSelector label="Variable 2" value={(config.variable2 as string) ?? ''} onChange={v => onChange({ ...config, variable2: v })} columns={columns} required />
      <div className="flex items-center justify-between">
        <Label className="text-sm">Yates&apos; continuity correction (2×2 only)</Label>
        <Switch checked={!!config.yatesCorrection} onCheckedChange={v => onChange({ ...config, yatesCorrection: v })} />
      </div>
      <AnalysisRunButton onClick={onRun} loading={loading} disabled={!config.variable1 || !config.variable2} />
    </div>
  )
}
