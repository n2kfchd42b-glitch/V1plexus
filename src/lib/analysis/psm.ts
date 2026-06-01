// Propensity Score Matching (PSM)
// Algorithm: logistic PS estimation → logit-scale caliper → 1:1 nearest-neighbour matching
// → standardised mean difference balance assessment

import type { DataRow, AnalysisResult, ResultTable } from './types'
import { sigmoid, matInverse, mean, variance, fmt } from './utils'

// ── Config ────────────────────────────────────────────────────────────────────

export interface PSMConfig {
  treatmentVariable: string   // binary column: 1 = treated, 0 = control
  covariates: string[]        // confounders to balance on
  caliper?: number            // multiplier of SD(logit PS); Austin (2011) recommends 0.2
  ratio?: number              // 1:N matching (currently 1:1 only)
  confidenceLevel?: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  return isNaN(n) ? null : n
}

function parseTreatment(v: unknown): 0 | 1 | null {
  const s = String(v ?? '').trim().toLowerCase()
  if (s === '1' || s === 'true' || s === 'yes' || s === 'y') return 1
  if (s === '0' || s === 'false' || s === 'no'  || s === 'n') return 0
  return null
}

function groupMean(rows: DataRow[], col: string): number {
  const vals = rows.map(r => parseNum(r[col])).filter(v => v !== null) as number[]
  return vals.length > 0 ? mean(vals) : 0
}

function smd(groupA: DataRow[], groupB: DataRow[], col: string): number {
  const vA = groupA.map(r => parseNum(r[col])).filter(v => v !== null) as number[]
  const vB = groupB.map(r => parseNum(r[col])).filter(v => v !== null) as number[]
  if (vA.length < 2 || vB.length < 2) return 0
  const mA = mean(vA), mB = mean(vB)
  const varA = variance(vA, true), varB = variance(vB, true)
  const pooledSD = Math.sqrt((varA + varB) / 2)
  return pooledSD > 0 ? Math.abs(mA - mB) / pooledSD : 0
}

function psmError(message: string): AnalysisResult {
  return {
    type: 'psm',
    summary: { error: message },
    tables: [],
    charts: [],
    interpretation: `PSM failed: ${message}`,
  }
}

// ── Newton-Raphson logistic regression ───────────────────────────────────────
// Returns coefficient vector β (length k+1, including intercept)

function fitLogistic(X: number[][], y: number[]): number[] {
  const n = X.length
  const k = X[0].length // includes intercept column
  let beta = new Array(k).fill(0)

  for (let iter = 0; iter < 100; iter++) {
    const pi = X.map(xi =>
      sigmoid(xi.reduce((s, v, j) => s + v * beta[j], 0))
    )

    // Score: X'(y - pi)
    const score = new Array(k).fill(0)
    for (let j = 0; j < k; j++)
      for (let i = 0; i < n; i++)
        score[j] += X[i][j] * (y[i] - pi[i])

    // Hessian: -X'WX  (negative because we maximise log-likelihood)
    const H: number[][] = Array.from({ length: k }, () => new Array(k).fill(0))
    for (let j = 0; j < k; j++)
      for (let l = 0; l < k; l++)
        for (let i = 0; i < n; i++) {
          const w = Math.max(pi[i] * (1 - pi[i]), 1e-10)
          H[j][l] -= X[i][j] * w * X[i][l]
        }

    try {
      const Hinv = matInverse(H.map(row => row.map(v => -v)))
      const delta = Hinv.map(row => row.reduce((s, v, j) => s + v * score[j], 0))
      const stepNorm = Math.sqrt(delta.reduce((s, d) => s + d * d, 0))
      beta = beta.map((b, j) => b + delta[j])
      if (stepNorm < 1e-8) break
    } catch {
      break // singular Hessian — keep current β
    }
  }

  return beta
}

// ── Main function ─────────────────────────────────────────────────────────────

export function runPSM(data: DataRow[], config: PSMConfig): AnalysisResult {
  const {
    treatmentVariable,
    covariates,
    caliper = 0.2,
    confidenceLevel: _cl = 0.95,
  } = config

  if (!treatmentVariable || covariates.length === 0) {
    return psmError('treatmentVariable and at least one covariate are required.')
  }

  // ── 1. Filter complete cases ──────────────────────────────────────────────
  const complete = data.filter(row => {
    if (parseTreatment(row[treatmentVariable]) === null) return false
    return covariates.every(c => parseNum(row[c]) !== null)
  })

  const n = complete.length
  if (n < 20) {
    return psmError(`Only ${n} complete cases found. Need at least 20 for PSM.`)
  }

  const T = complete.map(row => parseTreatment(row[treatmentVariable]) as number)

  // ── 2. Standardise covariates (zero-mean, unit-SD) for IRLS stability ────
  const covStats = covariates.map(c => {
    const vals = complete.map(r => parseNum(r[c]) as number)
    const m = mean(vals)
    const s = Math.sqrt(variance(vals, true)) || 1
    return { m, s }
  })

  const X: number[][] = complete.map(row =>
    [1, ...covariates.map((c, j) => {
      const v = parseNum(row[c]) as number
      return (v - covStats[j].m) / covStats[j].s
    })]
  )

  // ── 3. Fit PS model ────────────────────────────────────────────────────────
  const beta = fitLogistic(X, T)

  const psScores = X.map(xi =>
    sigmoid(xi.reduce((s, v, j) => s + v * beta[j], 0))
  )

  const logitPS = psScores.map(p => {
    const c = Math.max(1e-6, Math.min(1 - 1e-6, p))
    return Math.log(c / (1 - c))
  })

  const logitSD = Math.sqrt(variance(logitPS, true)) || 0.01
  const caliperWidth = caliper * logitSD

  // ── 4. 1:1 nearest-neighbour matching without replacement ─────────────────
  const treatedIdx = complete.map((_, i) => i).filter(i => T[i] === 1)
  const controlIdx = complete.map((_, i) => i).filter(i => T[i] === 0)

  // Match treated units in ascending propensity-score order. This is a
  // deterministic ordering (greedy 1:1 matching is order-dependent), which keeps
  // the matched set reproducible across runs on the same data.
  const orderedTreated = [...treatedIdx].sort((a, b) => logitPS[a] - logitPS[b])

  const matchedPairs: { ti: number; ci: number }[] = []
  const usedControls = new Set<number>()

  for (const ti of orderedTreated) {
    let bestCi = -1
    let bestDist = Infinity
    for (const ci of controlIdx) {
      if (usedControls.has(ci)) continue
      const dist = Math.abs(logitPS[ti] - logitPS[ci])
      if (dist <= caliperWidth && dist < bestDist) {
        bestDist = dist
        bestCi = ci
      }
    }
    if (bestCi !== -1) {
      matchedPairs.push({ ti, ci: bestCi })
      usedControls.add(bestCi)
    }
  }

  // ── 5. Balance assessment ─────────────────────────────────────────────────
  const treatedRows = complete.filter((_, i) => T[i] === 1)
  const controlRows = complete.filter((_, i) => T[i] === 0)
  const matchedT = matchedPairs.map(p => complete[p.ti])
  const matchedC = matchedPairs.map(p => complete[p.ci])

  const nTreated = treatedIdx.length
  const nControl = controlIdx.length
  const nMatched = matchedPairs.length
  const nUnmatched = nTreated - nMatched

  // ── 6. Build tables ───────────────────────────────────────────────────────

  // Table 1 — Sample summary
  const summaryTable: ResultTable = {
    id: 'psm_summary',
    title: 'Matching Summary',
    headers: ['', 'Before matching', 'After matching'],
    rows: [
      ['Treated (N)',  nTreated,          nMatched],
      ['Control (N)',  nControl,          nMatched],
      ['Matched pairs', '—',              nMatched],
      ['Unmatched treated', '—',          nUnmatched],
      ['Caliper (logit-SD units)', '—',   fmt(caliperWidth, 4)],
    ],
  }

  // Table 2 — Covariate balance
  const balanceRows: (string | number | null)[][] = covariates.map(c => {
    const smdBefore = smd(treatedRows, controlRows, c)
    const smdAfter  = nMatched > 0 ? smd(matchedT, matchedC, c) : smdBefore
    const balanced  = smdAfter < 0.1 ? '✓' : smdAfter < 0.2 ? '~' : '✗'
    return [
      c,
      fmt(groupMean(treatedRows, c), 3),
      fmt(groupMean(controlRows, c), 3),
      fmt(smdBefore, 3),
      fmt(smdAfter,  3),
      balanced,
    ]
  })

  const balanceTable: ResultTable = {
    id: 'psm_balance',
    title: 'Covariate Balance — Standardised Mean Differences',
    headers: ['Variable', 'Mean (Treated)', 'Mean (Control)', 'SMD Before', 'SMD After', 'Balanced'],
    rows: balanceRows,
    footnotes: [
      'SMD = Standardised Mean Difference  |  ✓ < 0.1 (balanced)  |  ~ 0.1–0.2 (marginal)  |  ✗ > 0.2 (imbalanced)',
      'Austin PC (2011). Optimal caliper widths for propensity-score matching. Pharm Stat 10(2):150–61.',
    ],
  }

  // Table 3 — PS model coefficients (raw logit scale)
  const psModelTable: ResultTable = {
    id: 'psm_ps_model',
    title: 'Propensity Score Model — Logistic Regression Coefficients',
    headers: ['Variable', 'Coefficient (logit)', 'Note'],
    rows: [
      ['(Intercept)', fmt(beta[0], 4), 'Standardised'],
      ...covariates.map((c, j) => [c, fmt(beta[j + 1], 4), 'Standardised']),
    ],
    footnotes: [
      `Outcome: P(${treatmentVariable} = 1 | covariates). ` +
      'Covariates were z-standardised before fitting for numerical stability.',
    ],
    advanced: true,
  }

  // ── 7. Charts ─────────────────────────────────────────────────────────────

  // Love plot: grouped bar — SMD before vs after per covariate
  const lovePlotData = covariates.map(c => ({
    row: c.length > 20 ? c.slice(0, 18) + '…' : c,
    'Before': parseFloat(fmt(smd(treatedRows, controlRows, c), 3)),
    'After':  nMatched > 0
      ? parseFloat(fmt(smd(matchedT, matchedC, c), 3))
      : parseFloat(fmt(smd(treatedRows, controlRows, c), 3)),
  }))

  // PS score distribution: 10-bin histogram by treatment group
  const N_BINS = 10
  const psDistData = Array.from({ length: N_BINS }, (_, i) => {
    const lo = i / N_BINS
    const hi = (i + 1) / N_BINS
    return {
      row: `${(lo * 100).toFixed(0)}–${(hi * 100).toFixed(0)}%`,
      Treated: treatedIdx.filter(idx => psScores[idx] >= lo && psScores[idx] < hi).length,
      Control: controlIdx.filter(idx => psScores[idx] >= lo && psScores[idx] < hi).length,
    }
  })

  // ── 8. Interpretation ─────────────────────────────────────────────────────
  const maxSMDBefore = covariates.length > 0
    ? Math.max(...covariates.map(c => smd(treatedRows, controlRows, c)))
    : 0
  const maxSMDAfter = nMatched > 0 && covariates.length > 0
    ? Math.max(...covariates.map(c => smd(matchedT, matchedC, c)))
    : maxSMDBefore
  const balanceAchieved = nMatched > 0 && maxSMDAfter < 0.1

  const interpretation = [
    `Propensity score matching performed on ${n.toLocaleString()} complete cases ` +
    `(${nTreated} treated, ${nControl} controls).`,
    `Propensity scores estimated by logistic regression: P(${treatmentVariable}=1 | covariates).`,
    `1:1 nearest-neighbour matching applied within a caliper of ${fmt(caliperWidth, 3)} logit-SD units ` +
    `(0.2 × SD of logit PS — Austin 2011 recommendation).`,
    `${nMatched} matched pairs formed${nUnmatched > 0 ? `; ${nUnmatched} treated unit(s) had no suitable match within the caliper` : ' — all treated units matched'}.`,
    balanceAchieved
      ? `Balance achieved: all SMDs < 0.1 after matching (max SMD = ${fmt(maxSMDAfter, 3)}).`
      : maxSMDAfter < 0.2
        ? `Marginal balance: max post-match SMD = ${fmt(maxSMDAfter, 3)}. Review individual covariates.`
        : `Balance incomplete: max post-match SMD = ${fmt(maxSMDAfter, 3)}. Consider a wider caliper or excluding sparse covariates.`,
    `Next step: run your primary outcome analysis (descriptive, t-test, KM, or Cox regression) on the ${nMatched} matched pairs only.`,
  ].join(' ')

  return {
    type: 'psm',
    summary: {
      n_total:          n,
      n_treated:        nTreated,
      n_control:        nControl,
      n_matched_pairs:  nMatched,
      n_unmatched:      nUnmatched,
      caliper_width:    parseFloat(fmt(caliperWidth, 4)),
      max_smd_before:   parseFloat(fmt(maxSMDBefore, 3)),
      max_smd_after:    parseFloat(fmt(maxSMDAfter,  3)),
      balance_achieved: balanceAchieved,
    },
    tables: [summaryTable, balanceTable, psModelTable],
    charts: [
      {
        type: 'grouped_bar',
        title: 'Love Plot — Standardised Mean Differences Before vs After Matching',
        data: lovePlotData,
        config: { rowCats: lovePlotData.map(d => d.row), colCats: ['Before', 'After'] },
      },
      {
        type: 'grouped_bar',
        title: 'Propensity Score Distribution — Treated vs Control',
        data: psDistData,
        config: { rowCats: psDistData.map(d => d.row), colCats: ['Treated', 'Control'] },
      },
    ],
    interpretation,
  }
}
