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
  const { variables } = config
  const tables: ResultTable[] = []
  const chartData: unknown[] = []

  // Numeric summary table
  const numericVars = variables.filter(v => {
    const vals = getNumericValues(data, v)
    return vals.length > 0
  })

  const catVars = variables.filter(v => {
    const vals = getNumericValues(data, v)
    return vals.length === 0
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

  // Categorical summary table
  if (catVars.length > 0) {
    const headers = ['Variable', 'N', 'Missing', 'Unique Values', 'Mode', 'Mode Freq (%)']
    const rows: (string | number | null)[][] = catVars.map(v => {
      const vals = getCategoricalValues(data, v)
      const missing = countMissing(data, v)
      const freq = countFrequencies(vals)
      let modeVal = '', modeCount = 0
      for (const [val, count] of freq) {
        if (count > modeCount) { modeCount = count; modeVal = val }
      }
      const modePct = vals.length > 0 ? (modeCount / vals.length * 100).toFixed(1) : '0'
      return [v, vals.length, missing, freq.size, modeVal, `${modeCount} (${modePct}%)`]
    })
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
