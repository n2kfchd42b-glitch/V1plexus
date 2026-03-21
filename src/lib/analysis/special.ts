// Special analyses: Meta-Analysis, Outbreak Investigation, Sample Size Calculation

import type { DataRow, AnalysisResult, ResultTable } from './types'
import { getNumericValues, getCategoricalValues, mean, sd, variance, normalCDF, chiSqP, fmt, fmtCI, formatPValue, getSig } from './utils'

// ===================== META-ANALYSIS =====================

export interface MetaAnalysisConfig {
  effectSizeVar: string
  seVar?: string
  ciLowVar?: string
  ciHighVar?: string
  studyLabelVar: string
  model: 'fixed' | 'random'
}

export function runMetaAnalysis(data: DataRow[], config: MetaAnalysisConfig): AnalysisResult {
  const { effectSizeVar, seVar, ciLowVar, ciHighVar, studyLabelVar, model = 'random' } = config

  const studies = data.map(row => {
    const es = parseFloat(String(row[effectSizeVar] ?? ''))
    let se: number
    if (seVar) {
      se = parseFloat(String(row[seVar] ?? ''))
    } else if (ciLowVar && ciHighVar) {
      const lo = parseFloat(String(row[ciLowVar] ?? ''))
      const hi = parseFloat(String(row[ciHighVar] ?? ''))
      se = (hi - lo) / (2 * 1.96)
    } else {
      se = NaN
    }
    const label = String(row[studyLabelVar] ?? `Study ${data.indexOf(row) + 1}`)
    return { label, es, se, w: 1 / se ** 2 }
  }).filter(s => !isNaN(s.es) && !isNaN(s.se) && s.se > 0)

  const k = studies.length
  if (k === 0) {
    return { type: 'meta_analysis', summary: { error: 'No valid studies' }, tables: [], charts: [], interpretation: 'Error: no valid studies found' }
  }

  // Fixed-effect weighted mean
  const W = studies.map(s => s.w)
  const totalW = W.reduce((a, b) => a + b, 0)
  const fixedMean = studies.reduce((sum, s) => sum + s.w * s.es, 0) / totalW
  const fixedSE = 1 / Math.sqrt(totalW)

  // Cochran's Q for heterogeneity
  const Q = studies.reduce((sum, s) => sum + s.w * (s.es - fixedMean) ** 2, 0)
  const dfQ = k - 1
  const pQ = chiSqP(Q, dfQ)
  const I2 = Math.max(0, (Q - dfQ) / Q * 100)

  // DerSimonian-Laird tau² (random effects)
  const tau2 = model === 'random' ? Math.max(0, (Q - dfQ) / (totalW - studies.reduce((sum, s) => sum + s.w ** 2, 0) / totalW)) : 0

  // Random effects weights and summary
  const Wstar = studies.map(s => 1 / (s.se ** 2 + tau2))
  const totalWstar = Wstar.reduce((a, b) => a + b, 0)
  const reMean = studies.reduce((sum, s, i) => sum + Wstar[i] * s.es, 0) / totalWstar
  const reSE = 1 / Math.sqrt(totalWstar)
  const summaryES = model === 'random' ? reMean : fixedMean
  const summarySE = model === 'random' ? reSE : fixedSE

  const z = summaryES / summarySE
  const pValue = 2 * (1 - normalCDF(Math.abs(z)))

  // Per-study weights
  const sumW = (model === 'random' ? Wstar : W).reduce((a, b) => a + b, 0)
  const weights = (model === 'random' ? Wstar : W).map(w => w / sumW * 100)

  // Egger's test (simplified)
  const eggerB = (() => {
    const x = studies.map((s, i) => 1 / s.se)
    const y = studies.map((s, i) => s.es / s.se)
    const xm = mean(x), ym = mean(y)
    const sxy = x.reduce((s, xi, i) => s + (xi - xm) * (y[i] - ym), 0)
    const sxx = x.reduce((s, xi) => s + (xi - xm) ** 2, 0)
    return sxx > 0 ? sxy / sxx : 0
  })()

  const studyRows: (string | number | null)[][] = studies.map((s, i) => [
    s.label, fmt(s.es, 3), fmt(s.se, 3),
    fmtCI(s.es - 1.96 * s.se, s.es + 1.96 * s.se),
    fmt(weights[i], 1) + '%'
  ])
  studyRows.push(['Summary', fmt(summaryES, 3), fmt(summarySE, 3), fmtCI(summaryES - 1.96 * summarySE, summaryES + 1.96 * summarySE), '100%'])

  const tables: ResultTable[] = [
    {
      id: 'studies', title: 'Study Results',
      headers: ['Study', 'Effect Size', 'SE', '95% CI', 'Weight'],
      rows: studyRows
    },
    {
      id: 'heterogeneity', title: 'Heterogeneity Statistics', headers: ['Statistic', 'Value'],
      rows: [
        ['Cochran\'s Q', fmt(Q, 2)], ['df', dfQ], ['p (Q)', formatPValue(pQ)],
        ['I²', fmt(I2, 1) + '%'], ['τ²', fmt(tau2, 4)]
      ]
    }
  ]

  // Forest plot data
  const forestData = [
    ...studies.map((s, i) => ({
      label: s.label, es: s.es, ciLow: s.es - 1.96 * s.se, ciHigh: s.es + 1.96 * s.se, weight: weights[i], isSummary: false
    })),
    { label: `Summary (${model === 'random' ? 'RE' : 'FE'})`, es: summaryES, ciLow: summaryES - 1.96 * summarySE, ciHigh: summaryES + 1.96 * summarySE, weight: 100, isSummary: true }
  ]

  // Funnel plot data
  const funnelData = studies.map(s => ({ es: s.es, se: s.se }))

  return {
    type: 'meta_analysis',
    summary: { k, summaryES: fmt(summaryES, 3), summarySE: fmt(summarySE, 3), pValue: formatPValue(pValue), I2: fmt(I2, 1), tau2: fmt(tau2, 4) },
    tables,
    charts: [
      { type: 'forest_meta', title: 'Forest Plot', data: forestData, config: { nullLine: 0 } },
      { type: 'funnel_plot', title: 'Funnel Plot', data: funnelData, config: { summaryES } }
    ],
    interpretation: `Meta-analysis of ${k} studies (${model === 'random' ? 'random-effects' : 'fixed-effect'} model). ` +
      `Summary effect = ${fmt(summaryES, 3)} (95% CI: ${fmtCI(summaryES - 1.96 * summarySE, summaryES + 1.96 * summarySE)}), p ${formatPValue(pValue)}. ` +
      `Heterogeneity: I² = ${fmt(I2, 1)}%, Q(${dfQ}) = ${fmt(Q, 2)}, p ${formatPValue(pQ)}.`
  }
}

// ===================== OUTBREAK INVESTIGATION =====================

export interface OutbreakConfig {
  dateVariable: string
  caseClassVariable?: string
  locationVariable?: string
  interval: 'day' | 'week' | '2week'
  exposures?: string[]
  outcomeVariable?: string
}

export function runOutbreakInvestigation(data: DataRow[], config: OutbreakConfig): AnalysisResult {
  const { dateVariable, caseClassVariable, interval = 'day', exposures = [] } = config

  // Parse dates and build epidemic curve
  const cases = data.map(row => ({
    date: new Date(String(row[dateVariable] ?? '')),
    classification: caseClassVariable ? String(row[caseClassVariable] ?? 'Case') : 'Case',
    row
  })).filter(c => !isNaN(c.date.getTime()))

  const n = cases.length

  // Group by time interval
  const getIntervalKey = (d: Date): string => {
    const y = d.getFullYear(), m = d.getMonth(), day = d.getDate()
    if (interval === 'day') return d.toISOString().split('T')[0]
    if (interval === 'week') {
      const weekStart = new Date(d)
      weekStart.setDate(day - d.getDay())
      return weekStart.toISOString().split('T')[0]
    }
    // 2-week: find 2-week epoch from min date
    const minDate = new Date(Math.min(...cases.map(c => c.date.getTime())))
    const epochDays = Math.floor((d.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24 * 14))
    const epochStart = new Date(minDate.getTime() + epochDays * 14 * 24 * 60 * 60 * 1000)
    return epochStart.toISOString().split('T')[0]
  }

  const timeBuckets = new Map<string, Map<string, number>>()
  for (const c of cases) {
    const key = getIntervalKey(c.date)
    if (!timeBuckets.has(key)) timeBuckets.set(key, new Map())
    const bucket = timeBuckets.get(key)!
    bucket.set(c.classification, (bucket.get(c.classification) ?? 0) + 1)
  }

  const classifications = caseClassVariable
    ? [...new Set(cases.map(c => c.classification))].sort()
    : ['Case']

  const timeKeys = [...timeBuckets.keys()].sort()
  const epicurveData = timeKeys.map(key => {
    const bucket = timeBuckets.get(key)!
    const row: Record<string, unknown> = { date: key }
    let total = 0
    for (const cls of classifications) {
      const count = bucket.get(cls) ?? 0
      row[cls] = count
      total += count
    }
    row.total = total
    return row
  })

  // Attack rates for exposures
  const attackRateTables: ResultTable[] = []
  if (exposures.length > 0 && config.outcomeVariable) {
    for (const exposure of exposures) {
      const twoByTwo = build2x2(data, exposure, config.outcomeVariable)
      if (twoByTwo) {
        const { a, b, c, d, rr, rrCI, or, orCI, pValue } = twoByTwo
        const ar_exp = a / (a + b)
        const ar_unexp = c / (c + d)

        attackRateTables.push({
          id: `ar_${exposure}`,
          title: `Attack Rate Analysis: ${exposure}`,
          headers: ['Exposure', 'Ill', 'Not Ill', 'Total', 'Attack Rate', 'RR', '95% CI', 'OR', '95% CI', 'p'],
          rows: [
            ['Exposed', a, b, a + b, fmt(ar_exp * 100, 1) + '%', fmt(rr, 2), fmtCI(rrCI[0], rrCI[1]), fmt(or, 2), fmtCI(orCI[0], orCI[1]), formatPValue(pValue)],
            ['Unexposed', c, d, c + d, fmt(ar_unexp * 100, 1) + '%', '1.00', '-', '1.00', '-', '-']
          ]
        })
      }
    }
  }

  // Overall attack rate
  const overallAR = n / data.length

  const tables: ResultTable[] = [
    {
      id: 'epicurve_data', title: 'Epidemic Curve Data',
      headers: ['Date', ...classifications, 'Total'],
      rows: epicurveData.map(d => [d.date as string, ...classifications.map(c => d[c] as number ?? 0), d.total as number])
    },
    {
      id: 'summary', title: 'Outbreak Summary', headers: ['Statistic', 'Value'],
      rows: [
        ['Total cases', n], ['Time period', `${timeKeys[0]} to ${timeKeys[timeKeys.length - 1]}`],
        ['Peak period', (() => { const max = epicurveData.reduce((m, d) => (d.total as number) > (m.total as number) ? d : m); return `${max.date} (${max.total} cases)` })()],
        ['Interval', interval]
      ]
    },
    ...attackRateTables
  ]

  return {
    type: 'outbreak_investigation',
    summary: { n, timePoints: timeKeys.length, classifications: classifications.length },
    tables,
    charts: [
      { type: 'epi_curve', title: 'Epidemic Curve', data: epicurveData, config: { classifications, interval } }
    ],
    interpretation: `Outbreak investigation: ${n} cases identified over ${timeKeys.length} ${interval === 'day' ? 'daily' : interval === 'week' ? 'weekly' : 'bi-weekly'} periods. ` +
      `Peak: ${epicurveData.reduce((m, d) => (d.total as number) > (m.total as number) ? d : m).date} (${epicurveData.reduce((m, d) => (d.total as number) > (m.total as number) ? d : m).total} cases).`
  }
}

function build2x2(data: DataRow[], exposureVar: string, outcomeVar: string): {
  a: number; b: number; c: number; d: number
  rr: number; rrCI: [number, number]
  or: number; orCI: [number, number]
  pValue: number
} | null {
  let a = 0, b = 0, c = 0, d = 0
  for (const row of data) {
    const exp = row[exposureVar]
    const out = row[outcomeVar]
    const isExp = exp === 1 || exp === '1' || exp === 'yes' || exp === 'Yes' || exp === (true as unknown)
    const isOut = out === 1 || out === '1' || out === 'yes' || out === 'Yes' || out === (true as unknown)
    if (isExp && isOut) a++
    else if (isExp && !isOut) b++
    else if (!isExp && isOut) c++
    else d++
  }
  if (a + b + c + d === 0) return null

  const rr = (a / (a + b)) / (c / (c + d) || 0.001)
  const logRR = Math.log(rr)
  const seLogRR = Math.sqrt(b / (a * (a + b)) + d / (c * (c + d)))
  const rrCI: [number, number] = [Math.exp(logRR - 1.96 * seLogRR), Math.exp(logRR + 1.96 * seLogRR)]

  const or = (a * d) / (b * c || 0.001)
  const logOR = Math.log(or)
  const seLogOR = Math.sqrt(1 / a + 1 / b + 1 / c + 1 / d)
  const orCI: [number, number] = [Math.exp(logOR - 1.96 * seLogOR), Math.exp(logOR + 1.96 * seLogOR)]

  const n = a + b + c + d
  const chiSq = n * (a * d - b * c) ** 2 / ((a + b) * (c + d) * (a + c) * (b + d))
  const pValue = chiSqP(Math.max(0, chiSq), 1)

  return { a, b, c, d, rr, rrCI, or, orCI, pValue }
}

// ===================== SAMPLE SIZE =====================

export interface SampleSizeConfig {
  design: 'cross_sectional' | 'cohort' | 'case_control' | 'rct' | 'cluster_rct'
  prevalence?: number
  expectedDiff?: number
  effectSize?: number
  alpha: number
  power: number
  ratio: number
  designEffect?: number
  dropoutRate?: number
}

export function runSampleSize(config: SampleSizeConfig): AnalysisResult {
  const { design, alpha = 0.05, power = 0.8, ratio = 1, designEffect = 1, dropoutRate = 0 } = config

  const za = normalQuantile(1 - alpha / 2)
  const zb = normalQuantile(power)

  let n: number
  let formula: string

  if (design === 'cross_sectional') {
    const p = config.prevalence ?? 0.5
    n = (za ** 2 * p * (1 - p)) / ((config.expectedDiff ?? 0.05) ** 2)
    formula = `n = z²α/2 × p(1-p) / d² = ${fmt(n, 0)}`
  } else if (design === 'cohort' || design === 'rct') {
    const p1 = config.prevalence ?? 0.5
    const p2 = p1 - (config.expectedDiff ?? 0.1)
    const pBar = (p1 + ratio * p2) / (1 + ratio)
    n = (za * Math.sqrt((1 + 1 / ratio) * pBar * (1 - pBar)) + zb * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2) / ratio)) ** 2 / (p1 - p2) ** 2
    formula = `n = (zα√[p̄(1-p̄)(1+1/k)] + zβ√[p₁(1-p₁) + p₂(1-p₂)/k])² / (p₁-p₂)²`
  } else if (design === 'case_control') {
    const p2 = config.prevalence ?? 0.3
    const or = config.effectSize ?? 2
    const p1 = or * p2 / (1 + (or - 1) * p2)
    const pBar = (p1 + ratio * p2) / (1 + ratio)
    n = (za * Math.sqrt((1 + 1 / ratio) * pBar * (1 - pBar)) + zb * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2) / ratio)) ** 2 / (p1 - p2) ** 2
    formula = `Case-control with OR=${fmt(or, 2)}`
  } else {
    // Cluster RCT — two means
    const d = config.effectSize ?? 0.5
    n = 2 * ((za + zb) / d) ** 2
    formula = `Two-sample means: n = 2(zα + zβ)²/d²`
  }

  // Apply design effect and dropout adjustment
  const nDE = n * designEffect
  const nFinal = nDE / (1 - dropoutRate)

  // Power curve
  const sampleSizes = Array.from({ length: 20 }, (_, i) => Math.round(n * (0.3 + i * 0.1)))
  const powerCurve = sampleSizes.map(ss => {
    // Approximate power as function of n
    let achievedPower: number
    if (design === 'cross_sectional') {
      const p = config.prevalence ?? 0.5
      const d = config.expectedDiff ?? 0.05
      const z = Math.sqrt(ss * d ** 2 / (p * (1 - p))) - za
      achievedPower = normalCDF(z)
    } else {
      const nRatio = ss / n
      const zBeta = Math.sqrt(nRatio) * (za + zb) - za
      achievedPower = normalCDF(zBeta)
    }
    return { n: ss, power: Math.max(0, Math.min(1, achievedPower)) }
  })

  const tables: ResultTable[] = [
    {
      id: 'results', title: 'Sample Size Results', headers: ['Parameter', 'Value'],
      rows: [
        ['Study design', design.replace(/_/g, ' ')],
        ['Alpha (significance level)', alpha],
        ['Power', `${power * 100}%`],
        ['Required n per group', Math.ceil(n)],
        ['Total n (both groups)', Math.ceil(n * (1 + ratio))],
        ['With design effect (DEFF=' + fmt(designEffect, 2) + ')', Math.ceil(nDE * (1 + ratio))],
        ['Adjusted for dropout (' + fmt(dropoutRate * 100, 0) + '%)', Math.ceil(nFinal * (1 + ratio))],
        ['Formula', formula]
      ]
    }
  ]

  const powerTableRows: (string | number | null)[][] = [0.7, 0.75, 0.8, 0.85, 0.9, 0.95].map(pw => {
    const zPow = normalQuantile(pw)
    let nPow: number
    if (design === 'cross_sectional') {
      const p = config.prevalence ?? 0.5
      nPow = (za ** 2 * p * (1 - p)) / ((config.expectedDiff ?? 0.05) ** 2) * ((za + zPow) / (za + zb)) ** 2
    } else {
      nPow = n * ((za + zPow) / (za + zb)) ** 2
    }
    return [fmt(pw * 100, 0) + '%', Math.ceil(nPow), Math.ceil(nPow * (1 + ratio)), Math.ceil(nPow * designEffect * (1 + ratio))]
  })

  tables.push({
    id: 'power_table', title: 'Sample Sizes at Different Power Levels',
    headers: ['Power', 'n per group', 'Total n', 'Adjusted n (DEFF)'],
    rows: powerTableRows
  })

  return {
    type: 'sample_size',
    summary: { design, nPerGroup: Math.ceil(n), totalN: Math.ceil(n * (1 + ratio)), finalN: Math.ceil(nFinal * (1 + ratio)) },
    tables,
    charts: [
      { type: 'power_curve', title: 'Power Curve', data: powerCurve, config: { targetPower: power, targetN: Math.ceil(n) } }
    ],
    interpretation: `${design.replace(/_/g, ' ')} study: ${Math.ceil(n)} participants per group (${Math.ceil(n * (1 + ratio))} total) ` +
      `required for ${power * 100}% power at α=${alpha}. ` +
      (dropoutRate > 0 ? `Adjusted for ${fmt(dropoutRate * 100, 0)}% dropout: ${Math.ceil(nFinal * (1 + ratio))} total.` : '')
  }
}

function normalQuantile(p: number): number {
  if (p <= 0) return -Infinity
  if (p >= 1) return Infinity
  const a1 = -3.969683028665376e+01, a2 = 2.209460984245205e+02
  const a3 = -2.759285104469687e+02, a4 = 1.383577518672690e+02
  const a5 = -3.066479806614716e+01, a6 = 2.506628277459239e+00
  const b1 = -5.447609879822406e+01, b2 = 1.615858368580409e+02
  const b3 = -1.556989798598866e+02, b4 = 6.680131188771972e+01, b5 = -1.328068155288572e+01
  const c1 = -7.784894002430293e-03, c2 = -3.223964580411365e-01
  const c3 = -2.400758277161838e+00, c4 = -2.549732539343734e+00
  const c5 = 4.374664141464968e+00, c6 = 2.938163982698783e+00
  const d1 = 7.784695709041462e-03, d2 = 3.224671290700398e-01
  const d3 = 2.445134137142996e+00, d4 = 3.754408661907416e+00
  const pLow = 0.02425, pHigh = 1 - pLow
  let q: number
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p))
    return (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) / ((((d1 * q + d2) * q + d3) * q + d4) * q + 1)
  } else if (p <= pHigh) {
    q = p - 0.5; const r = q * q
    return (((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6) * q / (((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1)
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p))
    return -(((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) / ((((d1 * q + d2) * q + d3) * q + d4) * q + 1)
  }
}
