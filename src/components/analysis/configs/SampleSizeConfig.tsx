"use client"

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

const field = (label: string, key: string, value: number, onChange: (v: number) => void, step = 0.01) => (
  <div className="space-y-1.5" key={key}>
    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</label>
    <Input type="number" className="h-8 text-sm" step={step} value={value} onChange={e => onChange(parseFloat(e.target.value) || 0)} />
  </div>
)

export function SampleSizeConfig({ config, onChange, onRun, loading }: Props) {
  const design = (config.design as string) ?? 'cross_sectional'
  const upd = (key: string) => (v: number) => onChange({ ...config, [key]: v })

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Study Design</label>
        <Select value={design} onValueChange={v => onChange({ ...config, design: v })}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="cross_sectional">Cross-Sectional</SelectItem>
            <SelectItem value="cohort">Cohort Study</SelectItem>
            <SelectItem value="case_control">Case-Control</SelectItem>
            <SelectItem value="rct">RCT</SelectItem>
            <SelectItem value="cluster_rct">Cluster RCT</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {(design === 'cross_sectional') && field('Expected Prevalence (0–1)', 'prevalence', config.prevalence as number ?? 0.5, upd('prevalence'))}
      {(design === 'cross_sectional') && field('Acceptable Margin of Error (d)', 'expectedDiff', config.expectedDiff as number ?? 0.05, upd('expectedDiff'))}
      {(design === 'cohort' || design === 'rct') && field('Expected Prevalence in Control Group', 'prevalence', config.prevalence as number ?? 0.5, upd('prevalence'))}
      {(design === 'cohort' || design === 'rct') && field('Expected Difference between Groups', 'expectedDiff', config.expectedDiff as number ?? 0.1, upd('expectedDiff'))}
      {design === 'case_control' && field('Prevalence in Controls (0–1)', 'prevalence', config.prevalence as number ?? 0.3, upd('prevalence'))}
      {design === 'case_control' && field('Expected Odds Ratio', 'effectSize', config.effectSize as number ?? 2.0, upd('effectSize'), 0.1)}
      {design === 'cluster_rct' && field('Expected Effect Size (Cohen\'s d)', 'effectSize', config.effectSize as number ?? 0.5, upd('effectSize'), 0.1)}

      {field('Alpha (significance level)', 'alpha', config.alpha as number ?? 0.05, upd('alpha'))}
      {field('Power (1-β)', 'power', config.power as number ?? 0.80, upd('power'))}
      {field('Group Ratio (n₂/n₁)', 'ratio', config.ratio as number ?? 1, upd('ratio'), 0.1)}
      {(design === 'cluster_rct') && field('Design Effect (DEFF)', 'designEffect', config.designEffect as number ?? 1.5, upd('designEffect'), 0.1)}
      {field('Expected Dropout Rate (0–1)', 'dropoutRate', config.dropoutRate as number ?? 0, upd('dropoutRate'))}

      <AnalysisRunButton onClick={onRun} loading={loading} />
    </div>
  )
}
