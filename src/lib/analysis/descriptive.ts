import type { DataRow, AnalysisResult, ResultTable } from './types'
import {
  getNumericValues, getCategoricalValues, countMissing,
  mean, sd, median, percentile, skewness, kurtosis, fmt, countFrequencies
} from './utils'

export interface DescriptiveConfig {
  variables: string[]
  includeMissing: boolean
  percentiles: number[]
}

export function runDescriptive(data: DataRow[], config: DescriptiveConfig): AnalysisResult {
  // When no variables are specified, describe all columns in the dataset
  const variables = config.variables?.length > 0
    ? config.variables
    : data.length > 0 ? Object.keys(data[0]) : []

  const tables: ResultTable[] = []
  const chartData: unknown[] = []

  // Numeric summary table
  // A variable is continuous only if it has >10 unique values — otherwise treat as categorical
  // (handles coded variables like 1=Male, 2=Female, 3=Other)
  const numericVars = variables.filter(v => {
    const vals = getNumericValues(data, v)
    if (vals.length === 0) return false
    const unique = new Set(vals)
    return unique.size > 10
  })

  const catVars = variables.filter(v => {
    const vals = getNumericValues(data, v)
    if (vals.length === 0) return true
    const unique = new Set(vals)
    return unique.size <= 10
  })

  if (numericVars.length > 0) {
    const headers = ['Variable', 'N', 'Missing', 'Mean', 'SD', 'Median', 'IQR', 'Min', 'Max', 'Skewness', 'Kurtosis']
    const rows: (string | number | null)[][] = numericVars.map(v => {
      const vals = getNumericValues(data, v)
      const missing = countMissing(data, v)
      const q1 = percentile(vals, 25)
      const q3 = percentile(vals, 75)
      const m = mean(vals)
      return [
        v,
        vals.length,
        missing,
        fmt(m),
        fmt(sd(vals)),
        fmt(median(vals)),
        `${fmt(q1, 1)} – ${fmt(q3, 1)}`,
        fmt(Math.min(...vals)),
        fmt(Math.max(...vals)),
        fmt(skewness(vals)),
        fmt(kurtosis(vals)),
      ]
    })

    tables.push({ id: 'numeric_summary', title: 'Numeric Variable Summary', headers, rows })

    // Chart data for histograms
    for (const v of numericVars) {
      const vals = getNumericValues(data, v)
      const bins = createHistogramBins(vals, 20)
      chartData.push({ type: 'histogram', title: `Distribution: ${v}`, data: bins, config: {} })
    }
  }

  // Categorical summary table — one row per category level (Table 1 style)
  if (catVars.length > 0) {
    const headers = ['Variable', 'Category', 'N', '%', 'Missing']
    const rows: (string | number | null)[][] = []
    for (const v of catVars) {
      const vals = getCategoricalValues(data, v)
      const missing = countMissing(data, v)
      const freq = countFrequencies(vals)
      const sorted = [...freq.entries()].sort((a, b) => {
        // Numeric-sort if both keys are numeric strings, else alpha
        const an = Number(a[0]), bn = Number(b[0])
        if (!isNaN(an) && !isNaN(bn)) return an - bn
        return a[0].localeCompare(b[0])
      })
      sorted.forEach(([category, count], i) => {
        const pct = vals.length > 0 ? (count / vals.length * 100).toFixed(1) : '0'
        // First row: show variable name and missing count
        // Continuation rows: blank variable name, indented category label
        rows.push([
          i === 0 ? v : '',
          i === 0 ? category : `  ${category}`,
          count,
          `${pct}%`,
          i === 0 ? missing : '',
        ])
      })
    }
    tables.push({ id: 'categorical_summary', title: 'Categorical Variable Summary', headers, rows })

    // Bar chart data for each categorical var
    for (const v of catVars) {
      const vals = getCategoricalValues(data, v)
      const freq = countFrequencies(vals)
      const barData = [...freq.entries()].map(([value, count]) => ({
        value, count, percent: (count / vals.length * 100).toFixed(1)
      })).sort((a, b) => b.count - a.count)
      chartData.push({ type: 'bar', title: `Frequency: ${v}`, data: barData, config: {} })
    }
  }

  const n = data.length
  const interpretation = generateDescriptiveInterpretation(data, numericVars, catVars)

  return {
    type: 'descriptive',
    summary: { n, variables: variables.length, numericVars: numericVars.length, catVars: catVars.length },
    tables,
    charts: chartData as never,
    interpretation
  }
}

function createHistogramBins(vals: number[], nBins: number): { x0: number; x1: number; count: number }[] {
  if (vals.length === 0) return []
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const binWidth = (max - min) / nBins
  const bins = Array.from({ length: nBins }, (_, i) => ({
    x0: min + i * binWidth,
    x1: min + (i + 1) * binWidth,
    count: 0
  }))
  for (const v of vals) {
    const i = Math.min(Math.floor((v - min) / binWidth), nBins - 1)
    bins[i].count++
  }
  return bins
}

function generateDescriptiveInterpretation(data: DataRow[], numericVars: string[], catVars: string[]): string {
  const n = data.length
  const parts: string[] = [`Analysis performed on ${n.toLocaleString()} observations.`]

  if (numericVars.length > 0) {
    const summaries = numericVars.slice(0, 3).map(v => {
      const vals = getNumericValues(data, v)
      const m = mean(vals)
      const s = sd(vals)
      return `${v} (mean ${fmt(m, 1)} ± ${fmt(s, 1)})`
    })
    parts.push(`Numeric variables summarized: ${summaries.join(', ')}.`)
  }

  if (catVars.length > 0) {
    parts.push(`Categorical variables analyzed: ${catVars.join(', ')}.`)
  }

  return parts.join(' ')
}
