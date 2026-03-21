"use client"

import { SummaryBox } from './SummaryBox'
import { CoefficientTable } from './CoefficientTable'
import { InterpretationBox } from './InterpretationBox'
import { ResultsActions } from './ResultsActions'
import { AnalysisCharts } from './AnalysisCharts'
import type { AnalysisResult } from '@/lib/analysis/types'
import type { AnalysisType } from '@/types/database'

interface Props {
  result: AnalysisResult
  analysisType: AnalysisType
  title?: string
  datasetName?: string
  onSave: () => Promise<void>
  isSaved?: boolean
}

export function ResultsPanel({ result, analysisType, title, datasetName, onSave, isSaved }: Props) {
  if (result.summary?.error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
        <p className="text-sm font-medium text-destructive">Analysis Error</p>
        <p className="text-sm text-muted-foreground mt-1">{String(result.summary.error)}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <SummaryBox analysisType={analysisType} summary={result.summary} title={title} datasetName={datasetName} />

      {result.tables.length > 0 && (
        <div className="space-y-4">
          {result.tables.map(table => (
            <CoefficientTable key={table.id} table={table} />
          ))}
        </div>
      )}

      {result.charts.length > 0 && (
        <div className="rounded-lg border p-4">
          <h3 className="text-sm font-semibold mb-4">Visualizations</h3>
          <AnalysisCharts charts={result.charts as Parameters<typeof AnalysisCharts>[0]['charts']} />
        </div>
      )}

      {result.interpretation && (
        <InterpretationBox text={result.interpretation} />
      )}

      <ResultsActions onSave={onSave} saved={isSaved} />
    </div>
  )
}
