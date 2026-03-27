"use client"

import { Badge } from '@/components/ui/badge'
import { BarChart2, TrendingUp } from 'lucide-react'
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

  if (summary.error) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 mb-6">
        <p className="text-sm font-semibold text-destructive">Analysis Error</p>
        <p className="text-xs text-destructive/80 mt-1">{String(summary.error)}</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-white border shadow-sm overflow-hidden mb-6">
      {/* Header */}
      <div className="px-6 py-4 border-b bg-gradient-to-r from-slate-50 to-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5">
              <BarChart2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-base text-foreground">
                {title ?? analysisLabels[analysisType]}
              </h3>
              {datasetName && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Dataset: {datasetName}
                </p>
              )}
            </div>
          </div>
          <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
            Completed
          </Badge>
        </div>
      </div>

      {/* Metric Cards Grid */}
      {pairs.length > 0 && (
        <div className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-3.5 w-3.5 text-primary" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Key Results
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {pairs.map(([key, val], i) => (
              <MetricCard key={key} label={formatKey(key)} value={String(val)} index={i} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function MetricCard({ label, value, index }: { label: string; value: string; index: number }) {
  const colors = [
    'from-blue-50 to-blue-50/30 border-blue-100',
    'from-indigo-50 to-indigo-50/30 border-indigo-100',
    'from-violet-50 to-violet-50/30 border-violet-100',
    'from-cyan-50 to-cyan-50/30 border-cyan-100',
    'from-emerald-50 to-emerald-50/30 border-emerald-100',
    'from-amber-50 to-amber-50/30 border-amber-100',
  ]

  return (
    <div className={`rounded-xl border bg-gradient-to-br ${colors[index % colors.length]} p-3.5 transition-all hover:shadow-sm`}>
      <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1 truncate" title={label}>
        {label}
      </p>
      <p className="text-lg font-extrabold text-foreground truncate" title={value}>
        {value}
      </p>
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
