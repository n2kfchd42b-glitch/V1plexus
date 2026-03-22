"use client"

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

export function CorrelationConfig({ config, onChange, onRun, loading, columns }: Props) {
  const variables = (config.variables as string[]) ?? []
  return (
    <div className="space-y-4">
      <MultiVariableSelector label="Variables" value={variables} onChange={v => onChange({ ...config, variables: v })} columns={columns} required />
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Method</label>
        <Select value={(config.method as string) ?? 'pearson'} onValueChange={v => onChange({ ...config, method: v })}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pearson">Pearson</SelectItem>
            <SelectItem value="spearman">Spearman</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">P-value Adjustment</label>
        <Select value={(config.pAdjustment as string) ?? 'none'} onValueChange={v => onChange({ ...config, pAdjustment: v })}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="bonferroni">Bonferroni</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <AnalysisRunButton onClick={onRun} loading={loading} disabled={variables.length < 2} />
    </div>
  )
}
