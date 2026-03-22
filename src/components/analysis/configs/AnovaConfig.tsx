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

export function AnovaConfig({ config, onChange, onRun, loading, columns }: Props) {
  return (
    <div className="space-y-4">
      <VariableSelector label="Dependent Variable (numeric)" value={(config.dependent as string) ?? ''} onChange={v => onChange({ ...config, dependent: v })} columns={columns} required />
      <VariableSelector label="Factor 1 (group variable)" value={(config.factor1 as string) ?? ''} onChange={v => onChange({ ...config, factor1: v })} columns={columns} required />
      <VariableSelector label="Factor 2 (optional — makes Two-Way ANOVA)" value={(config.factor2 as string) ?? ''} onChange={v => onChange({ ...config, factor2: v })} columns={columns} placeholder="Leave empty for One-Way ANOVA" />
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Post-Hoc Test</label>
        <Select value={(config.posthoc as string) ?? 'tukey'} onValueChange={v => onChange({ ...config, posthoc: v })}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="tukey">Tukey HSD</SelectItem>
            <SelectItem value="bonferroni">Bonferroni</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <AnalysisRunButton onClick={onRun} loading={loading} disabled={!config.dependent || !config.factor1} />
    </div>
  )
}
