import type { AnalysisResult } from './analysis/types'

// ─── Variable data shapes ─────────────────────────────────────────────────────

export interface ContVar {
  name: string
  n: number
  missing: number
  mean: string
  sd: string
  median: string
  iqr: string
  type: 'continuous'
}

export interface CatVar {
  name: string
  n: number
  missing: number
  categories: { label: string; count: number; pct: string }[]
  type: 'categorical'
}

export type TableVar = ContVar | CatVar

export type FormatOption = 'mean_sd' | 'median_iqr'

// ─── Stored table spec (JSON attr in TipTap node) ────────────────────────────

export interface GeneratedTableSpec {
  title: string
  totalN: number
  footnote: string
  variables: TableVar[]
  format: FormatOption
}

// ─── Parse descriptive result ─────────────────────────────────────────────────

export function parseDescriptiveResult(result: AnalysisResult): {
  continuous: ContVar[]
  categorical: CatVar[]
  totalN: number
} {
  const continuous: ContVar[] = []
  const categorical: CatVar[] = []
  const totalN = (result.summary?.n as number) ?? 0

  // Continuous: from numeric_summary table
  // headers: ['Variable','N','Missing','Mean','SD','Median','IQR','Min','Max','Skewness','Kurtosis']
  const numericTable = result.tables.find(t => t.id === 'numeric_summary')
  if (numericTable) {
    for (const row of numericTable.rows) {
      continuous.push({
        name: String(row[0] ?? ''),
        n: Number(row[1] ?? 0),
        missing: Number(row[2] ?? 0),
        mean: String(row[3] ?? ''),
        sd: String(row[4] ?? ''),
        median: String(row[5] ?? ''),
        iqr: String(row[6] ?? ''),
        type: 'continuous',
      })
    }
  }

  // Categorical: from categorical_summary table + bar chart data for category breakdown
  // headers: ['Variable','N','Missing','Unique Values','Mode','Mode Freq (%)']
  const catTable = result.tables.find(t => t.id === 'categorical_summary')
  if (catTable) {
    for (const row of catTable.rows) {
      const varName = String(row[0] ?? '')
      const n = Number(row[1] ?? 0)
      const missing = Number(row[2] ?? 0)

      // Get per-category breakdown from the bar chart emitted by the descriptive engine
      const barChart = result.charts.find(
        c => (c as { type: string; title: string }).title === `Frequency: ${varName}`
      ) as { data: { value: string | number; count: number; percent: string | number }[] } | undefined

      let categories: { label: string; count: number; pct: string }[] = []
      if (barChart && Array.isArray(barChart.data)) {
        categories = barChart.data.map(d => ({
          label: String(d.value),
          count: Number(d.count),
          pct: String(d.percent),
        }))
      }

      categorical.push({ name: varName, n, missing, categories, type: 'categorical' })
    }
  }

  return { continuous, categorical, totalN }
}

// ─── Format helpers ───────────────────────────────────────────────────────────

export function formatContValue(v: ContVar, format: FormatOption): string {
  if (format === 'mean_sd') return `${v.mean} (${v.sd})`
  return `${v.median} [${v.iqr}]`
}

export function generateFootnote(
  hasContinuous: boolean,
  format: FormatOption,
  hasCategorical: boolean,
): string {
  const parts: string[] = []
  if (hasContinuous) parts.push(format === 'mean_sd' ? 'Mean (SD)' : 'Median [IQR]')
  if (hasCategorical) parts.push('n (%)')
  return parts.join('; ')
}
