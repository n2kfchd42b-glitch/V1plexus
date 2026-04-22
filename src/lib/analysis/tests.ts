// Statistical tests: Chi-Square, T-Test, ANOVA, Correlation

function makeHistBins(vals: number[], nBins = 20): { x0: number; x1: number; count: number }[] {
  if (vals.length === 0) return []
  const min = Math.min(...vals), max = Math.max(...vals)
  const w = max === min ? 1 : (max - min) / nBins
  const bins = Array.from({ length: nBins }, (_, i) => ({ x0: min + i * w, x1: min + (i + 1) * w, count: 0 }))
  for (const v of vals) bins[Math.min(Math.floor((v - min) / w), nBins - 1)].count++
  return bins
}

import type { DataRow, AnalysisResult, ResultTable } from './types'
import {
  getNumericValues, getCategoricalValues, countMissing,
  mean, sd, median, percentile, variance,
  pearsonR, spearmanR,
  tToP, chiSqP, fToP, normalCDF,
  fmt, fmtCI, formatPValue, getSig,
  cramersV, cohensD,
  countFrequencies, encodeCategories,
  qqNormalData,
} from './utils'

// ===================== CHI-SQUARE TEST =====================

export interface ChiSquareConfig {
  variable1: string
  variable2: string
  showExpected: boolean
  yatesCorrection: boolean
  forceFisher?: boolean
}

export function runChiSquare(data: DataRow[], config: ChiSquareConfig): AnalysisResult {
  const { variable1, variable2, yatesCorrection, forceFisher } = config
  const vals1 = getCategoricalValues(data, variable1)
  const vals2 = getCategoricalValues(data, variable2)
  const cats1 = [...new Set(vals1)].sort()
  const cats2 = [...new Set(vals2)].sort()
  const n = Math.min(vals1.length, vals2.length)

  // Build contingency table
  const observed: number[][] = cats1.map(() => new Array(cats2.length).fill(0))
  for (let i = 0; i < n; i++) {
    const r = cats1.indexOf(vals1[i])
    const c = cats2.indexOf(vals2[i])
    if (r >= 0 && c >= 0) observed[r][c]++
  }
  const rowTotals = observed.map(row => row.reduce((a, b) => a + b, 0))
  const colTotals = cats2.map((_, ci) => observed.reduce((sum, row) => sum + row[ci], 0))
  const grand = rowTotals.reduce((a, b) => a + b, 0)

  const expected: number[][] = cats1.map((_, ri) =>
    cats2.map((_, ci) => rowTotals[ri] * colTotals[ci] / grand)
  )

  // Chi-square statistic
  let chiSq = 0
  for (let r = 0; r < cats1.length; r++)
    for (let c = 0; c < cats2.length; c++)
      if (expected[r][c] > 0) {
        const diff = yatesCorrection && cats1.length === 2 && cats2.length === 2
          ? Math.max(0, Math.abs(observed[r][c] - expected[r][c]) - 0.5)
          : Math.abs(observed[r][c] - expected[r][c])
        chiSq += diff ** 2 / expected[r][c]
      }

  const df = (cats1.length - 1) * (cats2.length - 1)
  const pValue = chiSqP(chiSq, df)
  const cv = cramersV(chiSq, grand, cats1.length, cats2.length)

  // Fisher's exact for 2x2
  let fisherP: number | null = null
  if (cats1.length === 2 && cats2.length === 2) {
    fisherP = fisherExact(observed[0][0], observed[0][1], observed[1][0], observed[1][1])
  }

  // Format tables
  const obsHeaders = ['', ...cats2, 'Total']
  const obsRows: (string | number | null)[][] = cats1.map((cat, ri) => [
    cat, ...observed[ri], rowTotals[ri]
  ])
  obsRows.push(['Total', ...colTotals, grand])

  const expRows: (string | number | null)[][] = cats1.map((cat, ri) => [
    cat, ...expected[ri].map(v => fmt(v, 1)), rowTotals[ri]
  ])
  expRows.push(['Total', ...colTotals, grand])

  // When forceFisher is requested but table is not 2×2, fall back gracefully
  const canFisher = cats1.length === 2 && cats2.length === 2
  const useFisher = forceFisher && canFisher
  const primaryP = useFisher && fisherP !== null ? fisherP : pValue

  const tables: ResultTable[] = [
    { id: 'observed', title: 'Observed Counts', headers: obsHeaders, rows: obsRows },
    { id: 'expected', title: 'Expected Counts', headers: obsHeaders, rows: expRows },
    {
      id: 'stats',
      title: useFisher ? "Fisher's Exact Test" : 'Test Statistics',
      headers: ['Statistic', 'Value'],
      rows: useFisher
        ? [
            ["Fisher's exact p-value", formatPValue(fisherP!)],
            ['Cramér\'s V', fmt(cv, 3)],
            ['Chi-square (χ²)', fmt(chiSq)],
            ['Degrees of freedom', df],
          ]
        : [
            ['Chi-square (χ²)', fmt(chiSq)],
            ['Degrees of freedom', df],
            ['p-value', formatPValue(pValue)],
            ['Cramér\'s V', fmt(cv, 3)],
            ...(fisherP !== null ? [["Fisher's exact p-value", formatPValue(fisherP)]] : [])
          ]
    }
  ]

  const chartData = cats1.flatMap(cat1 => cats2.map(cat2 => {
    const r = cats1.indexOf(cat1); const c = cats2.indexOf(cat2)
    return { row: cat1, col: cat2, count: observed[r][c] }
  }))

  const sig = primaryP < 0.05 ? 'statistically significant' : 'not statistically significant'
  const testLabel = useFisher
    ? `Fisher's exact test of association between ${variable1} and ${variable2} (n=${grand}): p ${formatPValue(fisherP!)}. `
    : `Chi-square test of association between ${variable1} and ${variable2} (n=${grand}): χ²(${df}) = ${fmt(chiSq, 2)}, p ${formatPValue(pValue)}. `

  return {
    type: 'chi_square',
    summary: { n: grand, chiSq: fmt(chiSq), df, pValue: formatPValue(primaryP), cramersV: fmt(cv, 3) },
    tables,
    charts: [{ type: 'mosaic', title: `${variable1} × ${variable2}`, data: chartData, config: { cats1, cats2 } }],
    interpretation: testLabel +
      `The association is ${sig}. Cramér's V = ${fmt(cv, 3)}, indicating ` +
      `${cv < 0.1 ? 'negligible' : cv < 0.3 ? 'small' : cv < 0.5 ? 'moderate' : 'strong'} effect size.` +
      (forceFisher && !canFisher ? '\n\n⚠️ Fisher\'s exact test requires a 2×2 table. Chi-square results are shown instead.' : '')
  }
}

// Fisher's exact test for 2x2 tables
function fisherExact(a: number, b: number, c: number, d: number): number {
  const n = a + b + c + d
  const r1 = a + b; const r2 = c + d
  const c1 = a + c; const c2 = b + d
  let p = 0
  // Sum probabilities for all tables as extreme or more extreme
  const logP0 = logFactorial(r1) + logFactorial(r2) + logFactorial(c1) + logFactorial(c2) - logFactorial(n)
  const pObs = Math.exp(logP0 - logFactorial(a) - logFactorial(b) - logFactorial(c) - logFactorial(d))
  for (let x = Math.max(0, r1 + c1 - n); x <= Math.min(r1, c1); x++) {
    const pCurr = Math.exp(logP0 - logFactorial(x) - logFactorial(r1 - x) - logFactorial(c1 - x) - logFactorial(n - r1 - c1 + x))
    if (pCurr <= pObs + 1e-10) p += pCurr
  }
  return Math.min(p, 1)
}

function logFactorial(n: number): number {
  if (n <= 1) return 0
  let r = 0
  for (let i = 2; i <= n; i++) r += Math.log(i)
  return r
}

// ===================== T-TEST =====================

export interface TTestConfig {
  testType: 'independent' | 'paired' | 'one_sample'
  variable: string
  groupVariable?: string
  pairedVariable?: string
  muNull?: number
  confidenceLevel: number
  equalVariances: boolean
  nonParametric?: boolean
}

export function runTTest(data: DataRow[], config: TTestConfig): AnalysisResult {
  const { testType, variable, groupVariable, pairedVariable, muNull = 0, confidenceLevel = 0.95, equalVariances, nonParametric } = config
  const alpha = 1 - confidenceLevel
  const tables: ResultTable[] = []
  let interpretation = ''
  let chartData: unknown[] = []

  if (nonParametric && testType === 'independent' && groupVariable) {
    return runMannWhitney(data, variable, groupVariable)
  }

  if (testType === 'independent' && groupVariable) {
    const cats = getCategoricalValues(data, groupVariable)
    const vals = data.map(row => {
      const v = row[variable]
      return v !== null && v !== undefined ? parseFloat(String(v)) : NaN
    })
    const groups = [...new Set(cats)].sort().slice(0, 2) // Only 2 groups for t-test

    const g1Vals = vals.filter((_, i) => cats[i] === groups[0] && !isNaN(vals[i]))
    const g2Vals = vals.filter((_, i) => cats[i] === groups[1] && !isNaN(vals[i]))

    const m1 = mean(g1Vals), m2 = mean(g2Vals)
    const s1 = sd(g1Vals), s2 = sd(g2Vals)
    const n1 = g1Vals.length, n2 = g2Vals.length
    const diff = m1 - m2

    let df: number, se: number
    if (equalVariances) {
      const pooledSD = Math.sqrt(((n1 - 1) * s1 ** 2 + (n2 - 1) * s2 ** 2) / (n1 + n2 - 2))
      se = pooledSD * Math.sqrt(1 / n1 + 1 / n2)
      df = n1 + n2 - 2
    } else {
      // Welch's t-test
      const v1 = s1 ** 2 / n1, v2 = s2 ** 2 / n2
      se = Math.sqrt(v1 + v2)
      df = (v1 + v2) ** 2 / ((v1 ** 2) / (n1 - 1) + (v2 ** 2) / (n2 - 1))
    }
    const t = diff / se

    const pValue = tToP(t, df)
    const tCrit = getTCritical(alpha / 2, df)
    const ciLow = diff - tCrit * se
    const ciHigh = diff + tCrit * se
    const d = cohensD(m1, m2, s1, s2, n1, n2)

    // Levene's test
    const { fStat: leveneF, pValue: leveneP } = levenesTest(g1Vals, g2Vals)

    tables.push({
      id: 'group_stats', title: 'Group Statistics', headers: ['Group', 'N', 'Mean', 'SD', 'SE'],
      rows: [
        [groups[0], n1, fmt(m1), fmt(s1), fmt(s1 / Math.sqrt(n1))],
        [groups[1], n2, fmt(m2), fmt(s2), fmt(s2 / Math.sqrt(n2))]
      ]
    })
    tables.push({
      id: 't_test', title: 'Independent Samples T-Test', headers: ['', 't', 'df', 'p-value', 'Mean Diff', `${Math.round(confidenceLevel * 100)}% CI`, "Cohen's d"],
      rows: [
        [equalVariances ? 'Equal variances assumed' : "Welch's (unequal variances)",
          fmt(t), fmt(df, 1), formatPValue(pValue), fmt(diff), fmtCI(ciLow, ciHigh), fmt(d, 2)]
      ],
      footnotes: [`Levene's test for equality of variances: F = ${fmt(leveneF)}, p = ${formatPValue(leveneP)}`]
    })

    chartData = [
      { type: 'boxplot_2group', title: `${variable} by ${groupVariable}`, data: [
        { group: groups[0], mean: m1, sd: s1 },
        { group: groups[1], mean: m2, sd: s2 }
      ], config: {} },
      { type: 'qq_plot', title: `Q-Q Plot: ${variable}`, data: qqNormalData([...g1Vals, ...g2Vals]), config: { cohenD: d } },
    ]

    const sig = pValue < 0.05 ? 'significant' : 'not significant'
    interpretation = `Independent samples t-test comparing ${variable} between ${groups[0]} (M=${fmt(m1, 2)}, SD=${fmt(s1, 2)}) and ${groups[1]} (M=${fmt(m2, 2)}, SD=${fmt(s2, 2)}). ` +
      `The difference (${fmt(diff, 2)}) was ${sig} (t(${fmt(df, 1)}) = ${fmt(t, 2)}, p ${formatPValue(pValue)}). ` +
      `${Math.round(confidenceLevel * 100)}% CI: [${fmtCI(ciLow, ciHigh)}]. Cohen's d = ${fmt(d, 2)}.`

  } else if (testType === 'paired' && pairedVariable) {
    const x = getNumericValues(data, variable)
    const y = getNumericValues(data, pairedVariable)
    const pairs = x.map((xi, i) => xi - y[i]).filter((_, i) => !isNaN(x[i]) && !isNaN(y[i]))
    const n = pairs.length
    const diffMean = mean(pairs)
    const diffSD = sd(pairs)
    const se = diffSD / Math.sqrt(n)
    const t = diffMean / se
    const df = n - 1
    const pValue = tToP(t, df)
    const tCrit = getTCritical(alpha / 2, df)
    const d = Math.abs(diffMean) / diffSD

    tables.push({
      id: 'paired', title: 'Paired Samples T-Test', headers: ['', 'Mean Diff', 'SD', 'SE', 't', 'df', 'p-value', `${Math.round(confidenceLevel * 100)}% CI`, "Cohen's d"],
      rows: [[`${variable} vs ${pairedVariable}`, fmt(diffMean), fmt(diffSD), fmt(se), fmt(t), df, formatPValue(pValue), fmtCI(diffMean - tCrit * se, diffMean + tCrit * se), fmt(d, 2)]]
    })

    chartData = [{ type: 'paired_diff', data: pairs, mean: diffMean, pValue: formatPValue(pValue) }]
    interpretation = `Paired t-test: mean difference = ${fmt(diffMean, 2)} (SD = ${fmt(diffSD, 2)}), t(${df}) = ${fmt(t, 2)}, p ${formatPValue(pValue)}. Cohen's d = ${fmt(d, 2)}.`

  } else {
    // One-sample
    const vals = getNumericValues(data, variable)
    const n = vals.length
    const m = mean(vals)
    const s = sd(vals)
    const se = s / Math.sqrt(n)
    const t = (m - muNull) / se
    const df = n - 1
    const pValue = tToP(t, df)
    const tCrit = getTCritical(alpha / 2, df)

    tables.push({
      id: 'one_sample', title: 'One-Sample T-Test', headers: ['Variable', 'N', 'Mean', 'SD', 't', 'df', 'p-value', `${Math.round(confidenceLevel * 100)}% CI`],
      rows: [[variable, n, fmt(m), fmt(s), fmt(t), df, formatPValue(pValue), fmtCI(m - tCrit * se, m + tCrit * se)]]
    })

    chartData = [{ type: 'histogram', title: `Distribution: ${variable}`, data: makeHistBins(vals), config: {} }]
    interpretation = `One-sample t-test of ${variable} against μ=${muNull}: t(${df}) = ${fmt(t, 2)}, p ${formatPValue(pValue)}. Sample mean = ${fmt(m, 2)} ± ${fmt(s, 2)}.`
  }

  return {
    type: 't_test',
    summary: { testType, variable },
    tables,
    charts: chartData as never,
    interpretation
  }
}

// Approximate t critical value
function getTCritical(alpha: number, df: number): number {
  // Normal approximation for large df
  if (df > 100) {
    return normalQuantile(1 - alpha)
  }
  // Binary search
  let lo = 0, hi = 10, t = 2
  for (let i = 0; i < 50; i++) {
    t = (lo + hi) / 2
    const p = 1 - (tToP(t, df) / 2)
    if (Math.abs(p - (1 - alpha)) < 1e-8) break
    if (p < 1 - alpha) lo = t; else hi = t
  }
  return t
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
    return (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
      ((((d1 * q + d2) * q + d3) * q + d4) * q + 1)
  } else if (p <= pHigh) {
    q = p - 0.5
    const r = q * q
    return (((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6) * q /
      (((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1)
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p))
    return -(((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
      ((((d1 * q + d2) * q + d3) * q + d4) * q + 1)
  }
}

// Levene's test for equality of variances
function levenesTest(g1: number[], g2: number[]): { fStat: number; pValue: number } {
  const m1 = mean(g1), m2 = mean(g2)
  const z1 = g1.map(x => Math.abs(x - m1))
  const z2 = g2.map(x => Math.abs(x - m2))
  const zAll = [...z1, ...z2]
  const mAll = mean(zAll)
  const mZ1 = mean(z1), mZ2 = mean(z2)
  const n1 = g1.length, n2 = g2.length, n = n1 + n2

  const ssBetween = n1 * (mZ1 - mAll) ** 2 + n2 * (mZ2 - mAll) ** 2
  const ssWithin = [...z1.map(z => (z - mZ1) ** 2), ...z2.map(z => (z - mZ2) ** 2)].reduce((a, b) => a + b, 0)
  const fStat = (ssBetween / 1) / (ssWithin / (n - 2))
  return { fStat, pValue: fToP(fStat, 1, n - 2) }
}

// ===================== ANOVA =====================

export interface AnovaConfig {
  dependent: string
  factor1: string
  factor2?: string
  posthoc: 'none' | 'tukey' | 'bonferroni'
  welch?: boolean
  nonParametric?: boolean
}

export function runAnova(data: DataRow[], config: AnovaConfig): AnalysisResult {
  if (config.nonParametric) {
    return runKruskalWallis(data, config.dependent, config.factor1)
  }
  const { dependent, factor1, posthoc } = config

  const groups = [...new Set(getCategoricalValues(data, factor1))].sort()
  const groupData: { [key: string]: number[] } = {}
  groups.forEach(g => { groupData[g] = [] })

  data.forEach(row => {
    const val = parseFloat(String(row[dependent] ?? ''))
    const grp = String(row[factor1] ?? '')
    if (!isNaN(val) && groups.includes(grp)) groupData[grp].push(val)
  })

  const allVals = Object.values(groupData).flat()
  const grandMean = mean(allVals)
  const k = groups.length
  const n = allVals.length

  // SS calculations
  const ssBetween = groups.reduce((sum, g) => {
    const gMean = mean(groupData[g])
    return sum + groupData[g].length * (gMean - grandMean) ** 2
  }, 0)
  const ssWithin = groups.reduce((sum, g) => {
    const gMean = mean(groupData[g])
    return sum + groupData[g].reduce((s, x) => s + (x - gMean) ** 2, 0)
  }, 0)
  const dfBetween = k - 1
  const dfWithin = n - k
  const msBetween = ssBetween / dfBetween
  const msWithin = ssWithin / dfWithin
  const fStat = msBetween / msWithin
  const pValue = fToP(fStat, dfBetween, dfWithin)
  const etaSq = ssBetween / (ssBetween + ssWithin)

  const groupStats = groups.map(g => {
    const vals = groupData[g]
    return { group: g, n: vals.length, mean: mean(vals), sd: sd(vals), se: sd(vals) / Math.sqrt(vals.length) }
  })

  const tables: ResultTable[] = [
    {
      id: 'anova_table', title: 'ANOVA Table', headers: ['Source', 'SS', 'df', 'MS', 'F', 'p-value'],
      rows: [
        ['Between groups', fmt(ssBetween), dfBetween, fmt(msBetween), fmt(fStat), formatPValue(pValue)],
        ['Within groups', fmt(ssWithin), dfWithin, fmt(msWithin), '', ''],
        ['Total', fmt(ssBetween + ssWithin), n - 1, '', '', ''],
      ],
      footnotes: [`η² = ${fmt(etaSq, 3)}`]
    },
    {
      id: 'group_stats', title: 'Group Statistics', headers: ['Group', 'N', 'Mean', 'SD', 'SE Mean'],
      rows: groupStats.map(g => [g.group, g.n, fmt(g.mean), fmt(g.sd), fmt(g.se)])
    }
  ]

  // Post-hoc tests
  const posthocRows: (string | number | null)[][] = []
  if (posthoc !== 'none' && pValue < 0.05) {
    for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        const g1 = groupData[groups[i]], g2 = groupData[groups[j]]
        const diff = mean(g1) - mean(g2)
        const se = Math.sqrt(msWithin * (1 / g1.length + 1 / g2.length))
        const q = Math.abs(diff) / se
        let adjP: number
        if (posthoc === 'bonferroni') {
          const nComparisons = k * (k - 1) / 2
          const t = q / Math.sqrt(2)
          adjP = Math.min(1, tToP(t, dfWithin) * nComparisons)
        } else {
          // Tukey HSD approximation
          adjP = Math.min(1, tToP(q / Math.sqrt(2), dfWithin) * (k - 1))
        }
        posthocRows.push([`${groups[i]} vs ${groups[j]}`, fmt(diff), fmt(se), getSig(adjP), formatPValue(adjP)])
      }
    }
    tables.push({
      id: 'posthoc', title: `Post-Hoc Comparisons (${posthoc === 'tukey' ? 'Tukey HSD' : 'Bonferroni'})`,
      headers: ['Comparison', 'Mean Diff', 'SE', 'Sig', 'p (adjusted)'],
      rows: posthocRows
    })
  }

  // Residuals for Q-Q plot (within-group deviations)
  const allResiduals = groups.flatMap(g => groupData[g].map(v => v - mean(groupData[g])))

  const chartData = [
    { type: 'boxplot_groups', title: `${dependent} by ${factor1}`, data: groupStats.map(g => ({ group: g.group, mean: g.mean, sd: g.sd })), config: {} },
    { type: 'qq_plot', title: 'Q-Q Plot of Residuals', data: qqNormalData(allResiduals), config: { etaSq } },
  ]

  const sig = pValue < 0.05 ? 'significant' : 'not significant'
  return {
    type: 'anova',
    summary: { n, k, fStat: fmt(fStat), dfBetween, dfWithin, pValue: formatPValue(pValue), etaSq: fmt(etaSq, 3) },
    tables,
    charts: chartData as never,
    interpretation: `One-way ANOVA testing the effect of ${factor1} on ${dependent} (${k} groups, n=${n}). ` +
      `F(${dfBetween}, ${dfWithin}) = ${fmt(fStat, 2)}, p ${formatPValue(pValue)} — ${sig}. η² = ${fmt(etaSq, 3)}.`
  }
}

// ===================== MANN-WHITNEY U TEST =====================

function rankWithTies(sorted: { v: number; group: number | string }[]): number[] {
  const N = sorted.length
  const ranks = new Array<number>(N)
  let i = 0
  while (i < N) {
    let j = i
    while (j < N && sorted[j].v === sorted[i].v) j++
    const avgRank = (i + j + 1) / 2
    for (let k = i; k < j; k++) ranks[k] = avgRank
    i = j
  }
  return ranks
}

function runMannWhitney(data: DataRow[], variable: string, groupVariable: string): AnalysisResult {
  const cats = getCategoricalValues(data, groupVariable)
  const vals = data.map(row => {
    const v = row[variable]
    return v !== null && v !== undefined ? parseFloat(String(v)) : NaN
  })
  const groups = [...new Set(cats)].sort().slice(0, 2)
  const g1Vals = vals.filter((_, i) => cats[i] === groups[0] && !isNaN(vals[i]))
  const g2Vals = vals.filter((_, i) => cats[i] === groups[1] && !isNaN(vals[i]))
  const n1 = g1Vals.length, n2 = g2Vals.length, N = n1 + n2

  const combined = [
    ...g1Vals.map(v => ({ v, group: 1 })),
    ...g2Vals.map(v => ({ v, group: 2 })),
  ].sort((a, b) => a.v - b.v)

  const ranks = rankWithTies(combined)

  let R1 = 0
  for (let k = 0; k < N; k++) if (combined[k].group === 1) R1 += ranks[k]
  const U1 = R1 - n1 * (n1 + 1) / 2
  const U2 = n1 * n2 - U1
  const U = Math.min(U1, U2)

  // Tie correction for normal approximation
  let tieCorr = 0
  let i = 0
  while (i < N) {
    let j = i
    while (j < N && combined[j].v === combined[i].v) j++
    const t = j - i
    if (t > 1) tieCorr += t ** 3 - t
    i = j
  }
  const varU = (n1 * n2 / 12) * ((N + 1) - tieCorr / (N * (N - 1)))
  const Z = varU > 0 ? (U - n1 * n2 / 2) / Math.sqrt(varU) : 0
  const pValue = 2 * normalCDF(-Math.abs(Z))

  const med1 = median(g1Vals), med2 = median(g2Vals)
  const iqr = (v: number[]) => {
    const s = [...v].sort((a, b) => a - b)
    return percentile(s, 75) - percentile(s, 25)
  }

  const tables: ResultTable[] = [
    {
      id: 'group_stats', title: 'Group Statistics',
      headers: ['Group', 'N', 'Median', 'IQR', 'Mean Rank'],
      rows: [
        [groups[0], n1, fmt(med1), fmt(iqr(g1Vals)), fmt(R1 / n1)],
        [groups[1], n2, fmt(med2), fmt(iqr(g2Vals)), fmt((N * (N + 1) / 2 - R1) / n2)],
      ]
    },
    {
      id: 'mw_stats', title: 'Mann-Whitney U Test',
      headers: ['Statistic', 'Value'],
      rows: [
        ['Mann-Whitney U', fmt(U)],
        ['Z (normal approx.)', fmt(Z, 3)],
        ['p-value (two-tailed)', formatPValue(pValue)],
        ['Total N', N],
      ]
    }
  ]

  const sig = pValue < 0.05 ? 'significant' : 'not significant'
  return {
    type: 't_test',
    summary: { testType: 'mann_whitney', variable, groupVariable, U: fmt(U), Z: fmt(Z, 3), pValue: formatPValue(pValue) },
    tables,
    charts: [{ type: 'boxplot_2group', title: `${variable} by ${groupVariable}`, data: [
      { group: groups[0], mean: med1, sd: iqr(g1Vals) },
      { group: groups[1], mean: med2, sd: iqr(g2Vals) },
    ], config: {} }],
    interpretation: `Mann-Whitney U test comparing ${variable} between ${groups[0]} (Mdn=${fmt(med1, 2)}) and ${groups[1]} (Mdn=${fmt(med2, 2)}). ` +
      `U = ${fmt(U)}, Z = ${fmt(Z, 3)}, p ${formatPValue(pValue)} — ${sig}.`
  }
}

// ===================== KRUSKAL-WALLIS H TEST =====================

function runKruskalWallis(data: DataRow[], dependent: string, factor1: string): AnalysisResult {
  const groupLabels = [...new Set(getCategoricalValues(data, factor1))].sort()
  const groupData: Record<string, number[]> = {}
  groupLabels.forEach(g => { groupData[g] = [] })

  data.forEach(row => {
    const val = parseFloat(String(row[dependent] ?? ''))
    const grp = String(row[factor1] ?? '')
    if (!isNaN(val) && groupLabels.includes(grp)) groupData[grp].push(val)
  })

  const combined = groupLabels.flatMap(g => groupData[g].map(v => ({ v, group: g })))
    .sort((a, b) => a.v - b.v)
  const N = combined.length

  const ranks = rankWithTies(combined)

  const rankSums: Record<string, number> = {}
  groupLabels.forEach(g => { rankSums[g] = 0 })
  for (let k = 0; k < N; k++) rankSums[combined[k].group] += ranks[k]

  let H = (12 / (N * (N + 1))) * groupLabels.reduce((sum, g) => {
    const nj = groupData[g].length
    return sum + rankSums[g] ** 2 / nj
  }, 0) - 3 * (N + 1)

  // Tie correction
  let tieCorr = 0
  let i = 0
  while (i < N) {
    let j = i
    while (j < N && combined[j].v === combined[i].v) j++
    const t = j - i
    if (t > 1) tieCorr += t ** 3 - t
    i = j
  }
  const C = 1 - tieCorr / (N ** 3 - N)
  if (C > 0) H = H / C

  const df = groupLabels.length - 1
  const pValue = chiSqP(H, df)

  const groupStats = groupLabels.map(g => {
    const vals = groupData[g]
    const sorted = [...vals].sort((a, b) => a - b)
    return {
      group: g,
      n: vals.length,
      median: median(vals),
      iqr: fmt(percentile(sorted, 75) - percentile(sorted, 25)),
      meanRank: fmt(rankSums[g] / vals.length),
    }
  })

  const tables: ResultTable[] = [
    {
      id: 'group_stats', title: 'Group Statistics',
      headers: ['Group', 'N', 'Median', 'IQR', 'Mean Rank'],
      rows: groupStats.map(g => [g.group, g.n, fmt(g.median), g.iqr, g.meanRank])
    },
    {
      id: 'kw_stats', title: 'Kruskal-Wallis Test',
      headers: ['Statistic', 'Value'],
      rows: [
        ['H statistic (tie-corrected)', fmt(H, 3)],
        ['Degrees of freedom', df],
        ['p-value', formatPValue(pValue)],
        ['Total N', N],
      ]
    }
  ]

  const sig = pValue < 0.05 ? 'significant' : 'not significant'
  return {
    type: 'anova',
    summary: { testType: 'kruskal_wallis', dependent, factor1, H: fmt(H, 3), df, pValue: formatPValue(pValue) },
    tables,
    charts: [{ type: 'boxplot_groups', title: `${dependent} by ${factor1}`, data: groupStats.map(g => ({ group: g.group, mean: g.median, sd: 0 })), config: {} }],
    interpretation: `Kruskal-Wallis H test comparing ${dependent} across ${groupLabels.length} groups of ${factor1} (N=${N}). ` +
      `H(${df}) = ${fmt(H, 2)}, p ${formatPValue(pValue)} — ${sig}.`
  }
}

// ===================== CORRELATION =====================

export interface CorrelationConfig {
  variables: string[]
  method: 'pearson' | 'spearman' | 'both'
  pAdjustment: 'none' | 'bonferroni'
}

export function runCorrelation(data: DataRow[], config: CorrelationConfig): AnalysisResult {
  const { variables, method, pAdjustment } = config

  // Build data matrix (pairwise complete observations)
  const vals: number[][] = variables.map(v => getNumericValues(data, v))

  // Correlation matrix
  const n = variables.length
  const rMatrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0))
  const pMatrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0))
  const nMatrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0))

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) { rMatrix[i][j] = 1; pMatrix[i][j] = 0; nMatrix[i][j] = vals[i].length; continue }
      // Pairwise complete observations
      const pairs = data.map(row => {
        const vi = parseFloat(String(row[variables[i]] ?? ''))
        const vj = parseFloat(String(row[variables[j]] ?? ''))
        return { vi, vj }
      }).filter(p => !isNaN(p.vi) && !isNaN(p.vj))
      const xi = pairs.map(p => p.vi)
      const xj = pairs.map(p => p.vj)
      const ni = xi.length
      nMatrix[i][j] = ni
      const r = method === 'spearman' ? spearmanR(xi, xj) : pearsonR(xi, xj)
      rMatrix[i][j] = r
      const tStat = r * Math.sqrt(ni - 2) / Math.sqrt(1 - r ** 2)
      let p = tToP(tStat, ni - 2)
      if (pAdjustment === 'bonferroni') {
        const nComp = n * (n - 1) / 2
        p = Math.min(1, p * nComp)
      }
      pMatrix[i][j] = p
    }
  }

  const headers = ['', ...variables]
  const rRows: (string | number | null)[][] = variables.map((v, i) => [
    v, ...rMatrix[i].map((r, j) => i === j ? '1.000' : `${fmt(r, 3)}${getSig(pMatrix[i][j])}`)
  ])

  const pRows: (string | number | null)[][] = variables.map((v, i) => [
    v, ...pMatrix[i].map((p, j) => i === j ? '-' : formatPValue(p))
  ])

  const tables: ResultTable[] = [
    {
      id: 'r_matrix', title: `${method === 'spearman' ? 'Spearman' : 'Pearson'} Correlation Matrix`,
      headers, rows: rRows,
      footnotes: ['* p<0.05, ** p<0.01, *** p<0.001']
    },
    {
      id: 'p_matrix', title: 'P-value Matrix', headers, rows: pRows
    }
  ]

  // Chart data for heatmap and scatter matrix
  const heatmapData = variables.flatMap((v1, i) => variables.map((v2, j) => ({
    x: v1, y: v2, r: rMatrix[i][j], p: pMatrix[i][j]
  })))

  const scatterData = variables.flatMap((v1, i) => variables.slice(i + 1).map((v2, j) => {
    const pairs = data.map(row => ({
      x: parseFloat(String(row[v1] ?? '')),
      y: parseFloat(String(row[v2] ?? ''))
    })).filter(p => !isNaN(p.x) && !isNaN(p.y))
    return { var1: v1, var2: v2, r: rMatrix[i][i + j + 1], pairs: pairs.slice(0, 500) }
  }))

  const strongCorrs = []
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      if (Math.abs(rMatrix[i][j]) >= 0.3)
        strongCorrs.push(`${variables[i]}–${variables[j]} (r=${fmt(rMatrix[i][j], 2)}, p${formatPValue(pMatrix[i][j])})`)

  return {
    type: 'correlation',
    summary: { variables: variables.length, method },
    tables,
    charts: [
      { type: 'heatmap', title: 'Correlation Heatmap', data: heatmapData, config: { variables } },
      { type: 'scatter_matrix', title: 'Scatter Matrix', data: scatterData, config: { variables } }
    ],
    interpretation: strongCorrs.length > 0
      ? `Notable correlations: ${strongCorrs.slice(0, 3).join('; ')}.`
      : 'No strong correlations (|r| ≥ 0.3) were found among the selected variables.'
  }
}
