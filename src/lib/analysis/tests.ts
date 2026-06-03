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
  qqNormalData, logGamma,
} from './utils'

// Parse a single cell to a number, or NaN if missing/non-numeric. Used to keep
// paired/grouped observations row-aligned (extracting columns separately and
// dropping missing per-column would misalign the rows).
function toNum(v: unknown): number {
  if (v === null || v === undefined || v === '') return NaN
  return typeof v === 'number' ? v : parseFloat(String(v))
}

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
  // Pair the two variables row-by-row, keeping only rows where BOTH are present.
  // Extracting each column separately and pairing by index would misalign the
  // pairs whenever either variable has missing values, corrupting the table.
  const pairs: [string, string][] = []
  const cats1Set = new Set<string>()
  const cats2Set = new Set<string>()
  for (const row of data) {
    const v1 = row[variable1]
    const v2 = row[variable2]
    if (v1 === null || v1 === undefined || v1 === '' || v2 === null || v2 === undefined || v2 === '') continue
    const s1 = String(v1)
    const s2 = String(v2)
    cats1Set.add(s1)
    cats2Set.add(s2)
    pairs.push([s1, s2])
  }
  const cats1 = [...cats1Set].sort()
  const cats2 = [...cats2Set].sort()

  // Build contingency table
  const observed: number[][] = cats1.map(() => new Array(cats2.length).fill(0))
  for (const [s1, s2] of pairs) {
    observed[cats1.indexOf(s1)][cats2.indexOf(s2)]++
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
  let summaryN: number | null = null
  let summaryCohenD: number | null = null
  let summaryMeanDiff: number | null = null

  if (nonParametric && testType === 'independent' && groupVariable) {
    return runMannWhitney(data, variable, groupVariable)
  }

  if (nonParametric && testType === 'paired' && pairedVariable) {
    return runWilcoxonSignedRank(data, variable, pairedVariable)
  }

  if (testType === 'independent' && groupVariable) {
    const groups = [...new Set(getCategoricalValues(data, groupVariable))].sort().slice(0, 2) // Only 2 groups for t-test
    // Extract group values row-by-row so a missing value in either the grouping
    // or the outcome column never shifts the alignment between the two columns.
    const g1Vals: number[] = []
    const g2Vals: number[] = []
    for (const row of data) {
      const g = row[groupVariable]
      if (g === null || g === undefined || g === '') continue
      const num = toNum(row[variable])
      if (isNaN(num)) continue
      const gStr = String(g)
      if (gStr === groups[0]) g1Vals.push(num)
      else if (gStr === groups[1]) g2Vals.push(num)
    }

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
    summaryN = n1 + n2; summaryCohenD = d; summaryMeanDiff = diff

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

    const violinData = [
      { group: groups[0], values: g1Vals.slice(0, 500) },
      { group: groups[1], values: g2Vals.slice(0, 500) },
    ]
    chartData = [
      { type: 'boxplot_2group', title: `${variable} by ${groupVariable}`, data: [
        { group: groups[0], mean: m1, sd: s1 },
        { group: groups[1], mean: m2, sd: s2 }
      ], config: { center: 'Mean', spread: 'SD' } },
      { type: 'violin', title: `Distribution of ${variable} by ${groupVariable}`, data: violinData, config: {} },
      { type: 'ridge', title: `Density: ${variable} by ${groupVariable}`, data: violinData, config: {} },
      { type: 'qq_plot', title: `Q-Q Plot: ${variable}`, data: qqNormalData([...g1Vals, ...g2Vals]), config: { cohenD: d } },
      { type: 'dumbbell', title: `Group Means: ${variable}`, data: [{ label: variable, value1: m1, value2: m2 }], config: { label1: groups[0], label2: groups[1] } },
    ]

    const sig = pValue < 0.05 ? 'significant' : 'not significant'
    interpretation = `Independent samples t-test comparing ${variable} between ${groups[0]} (M=${fmt(m1, 2)}, SD=${fmt(s1, 2)}) and ${groups[1]} (M=${fmt(m2, 2)}, SD=${fmt(s2, 2)}). ` +
      `The difference (${fmt(diff, 2)}) was ${sig} (t(${fmt(df, 1)}) = ${fmt(t, 2)}, p ${formatPValue(pValue)}). ` +
      `${Math.round(confidenceLevel * 100)}% CI: [${fmtCI(ciLow, ciHigh)}]. Cohen's d = ${fmt(d, 2)}.`

  } else if (testType === 'paired' && pairedVariable) {
    // Build pairs row-by-row, keeping only rows where BOTH measurements exist —
    // extracting each column separately would misalign the pairs.
    const xPaired: number[] = []
    const yPaired: number[] = []
    for (const row of data) {
      const a = toNum(row[variable])
      const b = toNum(row[pairedVariable])
      if (isNaN(a) || isNaN(b)) continue
      xPaired.push(a)
      yPaired.push(b)
    }
    const pairs = xPaired.map((xi, i) => xi - yPaired[i])
    const n = pairs.length
    const diffMean = mean(pairs)
    const diffSD = sd(pairs)
    const se = diffSD / Math.sqrt(n)
    const t = diffMean / se
    const df = n - 1
    const pValue = tToP(t, df)
    const tCrit = getTCritical(alpha / 2, df)
    const d = Math.abs(diffMean) / diffSD
    summaryN = n; summaryCohenD = d; summaryMeanDiff = diffMean

    tables.push({
      id: 'paired', title: 'Paired Samples T-Test', headers: ['', 'Mean Diff', 'SD', 'SE', 't', 'df', 'p-value', `${Math.round(confidenceLevel * 100)}% CI`, "Cohen's d"],
      rows: [[`${variable} vs ${pairedVariable}`, fmt(diffMean), fmt(diffSD), fmt(se), fmt(t), df, formatPValue(pValue), fmtCI(diffMean - tCrit * se, diffMean + tCrit * se), fmt(d, 2)]]
    })

    const xFiltered = xPaired
    const yFiltered = yPaired
    chartData = [
      { type: 'paired_diff', data: pairs, mean: diffMean, pValue: formatPValue(pValue) },
      { type: 'dumbbell', title: `Pre vs Post: ${variable}`, data: [{ label: 'Mean', value1: mean(xFiltered), value2: mean(yFiltered) }], config: { label1: variable, label2: pairedVariable } },
    ]
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

    summaryN = n
    chartData = [{ type: 'histogram', title: `Distribution: ${variable}`, data: makeHistBins(vals), config: {} }]
    interpretation = `One-sample t-test of ${variable} against μ=${muNull}: t(${df}) = ${fmt(t, 2)}, p ${formatPValue(pValue)}. Sample mean = ${fmt(m, 2)} ± ${fmt(s, 2)}.`
  }

  return {
    type: 't_test',
    summary: { testType, variable, n: summaryN, cohenD: summaryCohenD !== null ? fmt(summaryCohenD, 3) : null, meanDiff: summaryMeanDiff },
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
    const nComparisons = k * (k - 1) / 2
    for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        const g1 = groupData[groups[i]], g2 = groupData[groups[j]]
        const diff = mean(g1) - mean(g2)
        // SE of the difference under the pooled within-group variance (MSW).
        const se = Math.sqrt(msWithin * (1 / g1.length + 1 / g2.length))
        const tStat = Math.abs(diff) / se
        let adjP: number
        if (posthoc === 'bonferroni') {
          // Two-sample t against MSW, p multiplied by the number of comparisons.
          adjP = Math.min(1, tToP(tStat, dfWithin) * nComparisons)
        } else {
          // Tukey–Kramer HSD: the studentized range statistic is q = √2 · t,
          // evaluated against the studentized range distribution (k, dfWithin).
          const qStat = tStat * Math.SQRT2
          adjP = studentizedRangeP(qStat, k, dfWithin)
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

  const anovaViolinData = groups.map(g => ({ group: g, values: groupData[g].slice(0, 500) }))
  const chartData = [
    { type: 'boxplot_groups', title: `${dependent} by ${factor1}`, data: groupStats.map(g => ({ group: g.group, mean: g.mean, sd: g.sd })), config: { center: 'Mean', spread: 'SD' } },
    { type: 'violin', title: `Distribution of ${dependent} by ${factor1}`, data: anovaViolinData, config: {} },
    { type: 'ridge', title: `Density: ${dependent} by ${factor1}`, data: anovaViolinData, config: {} },
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
  const groups = [...new Set(getCategoricalValues(data, groupVariable))].sort().slice(0, 2)
  // Row-aligned extraction (see toNum) so missing cells don't shift alignment.
  const g1Vals: number[] = []
  const g2Vals: number[] = []
  for (const row of data) {
    const g = row[groupVariable]
    if (g === null || g === undefined || g === '') continue
    const num = toNum(row[variable])
    if (isNaN(num)) continue
    const gStr = String(g)
    if (gStr === groups[0]) g1Vals.push(num)
    else if (gStr === groups[1]) g2Vals.push(num)
  }
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
        ['Rank-biserial r', fmt(n1 > 0 && n2 > 0 ? Math.abs(1 - 2 * U / (n1 * n2)) : 0, 3)],
        ['Total N', N],
      ]
    }
  ]

  const rankBiserialR = n1 > 0 && n2 > 0 ? Math.abs(1 - 2 * U / (n1 * n2)) : 0
  const sig = pValue < 0.05 ? 'significant' : 'not significant'
  return {
    type: 't_test',
    summary: { testType: 'mann_whitney', variable, groupVariable, U: fmt(U), Z: fmt(Z, 3), pValue: formatPValue(pValue), cohenD: rankBiserialR, n: N },
    tables,
    charts: [
      { type: 'boxplot_2group', title: `${variable} by ${groupVariable}`, data: [
        { group: groups[0], mean: med1, sd: iqr(g1Vals) },
        { group: groups[1], mean: med2, sd: iqr(g2Vals) },
      ], config: { center: 'Median', spread: 'IQR' } },
      { type: 'violin', title: `Distribution of ${variable} by ${groupVariable}`, data: [
        { group: groups[0], values: g1Vals.slice(0, 500) },
        { group: groups[1], values: g2Vals.slice(0, 500) },
      ], config: {} },
      { type: 'ridge', title: `Density: ${variable} by ${groupVariable}`, data: [
        { group: groups[0], values: g1Vals.slice(0, 500) },
        { group: groups[1], values: g2Vals.slice(0, 500) },
      ], config: {} },
      { type: 'dumbbell', title: `Group Medians: ${variable}`, data: [{ label: variable, value1: med1, value2: med2 }], config: { label1: groups[0], label2: groups[1] } },
    ],
    interpretation: `Mann-Whitney U test comparing ${variable} between ${groups[0]} (Mdn=${fmt(med1, 2)}) and ${groups[1]} (Mdn=${fmt(med2, 2)}). ` +
      `U = ${fmt(U)}, Z = ${fmt(Z, 3)}, p ${formatPValue(pValue)} — ${sig}.`
  }
}

// ===================== WILCOXON SIGNED-RANK TEST =====================
// Non-parametric paired test: the rank-based counterpart to the paired t-test,
// for repeated measurements of the same subjects when the differences are
// non-normal. Uses the normal approximation with tie + zero handling.

function runWilcoxonSignedRank(data: DataRow[], variable: string, pairedVariable: string): AnalysisResult {
  // Row-aligned pairing so a missing cell in either column never misaligns pairs.
  const diffs: number[] = []
  for (const row of data) {
    const a = toNum(row[variable])
    const b = toNum(row[pairedVariable])
    if (isNaN(a) || isNaN(b)) continue
    const d = a - b
    if (d !== 0) diffs.push(d) // drop zero differences (standard Wilcoxon)
  }
  const n = diffs.length

  if (n < 1) {
    return {
      type: 't_test',
      summary: { error: 'No non-zero paired differences to rank.' },
      tables: [], charts: [],
      interpretation: 'Wilcoxon signed-rank test needs paired observations with at least one non-zero difference.',
    }
  }

  const sorted = diffs
    .map(d => ({ v: Math.abs(d), group: d > 0 ? 'pos' : 'neg' }))
    .sort((p, q) => p.v - q.v)
  const ranks = rankWithTies(sorted)

  let wPos = 0, wNeg = 0
  for (let k = 0; k < n; k++) {
    if (sorted[k].group === 'pos') wPos += ranks[k]
    else wNeg += ranks[k]
  }
  const W = Math.min(wPos, wNeg)

  // Tie correction for the variance of W.
  let tieCorr = 0
  let i = 0
  while (i < n) {
    let j = i
    while (j < n && sorted[j].v === sorted[i].v) j++
    const t = j - i
    if (t > 1) tieCorr += t ** 3 - t
    i = j
  }
  const meanW = n * (n + 1) / 4
  const varW = n * (n + 1) * (2 * n + 1) / 24 - tieCorr / 48
  const Z = varW > 0 ? (wPos - meanW) / Math.sqrt(varW) : 0
  const pValue = 2 * normalCDF(-Math.abs(Z))

  // Effect size: matched-pairs rank-biserial correlation.
  const rankBiserial = n > 0 ? (wPos - wNeg) / (n * (n + 1) / 2) : 0

  const medianDiff = median(diffs)
  const sig = pValue < 0.05 ? 'significant' : 'not significant'

  const tables: ResultTable[] = [
    {
      id: 'wilcoxon', title: 'Wilcoxon Signed-Rank Test',
      headers: ['Statistic', 'Value'],
      rows: [
        ['W (min of W+, W−)', fmt(W)],
        ['Sum of positive ranks (W+)', fmt(wPos)],
        ['Sum of negative ranks (W−)', fmt(wNeg)],
        ['Z (normal approx.)', fmt(Z, 3)],
        ['p-value (two-tailed)', formatPValue(pValue)],
        ['Median difference', fmt(medianDiff)],
        ['Rank-biserial r', fmt(rankBiserial, 3)],
        ['N pairs (non-zero)', n],
      ],
    },
  ]

  return {
    type: 't_test',
    summary: {
      testType: 'wilcoxon_signed_rank', variable, pairedVariable,
      W: fmt(W), Z: fmt(Z, 3), pValue: formatPValue(pValue), cohenD: Math.abs(rankBiserial), n,
    },
    tables,
    charts: [
      { type: 'paired_diff', title: `Paired differences: ${variable} − ${pairedVariable}`, data: diffs, config: { mean: medianDiff, pValue: formatPValue(pValue) } },
    ],
    interpretation: `Wilcoxon signed-rank test of ${variable} vs ${pairedVariable} (median difference = ${fmt(medianDiff, 2)}). ` +
      `W = ${fmt(W)}, Z = ${fmt(Z, 3)}, p ${formatPValue(pValue)} — ${sig}.`,
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
        ['ε² (epsilon-squared)', fmt(N > 1 && isFinite(H) ? Math.min(1, H / (N - 1)) : 0, 3)],
        ['Total N', N],
      ]
    }
  ]

  const epsilonSq = N > 1 && isFinite(H) ? Math.min(1, H / (N - 1)) : 0
  const sig = pValue < 0.05 ? 'significant' : 'not significant'
  return {
    type: 'anova',
    summary: { testType: 'kruskal_wallis', dependent, factor1, H: fmt(H, 3), df, pValue: formatPValue(pValue), n: N, etaSq: epsilonSq },
    tables,
    charts: [
      { type: 'boxplot_groups', title: `${dependent} by ${factor1}`, data: groupStats.map(g => ({ group: g.group, mean: g.median, sd: 0 })), config: { center: 'Median', spread: '' } },
      { type: 'violin', title: `Distribution of ${dependent} by ${factor1}`, data: groupLabels.map(g => ({ group: g, values: groupData[g].slice(0, 500) })), config: {} },
      { type: 'ridge', title: `Density: ${dependent} by ${factor1}`, data: groupLabels.map(g => ({ group: g, values: groupData[g].slice(0, 500) })), config: {} },
    ],
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

  let maxAbsR = 0
  let minPairN = Infinity
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(rMatrix[i][j]) > maxAbsR) maxAbsR = Math.abs(rMatrix[i][j])
      if (nMatrix[i][j] > 0 && nMatrix[i][j] < minPairN) minPairN = nMatrix[i][j]
    }
  }

  return {
    type: 'correlation',
    summary: { variables: variables.length, method, correlation: fmt(maxAbsR, 3), n: isFinite(minPairN) ? minPairN : null },
    tables,
    charts: [
      { type: 'heatmap', title: 'Correlation Heatmap', data: heatmapData, config: { variables } },
      { type: 'correlogram', title: 'Correlogram', data: heatmapData, config: { variables } },
      { type: 'scatter_matrix', title: 'Scatter Matrix', data: scatterData, config: { variables } }
    ],
    interpretation: strongCorrs.length > 0
      ? `Notable correlations: ${strongCorrs.slice(0, 3).join('; ')}.`
      : 'No strong correlations (|r| ≥ 0.3) were found among the selected variables.'
  }
}

// ===================== STUDENTIZED RANGE (Tukey HSD) =====================
// Upper-tail probability P(Q > q) of the studentized range distribution with
// k groups and `df` error degrees of freedom — used for Tukey-Kramer post-hoc
// p-values. Implemented by numerical integration of the exact definition and
// validated against published critical values (see scripts test harness).

const SQRT_2PI = Math.sqrt(2 * Math.PI)
function _phi(z: number): number {
  return Math.exp(-0.5 * z * z) / SQRT_2PI
}

// P(range of k iid N(0,1) ≤ w) = k ∫ φ(z) [Φ(z) − Φ(z − w)]^{k−1} dz.
function _rangeCDF(w: number, k: number): number {
  if (w <= 0) return 0
  const lo = -8, hi = 8
  const steps = 240 // even, for Simpson's rule
  const h = (hi - lo) / steps
  let sum = 0
  for (let i = 0; i <= steps; i++) {
    const z = lo + i * h
    const inner = Math.max(0, normalCDF(z) - normalCDF(z - w))
    const f = _phi(z) * Math.pow(inner, k - 1)
    const weight = i === 0 || i === steps ? 1 : i % 2 === 1 ? 4 : 2
    sum += weight * f
  }
  return Math.min(1, k * (h / 3) * sum)
}

/**
 * Upper-tail p-value of the studentized range distribution, P(Q > q).
 * Integrates the range CDF against the density of the studentizing factor
 * s = √(χ²_df / df). For very large df it converges to the range distribution.
 */
function studentizedRangeP(q: number, k: number, df: number): number {
  if (!(q > 0) || k < 2 || df < 1) return 1
  if (df > 2000) return Math.max(0, Math.min(1, 1 - _rangeCDF(q, k)))

  // Density of s where df·s² ~ χ²_df:
  //   log f(s) = log2 + (df/2)·log(df) − (df/2)·log2 − logΓ(df/2)
  //              + (df−1)·log s − df·s²/2
  const logConst =
    Math.log(2) + (df / 2) * Math.log(df) - (df / 2) * Math.log(2) - logGamma(df / 2)

  // s concentrates near 1 with spread ~1/√(2·df); integrate a generous range.
  const sMax = Math.max(4, 1 + 8 / Math.sqrt(df))
  const steps = 240 // even, for Simpson's rule
  const h = sMax / steps
  let integral = 0
  for (let i = 0; i <= steps; i++) {
    const s = i * h
    let f = 0
    if (s > 0) {
      const logDensity = logConst + (df - 1) * Math.log(s) - (df * s * s) / 2
      f = Math.exp(logDensity) * _rangeCDF(q * s, k)
    }
    const weight = i === 0 || i === steps ? 1 : i % 2 === 1 ? 4 : 2
    integral += weight * f
  }
  const cdf = (h / 3) * integral
  return Math.max(0, Math.min(1, 1 - cdf))
}
