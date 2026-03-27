"use client"

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
      <div className="rounded-lg border border-[#E4E4E7] bg-[#FEF2F2] p-5 mb-6">
        <p className="text-sm font-semibold text-[#991B1B]">Analysis Error</p>
        <p className="text-xs text-[#52525B] mt-1">{String(summary.error)}</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-[#E4E4E7] rounded-lg overflow-hidden mb-6">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#F0F0F0] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-[#EFF6FF] p-2">
            <BarChart2 className="h-4 w-4 text-[#3B82F6]" />
          </div>
          <div>
            <h3 className="font-manrope font-bold text-sm text-[#18181B]">
              {title ?? analysisLabels[analysisType]}
            </h3>
            {datasetName && (
              <p className="text-xs text-[#A1A1AA] mt-0.5">Dataset: {datasetName}</p>
            )}
          </div>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded bg-[#F0FDF4] text-[#166534]">
          Completed
        </span>
      </div>

      {/* Metric Cards Grid */}
      {pairs.length > 0 && (
        <div className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-3.5 w-3.5 text-[#0052CC]" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#A1A1AA]">Key Results</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {pairs.map(([key, val]) => (
              <MetricCard key={key} label={formatKey(key)} value={String(val)} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#F0F0F0] border border-[#E4E4E7] rounded-lg p-3 transition-all duration-150 hover:bg-[#F5F5F5]">
      <p className="text-[9px] font-bold uppercase tracking-widest text-[#A1A1AA] mb-1 truncate" title={label}>
        {label}
      </p>
      <p className="text-base font-manrope font-extrabold text-[#18181B] truncate" title={value}>
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
