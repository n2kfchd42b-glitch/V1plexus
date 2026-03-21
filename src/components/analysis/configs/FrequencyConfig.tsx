"use client"

import { VariableSelector } from '../shared/VariableSelector'
import { AnalysisRunButton } from '../shared/AnalysisRunButton'
import type { DatasetColumn } from '@/types/database'

interface Props {
  config: Record<string, unknown>
  onChange: (config: Record<string, unknown>) => void
  onRun: () => void
  loading: boolean
  columns: DatasetColumn[]
}

export function FrequencyConfig({ config, onChange, onRun, loading, columns }: Props) {
  return (
    <div className="space-y-4">
      <VariableSelector
        label="Row Variable"
        value={(config.rowVariable as string) ?? ''}
        onChange={v => onChange({ ...config, rowVariable: v })}
        columns={columns}
        allowedTypes={['categorical', 'binary']}
        required
      />
      <VariableSelector
        label="Column Variable (optional — creates cross-tab)"
        value={(config.colVariable as string) ?? ''}
        onChange={v => onChange({ ...config, colVariable: v })}
        columns={columns}
        allowedTypes={['categorical', 'binary']}
        placeholder="Leave empty for simple frequency"
      />
      <AnalysisRunButton
        onClick={onRun}
        loading={loading}
        disabled={!config.rowVariable}
      />
    </div>
  )
}
