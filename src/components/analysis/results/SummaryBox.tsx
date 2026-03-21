"use client"

import { Badge } from '@/components/ui/badge'
import type { AnalysisType } from '@/types/database'

interface Props {
  analysisType: AnalysisType
  summary: Record<string, unknown>
  title?: string
  datasetName?: string
}

const analysisLabels: Record<AnalysisType, string> = {
  descriptive: 'Descriptive Statistics',
  frequency: 'Frequency Table',
  chi_square: 'Chi-Square Test',
  t_test: 'T-Test',
  anova: 'ANOVA',
  correlation: 'Correlation Analysis',
  simple_regression: 'Simple Linear Regression',
  multiple_regression: 'Multiple Linear Regression',
  logistic_regression: 'Binary Logistic Regression',
  multinomial_regression: 'Multinomial Logistic Regression',
  ordinal_regression: 'Ordinal Logistic Regression',
  poisson_regression: 'Poisson Regression',
  negbinomial_regression: 'Negative Binomial Regression',
  kaplan_meier: 'Kaplan-Meier Survival Analysis',
  cox_regression: 'Cox Proportional Hazards',
  time_series: 'Time Series Analysis',
  pca: 'Principal Component Analysis',
  factor_analysis: 'Factor Analysis',
  cluster_analysis: 'Cluster Analysis',
  meta_analysis: 'Meta-Analysis',
  spatial_analysis: 'Spatial Analysis',
  outbreak_investigation: 'Outbreak Investigation',
  sample_size: 'Sample Size Calculation',
}

export function SummaryBox({ analysisType, summary, title, datasetName }: Props) {
  const pairs = Object.entries(summary).filter(([k]) => k !== 'error')

  return (
    <div className="rounded-lg border bg-muted/30 p-3 mb-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="font-semibold text-sm">{title ?? analysisLabels[analysisType]}</span>
        {datasetName && <Badge variant="outline" className="text-xs">{datasetName}</Badge>}
      </div>
      {summary.error ? (
        <p className="text-xs text-destructive">{String(summary.error)}</p>
      ) : (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {pairs.map(([key, val]) => (
            <span key={key} className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{formatKey(key)}</span>: {String(val)}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function formatKey(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .trim()
    .replace(/^./, c => c.toUpperCase())
}
