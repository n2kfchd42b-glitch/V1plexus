"use client"

import { MultiVariableSelector } from '../shared/MultiVariableSelector'
import { AnalysisRunButton } from '../shared/AnalysisRunButton'
import type { DatasetColumn } from '@/types/database'

interface Props {
  config: Record<string, unknown>
  onChange: (config: Record<string, unknown>) => void
  onRun: () => void
  loading: boolean
  columns: DatasetColumn[]
}

export function DescriptiveConfig({ config, onChange, onRun, loading, columns }: Props) {
  const variables = (config.variables as string[]) ?? []
  return (
    <div className="space-y-4">
      <MultiVariableSelector
        label="Variables"
        value={variables}
        onChange={v => onChange({ ...config, variables: v })}
        columns={columns}
      />
      {variables.length === 0 && (
        <p className="text-[11px]" style={{ color: 'var(--text-tertiary)', marginTop: '-8px' }}>
          Leave empty to describe all variables
        </p>
      )}
      <AnalysisRunButton onClick={onRun} loading={loading} />
    </div>
  )
}
