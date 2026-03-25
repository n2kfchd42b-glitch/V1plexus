// Analysis engine types

export interface DataRow {
  [key: string]: string | number | null | undefined
}

export interface AnalysisConfig {
  [key: string]: unknown
}

export interface AnalysisResult {
  type: string
  summary: Record<string, unknown>
  tables: ResultTable[]
  charts: ChartSpec[]
  interpretation: string
  plainLanguage?: string   // Lay-friendly summary for clinicians / non-statisticians
  diagnostics?: Record<string, unknown>
}

export interface ResultTable {
  id: string
  title: string
  headers: string[]
  rows: (string | number | null)[][]
  footnotes?: string[]
  advanced?: boolean  // Hidden by default; shown when user expands "Advanced Statistics"
}

export interface ChartSpec {
  type: string
  title: string
  data: unknown[] | unknown
  config: Record<string, unknown>
}

export interface StatSummary {
  n: number
  missing: number
  mean?: number
  sd?: number
  median?: number
  q1?: number
  q3?: number
  min?: number
  max?: number
  skewness?: number
  kurtosis?: number
}

export interface CoefficientRow {
  variable: string
  estimate: number
  se: number
  statistic: number
  pValue: number
  ciLow: number
  ciHigh: number
  or?: number          // for logistic
  hr?: number          // for cox
  irr?: number         // for poisson
  significance: string
}

export interface FrequencyRow {
  value: string | number
  count: number
  percent: number
  cumulativePercent: number
}
