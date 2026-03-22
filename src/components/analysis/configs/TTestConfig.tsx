"use client"

import { VariableSelector } from '../shared/VariableSelector'
import { AnalysisRunButton } from '../shared/AnalysisRunButton'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import type { DatasetColumn } from '@/types/database'

interface Props {
  config: Record<string, unknown>
  onChange: (config: Record<string, unknown>) => void
  onRun: () => void
  loading: boolean
  columns: DatasetColumn[]
}

export function TTestConfig({ config, onChange, onRun, loading, columns }: Props) {
  const testType = (config.testType as string) ?? 'independent'
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Test Type</label>
        <Select value={testType} onValueChange={v => onChange({ ...config, testType: v })}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="independent">Independent Samples</SelectItem>
            <SelectItem value="paired">Paired Samples</SelectItem>
            <SelectItem value="one_sample">One Sample</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <VariableSelector label="Numeric Variable (Outcome)" value={(config.variable as string) ?? ''} onChange={v => onChange({ ...config, variable: v })} columns={columns} required />
      {testType === 'independent' && (
        <VariableSelector label="Grouping Variable (2 levels)" value={(config.groupVariable as string) ?? ''} onChange={v => onChange({ ...config, groupVariable: v })} columns={columns} required />
      )}
      {testType === 'paired' && (
        <VariableSelector label="Paired Variable" value={(config.pairedVariable as string) ?? ''} onChange={v => onChange({ ...config, pairedVariable: v })} columns={columns} required />
      )}
      {testType === 'one_sample' && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Null Hypothesis Mean (μ₀)</label>
          <Input type="number" className="h-8 text-sm" value={String(config.muNull ?? 0)} onChange={e => onChange({ ...config, muNull: parseFloat(e.target.value) })} />
        </div>
      )}
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
      {testType === 'independent' && (
        <div className="flex items-center justify-between">
          <Label className="text-sm">Assume equal variances</Label>
          <Switch checked={!!config.equalVariances} onCheckedChange={v => onChange({ ...config, equalVariances: v })} />
        </div>
      )}
      <AnalysisRunButton onClick={onRun} loading={loading} disabled={!config.variable} />
    </div>
  )
}
