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

  // Tables
  const tables: ResultTable[] = []

  // Survival table
  for (const { group, points, median } of kmData) {
    const rows = points.slice(1).map(p => [
      fmt(p.time, 1), p.nRisk, p.events, p.censored,
      fmt(p.survival, 4),
      fmtCI(p.ciLow, p.ciHigh, 4),
    ])
    tables.push({
      id: `km_${group}`,
      title: groups.length > 1 ? `Survival Table: ${group}` : 'Survival Table',
      headers: ['Time', 'N at Risk', 'Events', 'Censored', 'Survival', `${Math.round(confidenceLevel * 100)}% CI`],
      rows,
      footnotes: median !== null ? [`Median survival: ${fmt(median, 1)}`] : ['Median not reached']
    })
  }

  // Summary table
  const summaryRows: (string | number | null)[][] = kmData.map(({ group, points, median }) => {
    const lastPt = points[points.length - 1]
    const events = completeCases.filter(row =>
      (!groupVariable || String(row[groupVariable]) === group) && parseEvent(row[eventVariable]) === 1
    ).length
    const n = completeCases.filter(row => !groupVariable || String(row[groupVariable]) === group).length
    return [group, n, events, median !== null ? fmt(median, 1) : 'NR',
      median !== null ? fmtCI(lastPt.ciLow, lastPt.ciHigh, 2) : '-'
    ]
  })
  tables.push({
    id: 'summary', title: 'Survival Summary', headers: ['Group', 'N', 'Events', 'Median Survival', '95% CI'],
    rows: summaryRows,
    footnotes: logRankP !== null ? [`Log-rank test: χ² = ${fmt(logRankChiSq!, 2)}, p ${formatPValue(logRankP)}`] : undefined
  })

  // Chart data
  const allPoints = kmData.flatMap(({ group, points }) =>
    points.map(p => ({ ...p, group }))
  )

  const interpretation = `Kaplan-Meier survival analysis (n=${completeCases.length}). ` +
    kmData.map(({ group, median }) =>
      groups.length > 1
        ? `${group}: median survival = ${median !== null ? fmt(median, 1) : 'NR'}`
        : `Median survival = ${median !== null ? fmt(median, 1) : 'not reached'}`
    ).join('; ') +
    (logRankP !== null ? `. Log-rank test: p ${formatPValue(logRankP)}.` : '.')

  return {
    type: 'kaplan_meier',
    summary: { n: completeCases.length, groups: groups.length, logRankP: logRankP !== null ? formatPValue(logRankP) : null },
    tables,
    charts: [
      { type: 'km_curve', title: 'Kaplan-Meier Survival Curves', data: allPoints, config: { groups, logRankP } }
    ],
    interpretation
  }
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

  // Build covariate matrix
  const allPredNames: string[] = []
  const Z: number[][] = completeCases.map(row => {
    const rowZ: number[] = []
    for (const v of predictors) {
      const numVals = getNumericValues(data, v).length
      if (numVals > data.length * 0.5) {
        rowZ.push(parseFloat(String(row[v])) || 0)
        if (!allPredNames.includes(v)) allPredNames.push(v)
      } else {
        const enc = encodeCategories([row], v)
        const names = encodeCategories(data, v).names
        rowZ.push(...enc.matrix[0])
        names.forEach(nm => { if (!allPredNames.includes(nm)) allPredNames.push(nm) })
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

  const coefRows: (string | number | null)[][] = beta.map((b, i) => {
    const se = ses[i]
    const z = b / se
    const p = 2 * (1 - normalCDF(Math.abs(z)))
    const hr = Math.exp(b)
    return [
      allPredNames[i], fmt(b), fmt(se), fmt(z), formatPValue(p),
      fmt(hr, 2), fmtCI(Math.exp(b - 1.96 * se), Math.exp(b + 1.96 * se), 2), getSig(p)
    ]
  })

  const tables: ResultTable[] = [
    {
      id: 'model_fit', title: 'Model Fit', headers: ['Statistic', 'Value'],
      rows: [['N', n], ['Events', D.reduce((a, b) => a + b, 0)], ['LR χ²', `${fmt(lrStat)} (df=${actualK}, p${formatPValue(lrP)})`], ['Concordance', fmt(concordance, 3)]]
    },
    {
      id: 'coefs', title: 'Cox Regression Coefficients',
      headers: ['Variable', 'coef', 'SE(coef)', 'z', 'p-value', 'HR', '95% CI (HR)', 'Sig'],
      rows: coefRows
    }
  ]

  const forestData = beta.map((b, i) => {
    const se = ses[i]
    const z = b / se
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
    return p < 0.05 ? `${allPredNames[i]} (HR=${fmt(Math.exp(b), 2)})` : null
  }).filter(Boolean)

  return {
    type: 'cox_regression',
    summary: { n, events: D.reduce((a, b) => a + b, 0), concordance: fmt(concordance, 3), lrP: formatPValue(lrP) },
    tables,
    charts: [{ type: 'forest_hr', title: 'Hazard Ratios', data: forestData, config: {} }],
    interpretation: `Cox PH regression (n=${n}, events=${D.reduce((a, b) => a + b, 0)}). ` +
      `Concordance index = ${fmt(concordance, 3)}. LR test: χ²(${actualK}) = ${fmt(lrStat, 2)}, p ${formatPValue(lrP)}. ` +
      (sigPreds.length > 0 ? `Significant: ${sigPreds.join(', ')}.` : 'No significant predictors at p<0.05.')
  }
}
