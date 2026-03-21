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

export function MetaAnalysisConfig({ config, onChange, onRun, loading, columns }: Props) {
  return (
    <div className="space-y-4">
      <VariableSelector label="Effect Size Column (OR, RR, MD, etc.)" value={(config.effectSizeVar as string) ?? ''} onChange={v => onChange({ ...config, effectSizeVar: v })} columns={columns} allowedTypes={['numeric']} required />
      <VariableSelector label="Standard Error Column" value={(config.seVar as string) ?? ''} onChange={v => onChange({ ...config, seVar: v })} columns={columns} allowedTypes={['numeric']} placeholder="Or provide CI columns below" />
      <VariableSelector label="CI Lower Bound Column (alternative to SE)" value={(config.ciLowVar as string) ?? ''} onChange={v => onChange({ ...config, ciLowVar: v })} columns={columns} allowedTypes={['numeric']} placeholder="Optional if SE provided" />
      <VariableSelector label="CI Upper Bound Column" value={(config.ciHighVar as string) ?? ''} onChange={v => onChange({ ...config, ciHighVar: v })} columns={columns} allowedTypes={['numeric']} placeholder="Optional if SE provided" />
      <VariableSelector label="Study Label Column" value={(config.studyLabelVar as string) ?? ''} onChange={v => onChange({ ...config, studyLabelVar: v })} columns={columns} required />
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Model</label>
        <Select value={(config.model as string) ?? 'random'} onValueChange={v => onChange({ ...config, model: v })}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="random">Random Effects (DerSimonian-Laird)</SelectItem>
            <SelectItem value="fixed">Fixed Effect (Inverse-Variance)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <AnalysisRunButton onClick={onRun} loading={loading} disabled={!config.effectSizeVar || !config.studyLabelVar || (!config.seVar && !config.ciLowVar)} />
    </div>
  )
}
