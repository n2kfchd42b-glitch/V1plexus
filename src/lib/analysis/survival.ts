// Survival analysis: Kaplan-Meier and Cox Proportional Hazards

import type { DataRow, AnalysisResult, ResultTable } from './types'
import {
  getNumericValues, getCategoricalValues, encodeCategories,
  mean, variance, matMul, transpose, matInverse,
  normalCDF, chiSqP,
  fmt, fmtCI, formatPValue, getSig
} from './utils'

// ===================== KAPLAN-MEIER =====================

export interface KaplanMeierConfig {
  timeVariable: string
  eventVariable: string
  groupVariable?: string
  confidenceLevel: number
}

export interface KMPoint {
  time: number
  nRisk: number
  events: number
  censored: number
  survival: number
  seLog: number
  ciLow: number
  ciHigh: number
  group?: string
}

export function runKaplanMeier(data: DataRow[], config: KaplanMeierConfig): AnalysisResult {
  const { timeVariable, eventVariable, groupVariable, confidenceLevel = 0.95 } = config

  const parseEvent = (val: unknown): number => {
    if (val === 1 || val === '1' || val === (true as unknown) || val === 'yes' || val === 'Yes') return 1
    return 0
  }

  const completeCases = data.filter(row => {
    const t = parseFloat(String(row[timeVariable] ?? ''))
    return !isNaN(t) && t >= 0 && row[eventVariable] !== null && row[eventVariable] !== undefined
  })

  const groups = groupVariable
    ? [...new Set(getCategoricalValues(completeCases, groupVariable))].sort()
    : ['All']

  const kmData: { group: string; points: KMPoint[]; median: number | null }[] = []

  for (const group of groups) {
    const rows = groupVariable
      ? completeCases.filter(row => String(row[groupVariable]) === group)
      : completeCases

    const events = rows.map(row => ({
      time: parseFloat(String(row[timeVariable])),
      event: parseEvent(row[eventVariable])
    })).sort((a, b) => a.time - b.time)

    const n = events.length
    const points: KMPoint[] = []
    let survival = 1
    let sumHazard = 0 // For log-log CI (Greenwood)

    // Get unique event times
    const eventTimes = [...new Set(events.filter(e => e.event === 1).map(e => e.time))].sort((a, b) => a - b)

    const nRiskCurrent = n
    let lastTime = 0

    // Add time 0
    points.push({ time: 0, nRisk: n, events: 0, censored: 0, survival: 1, seLog: 0, ciLow: 1, ciHigh: 1, group })

    for (const t of eventTimes) {
      // Count events and censored between lastTime and t
      const atRisk = events.filter(e => e.time >= t).length
      const nEvents = events.filter(e => e.time === t && e.event === 1).length
      const nCensored = events.filter(e => e.time < t && e.time > lastTime && e.event === 0).length

      if (nEvents > 0) {
        survival *= (atRisk - nEvents) / atRisk
        sumHazard += nEvents / (atRisk * (atRisk - nEvents + 0.001))
        const seLog = Math.sqrt(sumHazard)
        const z = 1.96
        const ciLow = Math.exp(-Math.exp(Math.log(-Math.log(survival)) + z * seLog / Math.abs(Math.log(survival))))
        const ciHigh = Math.exp(-Math.exp(Math.log(-Math.log(survival)) - z * seLog / Math.abs(Math.log(survival))))
        points.push({
          time: t,
          nRisk: atRisk,
          events: nEvents,
          censored: nCensored,
          survival: Math.max(0, survival),
          seLog,
          ciLow: Math.min(1, Math.max(0, ciLow || 0)),
          ciHigh: Math.min(1, Math.max(0, ciHigh || 1)),
          group
        })
      }
      lastTime = t
    }

    // Median survival (first time survival <= 0.5)
    const medianPt = points.find(p => p.survival <= 0.5)
    const medianSurvival = medianPt?.time ?? null

    kmData.push({ group, points, median: medianSurvival })
  }

  // Log-rank test (if multiple groups)
  let logRankP: number | null = null
  let logRankChiSq: number | null = null
  if (groups.length > 1) {
    const { chiSq, p } = logRankTest(completeCases, timeVariable, eventVariable, groupVariable!, groups, parseEvent)
    logRankChiSq = chiSq
    logRankP = p
  }

  // ── Tables ──────────────────────────────────────────────────────────────────
  const tables: ResultTable[] = []

  // 1. Survival Summary (primary table — always shown)
  const summaryRows: (string | number | null)[][] = kmData.map(({ group, points, median }) => {
    const events = completeCases.filter(row =>
      (!groupVariable || String(row[groupVariable]) === group) && parseEvent(row[eventVariable]) === 1
    ).length
    const n = completeCases.filter(row => !groupVariable || String(row[groupVariable]) === group).length
    const lastPt = points[points.length - 1]
    return [
      group === 'All' ? 'Overall' : group,
      n,
      `${events} (${fmt(events / n * 100, 1)}%)`,
      median !== null ? fmt(median, 1) : 'NR',
      median !== null ? fmtCI(lastPt.ciLow, lastPt.ciHigh, 2) : '—'
    ]
  })
  tables.push({
    id: 'summary',
    title: 'Survival Summary',
    headers: ['Group', 'N', 'Events (%)', 'Median Survival', '95% CI'],
    rows: summaryRows,
    footnotes: [
      'NR = not reached (fewer than 50% of participants experienced the event).',
      ...(logRankP !== null
        ? [`Log-rank test: χ² = ${fmt(logRankChiSq!, 2)}, p ${formatPValue(logRankP)} — tests whether survival curves differ between groups.`]
        : [])
    ]
  })

  // 2. Survival at Key Timepoints (primary table)
  const allFollowUpTimes = completeCases.map(row => parseFloat(String(row[timeVariable])))
  const keyTimepoints = detectKeyTimepoints(allFollowUpTimes)

  if (keyTimepoints.length > 0) {
    const isMultiGroup = groups.length > 1 && groups[0] !== 'All'
    const tpHeaders = isMultiGroup
      ? ['Time', ...groups.flatMap(g => [`${g}: Survival (95% CI)`, 'N at Risk'])]
      : ['Time', 'Survival (95% CI)', 'N at Risk']

    const tpRows = keyTimepoints.map(t => {
      const row: (string | number | null)[] = [fmt(t, 1)]
      for (const { group, points } of kmData) {
        const pt = survivalAtTime(points, t)
        if (!pt || pt.nRisk === 0) {
          row.push('—', '—')
        } else {
          row.push(`${fmt(pt.survival * 100, 1)}% (${fmt(pt.ciLow * 100, 1)}–${fmt(pt.ciHigh * 100, 1)}%)`, pt.nRisk)
        }
      }
      return row
    })

    tables.push({
      id: 'timepoints',
      title: 'Survival at Key Timepoints',
      headers: tpHeaders,
      rows: tpRows,
      footnotes: ['Survival estimates use the Kaplan-Meier method with Greenwood confidence intervals.']
    })
  }

  // 3. Detailed survival tables (advanced — hidden by default)
  for (const { group, points, median } of kmData) {
    const rows = points.slice(1).map(p => [
      fmt(p.time, 1), p.nRisk, p.events, p.censored,
      fmt(p.survival, 4),
      fmtCI(p.ciLow, p.ciHigh, 4),
    ])
    tables.push({
      id: `km_detail_${group}`,
      title: groups.length > 1 ? `Detailed Survival Table: ${group}` : 'Detailed Survival Table',
      headers: ['Time', 'N at Risk', 'Events', 'Censored', 'Survival', `${Math.round(confidenceLevel * 100)}% CI`],
      rows,
      footnotes: median !== null ? [`Median survival: ${fmt(median, 1)}`] : ['Median not reached'],
      advanced: true
    })
  }

  // Chart data
  const allPoints = kmData.flatMap(({ group, points }) =>
    points.map(p => ({ ...p, group }))
  )

  const nTotal = completeCases.length
  const nEvents = completeCases.filter(row => parseEvent(row[eventVariable]) === 1).length

  const interpretation = `Kaplan-Meier survival analysis (n=${nTotal}, events=${nEvents}). ` +
    kmData.map(({ group, median }) =>
      groups.length > 1
        ? `${group}: median = ${median !== null ? fmt(median, 1) : 'NR'}`
        : `Median survival = ${median !== null ? fmt(median, 1) : 'not reached'}`
    ).join('; ') +
    (logRankP !== null ? `. Log-rank χ²=${fmt(logRankChiSq!, 2)}, p ${formatPValue(logRankP)}.` : '.')

  const plainLanguage = buildKMPlainLanguage(nTotal, nEvents, kmData, groups, logRankP, groupVariable)

  return {
    type: 'kaplan_meier',
    summary: { n: nTotal, events: nEvents, groups: groups.length, logRankP: logRankP !== null ? formatPValue(logRankP) : null },
    tables,
    charts: [
      { type: 'km_curve', title: 'Kaplan-Meier Survival Curves', data: allPoints, config: { groups, logRankP } }
    ],
    interpretation,
    plainLanguage
  }
}

// ── KM Helpers ───────────────────────────────────────────────────────────────

/** Auto-detect 4–5 clinically meaningful timepoints from the follow-up distribution */
function detectKeyTimepoints(times: number[]): number[] {
  if (times.length === 0) return []
  const maxTime = Math.max(...times)

  let candidates: number[]
  if (maxTime > 1000) {
    // Likely days — use 1yr, 2yr, 3yr, 5yr equivalents
    candidates = [365, 730, 1095, 1825, 2555]
  } else if (maxTime > 100) {
    // Likely months
    candidates = [6, 12, 24, 36, 60]
  } else if (maxTime > 10) {
    // Ambiguous (years or months) — use quintiles rounded to 1 dp
    candidates = [0.2, 0.4, 0.6, 0.8].map(q => Math.round(maxTime * q * 10) / 10)
  } else {
    // Small scale — use quartiles
    candidates = [0.25, 0.5, 0.75].map(q => Math.round(maxTime * q * 10) / 10)
  }

  // Keep only timepoints that fall within the observed follow-up
  return [...new Set(candidates.filter(t => t > 0 && t <= maxTime))].sort((a, b) => a - b).slice(0, 5)
}

/** Return the KM survival estimate at a given time t */
function survivalAtTime(points: KMPoint[], t: number): { survival: number; ciLow: number; ciHigh: number; nRisk: number } | null {
  const pts = points.filter(p => p.time <= t)
  if (pts.length === 0) return { survival: 1, ciLow: 1, ciHigh: 1, nRisk: points[0]?.nRisk ?? 0 }
  const pt = pts[pts.length - 1]
  // Find nRisk at the next observed time >= t
  const nextPt = points.find(p => p.time >= t)
  return { survival: pt.survival, ciLow: pt.ciLow, ciHigh: pt.ciHigh, nRisk: nextPt?.nRisk ?? 0 }
}

/** Plain language interpretation for KM */
function buildKMPlainLanguage(
  n: number, events: number,
  kmData: { group: string; points: KMPoint[]; median: number | null }[],
  groups: string[], logRankP: number | null, groupVariable?: string
): string {
  const eventPct = fmt(events / n * 100, 1)
  const isMultiGroup = groups.length > 1 && groups[0] !== 'All'

  let text = `Of the ${n} participants included in this analysis, ${events} (${eventPct}%) experienced the outcome during follow-up. `

  if (!isMultiGroup) {
    const med = kmData[0]?.median
    text += med !== null
      ? `The estimated median survival was ${fmt(med, 1)} — meaning that 50% of participants had experienced the event by this time point. `
      : `The median survival was not reached, indicating that fewer than half of participants had experienced the outcome by the end of follow-up. `
  } else {
    text += `Survival was compared across ${groups.length} groups`
    if (groupVariable) text += ` (${groupVariable})`
    text += `. `

    for (const { group, median } of kmData) {
      text += median !== null
        ? `Participants in the ${group} group had an estimated median survival of ${fmt(median, 1)}. `
        : `Median survival was not reached in the ${group} group. `
    }

    if (logRankP !== null) {
      const sig = logRankP < 0.05
      text += sig
        ? `The difference in survival between groups was statistically significant (log-rank p ${formatPValue(logRankP)}), indicating that survival curves differed more than would be expected by chance. `
        : `The difference in survival between groups was not statistically significant (log-rank p ${formatPValue(logRankP)}), meaning the data do not provide sufficient evidence that survival differs between groups. `
    }
  }

  return text.trim()
}

function logRankTest(
  data: DataRow[], timeVar: string, eventVar: string, groupVar: string, groups: string[],
  parseEvent: (v: unknown) => number
): { chiSq: number; p: number } {
  const allTimes = [...new Set(
    data.filter(row => parseEvent(row[eventVar]) === 1).map(row => parseFloat(String(row[timeVar])))
  )].sort((a, b) => a - b)

  const sumOE = new Array(groups.length).fill(0)
  const sumV: number[][] = Array.from({ length: groups.length }, () => new Array(groups.length).fill(0))

  for (const t of allTimes) {
    const nGroup = groups.map(g => data.filter(row => String(row[groupVar]) === g && parseFloat(String(row[timeVar])) >= t).length)
    const dGroup = groups.map(g => data.filter(row => String(row[groupVar]) === g && parseFloat(String(row[timeVar])) === t && parseEvent(row[eventVar]) === 1).length)
    const n = nGroup.reduce((a, b) => a + b, 0)
    const d = dGroup.reduce((a, b) => a + b, 0)
    if (n < 2) continue

    for (let i = 0; i < groups.length; i++) {
      const expected = nGroup[i] * d / n
      sumOE[i] += dGroup[i] - expected
      for (let j = 0; j < groups.length; j++) {
        const vij = (i === j ? nGroup[i] * (n - nGroup[i]) : -nGroup[i] * nGroup[j]) * d * (n - d) / (n ** 2 * (n - 1))
        if (isFinite(vij)) sumV[i][j] += vij
      }
    }
  }

  // Chi-square statistic: Z' V^{-1} Z (drop last group for identifiability)
  const k = groups.length - 1
  const Z = sumOE.slice(0, k)
  const V = sumV.slice(0, k).map(row => row.slice(0, k))

  try {
    const Vinv = matInverse(V)
    const chiSq = Z.reduce((sum, zi, i) => sum + zi * Vinv[i].reduce((s, vij, j) => s + vij * Z[j], 0), 0)
    return { chiSq: Math.max(0, chiSq), p: chiSqP(chiSq, k) }
  } catch {
    return { chiSq: 0, p: 1 }
  }
}

// ===================== COX PROPORTIONAL HAZARDS =====================

export interface CoxConfig {
  timeVariable: string
  eventVariable: string
  predictors: string[]
  confidenceLevel: number
}

export function runCoxRegression(data: DataRow[], config: CoxConfig): AnalysisResult {
  const { timeVariable, eventVariable, predictors, confidenceLevel = 0.95 } = config

  const parseEvent = (val: unknown): number => {
    if (val === 1 || val === '1' || val === (true as unknown) || val === 'yes' || val === 'Yes') return 1
    return 0
  }

  const completeCases = data.filter(row => {
    const t = parseFloat(String(row[timeVariable] ?? ''))
    return !isNaN(t) && t > 0 && row[eventVariable] !== null &&
      predictors.every(v => row[v] !== null && row[v] !== undefined)
  })

  const n = completeCases.length
  const k = predictors.length

  if (n < k + 5) {
    return { type: 'cox_regression', summary: { error: 'Insufficient data' }, tables: [], charts: [], interpretation: 'Error: insufficient data' }
  }

  // Pre-compute categorical encodings using full dataset
  const coxCatEncodings = new Map<string, ReturnType<typeof encodeCategories>>()
  const allPredNames: string[] = []
  for (const v of predictors) {
    const numVals = getNumericValues(data, v).length
    if (numVals > data.length * 0.5) {
      allPredNames.push(v)
    } else {
      const enc = encodeCategories(data, v)
      coxCatEncodings.set(v, enc)
      enc.names.forEach(nm => { if (!allPredNames.includes(nm)) allPredNames.push(nm) })
    }
  }

  // Build covariate matrix
  const Z: number[][] = completeCases.map(row => {
    const rowZ: number[] = []
    const originalIdx = data.indexOf(row)
    for (const v of predictors) {
      const numVals = getNumericValues(data, v).length
      if (numVals > data.length * 0.5) {
        rowZ.push(parseFloat(String(row[v])) || 0)
      } else {
        rowZ.push(...coxCatEncodings.get(v)!.matrix[originalIdx])
      }
    }
    return rowZ
  })

  const T = completeCases.map(row => parseFloat(String(row[timeVariable])))
  const D = completeCases.map(row => parseEvent(row[eventVariable]))
  const actualK = allPredNames.length

  // Sort by time
  const order = T.map((t, i) => i).sort((a, b) => T[a] - T[b])
  const Tsorted = order.map(i => T[i])
  const Dsorted = order.map(i => D[i])
  const Zsorted = order.map(i => Z[i])

  // Newton-Raphson for partial likelihood
  let beta = new Array(actualK).fill(0)

  for (let iter = 0; iter < 100; iter++) {
    const score = new Array(actualK).fill(0)
    const H: number[][] = Array.from({ length: actualK }, () => new Array(actualK).fill(0))

    for (let i = 0; i < n; i++) {
      if (Dsorted[i] !== 1) continue

      // Risk set at time T[i]
      const riskSet = order.map((_, ri) => ri).filter(ri => Tsorted[ri] >= Tsorted[i])

      const exp_bz = riskSet.map(ri => Math.exp(Math.min(20, Zsorted[ri].reduce((s, z, j) => s + z * beta[j], 0))))
      const S0 = exp_bz.reduce((a, b) => a + b, 0)
      const S1 = new Array(actualK).fill(0)
      const S2: number[][] = Array.from({ length: actualK }, () => new Array(actualK).fill(0))

      riskSet.forEach((ri, idx) => {
        for (let j = 0; j < actualK; j++) {
          S1[j] += Zsorted[ri][j] * exp_bz[idx]
          for (let l = 0; l < actualK; l++)
            S2[j][l] += Zsorted[ri][j] * Zsorted[ri][l] * exp_bz[idx]
        }
      })

      for (let j = 0; j < actualK; j++) {
        score[j] += Zsorted[i][j] - S1[j] / S0
        for (let l = 0; l < actualK; l++)
          H[j][l] -= S2[j][l] / S0 - (S1[j] / S0) * (S1[l] / S0)
      }
    }

    let delta: number[]
    try {
      const Hinv = matInverse(H.map(row => row.map(v => -v)))
      delta = Hinv.map(row => row.reduce((s, val, j) => s + val * score[j], 0))
    } catch { break }

    beta = beta.map((b, j) => b + delta[j])
    if (Math.max(...delta.map(Math.abs)) < 1e-6) break
  }

  // Compute variance-covariance matrix
  const H: number[][] = Array.from({ length: actualK }, () => new Array(actualK).fill(0))
  for (let i = 0; i < n; i++) {
    if (Dsorted[i] !== 1) continue
    const riskSet = order.map((_, ri) => ri).filter(ri => Tsorted[ri] >= Tsorted[i])
    const exp_bz = riskSet.map(ri => Math.exp(Math.min(20, Zsorted[ri].reduce((s, z, j) => s + z * beta[j], 0))))
    const S0 = exp_bz.reduce((a, b) => a + b, 0)
    const S1 = new Array(actualK).fill(0)
    const S2: number[][] = Array.from({ length: actualK }, () => new Array(actualK).fill(0))
    riskSet.forEach((ri, idx) => {
      for (let j = 0; j < actualK; j++) {
        S1[j] += Zsorted[ri][j] * exp_bz[idx]
        for (let l = 0; l < actualK; l++) S2[j][l] += Zsorted[ri][j] * Zsorted[ri][l] * exp_bz[idx]
      }
    })
    for (let j = 0; j < actualK; j++)
      for (let l = 0; l < actualK; l++)
        H[j][l] += S2[j][l] / S0 - (S1[j] / S0) * (S1[l] / S0)
  }

  let ses: number[]
  try {
    const Hinv = matInverse(H)
    ses = Hinv.map((row, i) => Math.sqrt(Math.max(row[i], 0)))
  } catch {
    ses = new Array(actualK).fill(NaN)
  }

  // Concordance index (C-statistic)
  const riskScores = Z.map(zi => zi.reduce((s, z, j) => s + z * beta[j], 0))
  let concordant = 0, discordant = 0, tied = 0
  for (let i = 0; i < n; i++) {
    if (D[i] !== 1) continue
    for (let j = 0; j < n; j++) {
      if (T[j] <= T[i] && j !== i) continue
      if (riskScores[i] > riskScores[j]) concordant++
      else if (riskScores[i] < riskScores[j]) discordant++
      else tied++
    }
  }
  const concordance = (concordant + 0.5 * tied) / (concordant + discordant + tied) || 0.5

  // Partial log likelihood
  let logLik = 0
  for (let i = 0; i < n; i++) {
    if (Dsorted[i] !== 1) continue
    const riskSet = order.map((_, ri) => ri).filter(ri => Tsorted[ri] >= Tsorted[i])
    const num = Zsorted[i].reduce((s, z, j) => s + z * beta[j], 0)
    const denom = Math.log(riskSet.reduce((s, ri) => s + Math.exp(Math.min(20, Zsorted[ri].reduce((ss, z, j) => ss + z * beta[j], 0))), 0))
    logLik += num - denom
  }

  const nullLogLik = 0 // Beta = 0 null model
  const lrStat = -2 * (nullLogLik - logLik)
  const lrP = chiSqP(lrStat, actualK)

  const nEvents = D.reduce((a, b) => a + b, 0)

  // ── Compute crude (univariable) HR for each predictor ──────────────────────
  const crudeHR: (string | number | null)[] = []   // HR string
  const crudePVal: string[] = []
  for (let i = 0; i < actualK; i++) {
    try {
      const x1 = Z.map(row => row[i])
      const { beta: cb, se: cse } = simpleCox1(T, D, x1)
      const cz = cb / cse
      const cp = 2 * (1 - normalCDF(Math.abs(cz)))
      crudeHR.push(`${fmt(Math.exp(cb), 2)} (${fmtCI(Math.exp(cb - 1.96 * cse), Math.exp(cb + 1.96 * cse), 2)})`)
      crudePVal.push(formatPValue(cp))
    } catch {
      crudeHR.push('—'); crudePVal.push('—')
    }
  }

  // ── Publication-format results table (primary) ─────────────────────────────
  const pubRows: (string | number | null)[][] = beta.map((b, i) => {
    const se = ses[i]
    const z = b / se
    const p = 2 * (1 - normalCDF(Math.abs(z)))
    const hr = Math.exp(b)
    const adjHRStr = `${fmt(hr, 2)} (${fmtCI(Math.exp(b - 1.96 * se), Math.exp(b + 1.96 * se), 2)})`
    return [allPredNames[i], crudeHR[i], crudePVal[i], adjHRStr, formatPValue(p), getSig(p)]
  })

  // ── Advanced coefficient detail table (hidden by default) ─────────────────
  const detailRows: (string | number | null)[][] = beta.map((b, i) => {
    const se = ses[i]; const z = b / se
    const p = 2 * (1 - normalCDF(Math.abs(z)))
    return [allPredNames[i], fmt(b, 4), fmt(se, 4), fmt(z, 3), formatPValue(p),
      fmt(Math.exp(b), 3), fmtCI(Math.exp(b - 1.96 * se), Math.exp(b + 1.96 * se), 3)]
  })

  const tables: ResultTable[] = [
    {
      id: 'model_fit',
      title: 'Model Fit',
      headers: ['Statistic', 'Value'],
      rows: [
        ['Participants (N)', n],
        ['Events', `${nEvents} (${fmt(nEvents / n * 100, 1)}%)`],
        ['Concordance index (C)', fmt(concordance, 3)],
        ['Likelihood ratio test', `χ²(${actualK}) = ${fmt(lrStat, 2)}, p ${formatPValue(lrP)}`],
      ],
      footnotes: ['Concordance index: 0.5 = no discrimination, 1.0 = perfect. Values ≥0.70 indicate good model discrimination.']
    },
    {
      id: 'results',
      title: 'Cox Regression Results',
      headers: ['Variable', 'Crude HR (95% CI)', 'p', 'Adjusted HR (95% CI)', 'p', 'Sig'],
      rows: pubRows,
      footnotes: [
        'HR = Hazard Ratio. Values >1 indicate higher risk; values <1 indicate lower risk.',
        'Crude HR: unadjusted (univariable) estimate. Adjusted HR: estimate after controlling for all other variables.',
        '*** p<0.001  ** p<0.01  * p<0.05  † p<0.10'
      ]
    },
    {
      id: 'coefs_detail',
      title: 'Detailed Coefficients (Advanced)',
      headers: ['Variable', 'coef (β)', 'SE', 'z', 'p-value', 'HR', '95% CI'],
      rows: detailRows,
      advanced: true
    }
  ]

  const forestData = beta.map((b, i) => {
    const se = ses[i]; const z = b / se
    const p = 2 * (1 - normalCDF(Math.abs(z)))
    return {
      name: allPredNames[i],
      hr: Math.exp(b),
      ciLow: Math.exp(b - 1.96 * se),
      ciHigh: Math.exp(b + 1.96 * se),
      p: formatPValue(p),
      sig: getSig(p)
    }
  })

  const sigPreds = beta.map((b, i) => {
    const se = ses[i]; const z = b / se; const p = 2 * (1 - normalCDF(Math.abs(z)))
    return p < 0.05 ? { name: allPredNames[i], hr: Math.exp(b), p } : null
  }).filter(Boolean) as { name: string; hr: number; p: number }[]

  const interpretation = `Cox PH regression (n=${n}, events=${nEvents}). ` +
    `Concordance = ${fmt(concordance, 3)}. LR χ²(${actualK}) = ${fmt(lrStat, 2)}, p ${formatPValue(lrP)}. ` +
    (sigPreds.length > 0
      ? `Significant: ${sigPreds.map(s => `${s.name} (HR=${fmt(s.hr, 2)})`).join(', ')}.`
      : 'No significant predictors at p<0.05.')

  const plainLanguage = buildCoxPlainLanguage(n, nEvents, beta, ses, allPredNames, concordance, lrP, actualK)

  return {
    type: 'cox_regression',
    summary: { n, events: nEvents, concordance: fmt(concordance, 3), lrP: formatPValue(lrP) },
    tables,
    charts: [{ type: 'forest_hr', title: 'Adjusted Hazard Ratios', data: forestData, config: {} }],
    interpretation,
    plainLanguage
  }
}

// ── Cox Helpers ───────────────────────────────────────────────────────────────

/** Run univariable Cox with a single continuous predictor (sorted data shortcut) */
function simpleCox1(T: number[], D: number[], x1: number[]): { beta: number; se: number } {
  const n = T.length
  const order = T.map((_, i) => i).sort((a, b) => T[a] - T[b])
  const Ts = order.map(i => T[i])
  const Ds = order.map(i => D[i])
  const Xs = order.map(i => x1[i])

  let beta = 0
  for (let iter = 0; iter < 100; iter++) {
    let score = 0, hess = 0
    for (let i = 0; i < n; i++) {
      if (Ds[i] !== 1) continue
      let S0 = 0, S1 = 0, S2 = 0
      for (let j = i; j < n; j++) {
        const e = Math.exp(Math.min(20, Xs[j] * beta))
        S0 += e; S1 += Xs[j] * e; S2 += Xs[j] * Xs[j] * e
      }
      score += Xs[i] - S1 / S0
      hess -= S2 / S0 - (S1 / S0) ** 2
    }
    if (Math.abs(hess) < 1e-10) break
    const delta = -score / hess
    beta += delta
    if (Math.abs(delta) < 1e-6) break
  }

  let hess = 0
  for (let i = 0; i < n; i++) {
    if (Ds[i] !== 1) continue
    let S0 = 0, S1 = 0, S2 = 0
    for (let j = i; j < n; j++) {
      const e = Math.exp(Math.min(20, Xs[j] * beta))
      S0 += e; S1 += Xs[j] * e; S2 += Xs[j] * Xs[j] * e
    }
    hess += S2 / S0 - (S1 / S0) ** 2
  }

  return { beta, se: hess > 0 ? Math.sqrt(1 / hess) : NaN }
}

/** Plain language summary for Cox regression */
function buildCoxPlainLanguage(
  n: number, events: number,
  beta: number[], ses: number[], names: string[],
  concordance: number, lrP: number, k: number
): string {
  const eventPct = fmt(events / n * 100, 1)
  let text = `Cox proportional hazards regression was performed among ${n} participants, of whom ${events} (${eventPct}%) experienced the outcome during follow-up. `

  const sigPreds = beta.map((b, i) => {
    const se = ses[i]; const z = b / se
    const p = 2 * (1 - normalCDF(Math.abs(z)))
    return p < 0.05 ? { name: names[i], hr: Math.exp(b), ciLow: Math.exp(b - 1.96 * se), ciHigh: Math.exp(b + 1.96 * se), p, direction: b > 0 ? 'higher' : 'lower' } : null
  }).filter(Boolean) as { name: string; hr: number; ciLow: number; ciHigh: number; p: number; direction: string }[]

  if (sigPreds.length === 0) {
    text += `After adjusting for all variables in the model, no predictor was significantly associated with the outcome (likelihood ratio test p ${formatPValue(lrP)}). `
  } else {
    text += `After adjusting for all other variables, the following predictors were independently associated with the outcome: `
    text += sigPreds.map(s =>
      `${s.name} (adjusted HR = ${fmt(s.hr, 2)}, 95% CI: ${fmtCI(s.ciLow, s.ciHigh, 2)}, p ${formatPValue(s.p)}) — participants with higher ${s.name} had ${s.direction} hazard of the event`
    ).join('; ') + '. '
  }

  const cInterpret = concordance >= 0.8 ? 'excellent' : concordance >= 0.7 ? 'good' : concordance >= 0.6 ? 'moderate' : 'limited'
  text += `The model had ${cInterpret} discriminatory ability (concordance index = ${fmt(concordance, 3)}), correctly ranking the timing of events in ${fmt(concordance * 100, 1)}% of comparable pairs.`

  return text
}
