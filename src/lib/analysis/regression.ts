// Regression analysis: Simple Linear, Multiple Linear, Logistic (Binary/Multinomial/Ordinal), Poisson, NegBinomial

import type { DataRow, AnalysisResult, ResultTable, CoefficientRow } from './types'
import {
  getNumericValues, getCategoricalValues, encodeCategories,
  mean, sd, variance, pearsonR,
  matMul, transpose, matInverse, solveLin,
  sigmoid, normalCDF,
  tToP, chiSqP,
  fmt, fmtCI, formatPValue, getSig
} from './utils'

// ===================== SIMPLE LINEAR REGRESSION =====================

export interface SimpleRegressionConfig {
  dependent: string
  independent: string
  confidenceLevel: number
}

export function runSimpleRegression(data: DataRow[], config: SimpleRegressionConfig): AnalysisResult {
  const { dependent, independent, confidenceLevel = 0.95 } = config
  const alpha = 1 - confidenceLevel

  const pairs = data.map(row => ({
    x: parseFloat(String(row[independent] ?? '')),
    y: parseFloat(String(row[dependent] ?? ''))
  })).filter(p => !isNaN(p.x) && !isNaN(p.y))

  const x = pairs.map(p => p.x)
  const y = pairs.map(p => p.y)
  const n = pairs.length

  const mx = mean(x), my = mean(y)
  const sxy = x.reduce((sum, xi, i) => sum + (xi - mx) * (y[i] - my), 0)
  const sxx = x.reduce((sum, xi) => sum + (xi - mx) ** 2, 0)

  const b1 = sxy / sxx
  const b0 = my - b1 * mx

  const yHat = x.map(xi => b0 + b1 * xi)
  const residuals = y.map((yi, i) => yi - yHat[i])
  const ssRes = residuals.reduce((s, r) => s + r ** 2, 0)
  const ssTot = y.reduce((s, yi) => s + (yi - my) ** 2, 0)
  const ssReg = ssTot - ssRes
  const r2 = ssReg / ssTot
  const adjR2 = 1 - (1 - r2) * (n - 1) / (n - 2)
  const mse = ssRes / (n - 2)
  const rse = Math.sqrt(mse)
  const fStat = (ssReg / 1) / mse
  const fP = 1 - fCDF(fStat, 1, n - 2)

  const seb1 = Math.sqrt(mse / sxx)
  const seb0 = Math.sqrt(mse * (1 / n + mx ** 2 / sxx))
  const tB1 = b1 / seb1
  const tB0 = b0 / seb0
  const pb1 = tToP2(tB1, n - 2)
  const pb0 = tToP2(tB0, n - 2)
  const tCrit = getTCrit(alpha / 2, n - 2)

  const tables: ResultTable[] = [
    {
      id: 'model', title: 'Model Summary', headers: ['R', 'R²', 'Adj. R²', 'RSE', 'F', 'df1', 'df2', 'p (F)'],
      rows: [[fmt(Math.sqrt(r2)), fmt(r2), fmt(adjR2), fmt(rse), fmt(fStat), 1, n - 2, formatPValue(fP)]]
    },
    {
      id: 'coefs', title: 'Coefficients', headers: ['', 'B', 'SE', 't', 'p-value', `${Math.round(confidenceLevel * 100)}% CI`, 'Sig'],
      rows: [
        ['(Intercept)', fmt(b0), fmt(seb0), fmt(tB0), formatPValue(pb0), fmtCI(b0 - tCrit * seb0, b0 + tCrit * seb0), getSig(pb0)],
        [independent, fmt(b1), fmt(seb1), fmt(tB1), formatPValue(pb1), fmtCI(b1 - tCrit * seb1, b1 + tCrit * seb1), getSig(pb1)]
      ]
    }
  ]

  const scatterData = pairs.map(p => ({ x: p.x, y: p.y, yHat: b0 + b1 * p.x }))
  const residData = residuals.map((r, i) => ({ fitted: yHat[i], residual: r, standardized: r / rse }))

  return {
    type: 'simple_regression',
    summary: { n, r2: fmt(r2), adjR2: fmt(adjR2), fStat: fmt(fStat), pValue: formatPValue(fP) },
    tables,
    charts: [
      { type: 'scatter_regression', title: `${dependent} ~ ${independent}`, data: scatterData, config: { b0, b1, r2 } },
      { type: 'residual_plot', title: 'Residuals vs Fitted', data: residData, config: {} }
    ],
    interpretation: `Simple linear regression: ${dependent} = ${fmt(b0, 2)} + ${fmt(b1, 2)} × ${independent}. ` +
      `R² = ${fmt(r2, 3)} (model explains ${fmt(r2 * 100, 1)}% of variance). ` +
      `F(1, ${n - 2}) = ${fmt(fStat, 2)}, p ${formatPValue(fP)}. ` +
      `Slope: β = ${fmt(b1, 2)} (95% CI: ${fmtCI(b1 - tCrit * seb1, b1 + tCrit * seb1)}), p ${formatPValue(pb1)}.`
  }
}

// ===================== MULTIPLE LINEAR REGRESSION =====================

export interface MultipleRegressionConfig {
  dependent: string
  independents: string[]
  confidenceLevel: number
}

export function runMultipleRegression(data: DataRow[], config: MultipleRegressionConfig): AnalysisResult {
  const { dependent, independents, confidenceLevel = 0.95 } = config
  const alpha = 1 - confidenceLevel

  // Build design matrix with dummies for categorical vars
  const numericIndeps: string[] = []
  const dummyGroups: { baseName: string; names: string[]; ref: string }[] = []
  const allPredictorNames: string[] = []

  for (const v of independents) {
    const numVals = getNumericValues(data, v)
    const catVals = getCategoricalValues(data, v)
    if (numVals.length > data.length * 0.5) {
      numericIndeps.push(v)
      allPredictorNames.push(v)
    } else {
      const { names, categories, ref } = encodeCategories(data, v)
      dummyGroups.push({ baseName: v, names, ref })
      allPredictorNames.push(...names)
    }
  }

  // Build complete cases
  const allVars = [dependent, ...independents]
  const completeCases = data.filter(row =>
    allVars.every(v => {
      const val = row[v]
      return val !== null && val !== undefined && val !== '' && !isNaN(parseFloat(String(val)))
    })
  )
  const n = completeCases.length
  const k = allPredictorNames.length

  if (n < k + 2) {
    return errorResult('multiple_regression', 'Insufficient observations for the number of predictors')
  }

  // Build X matrix (n × (k+1) with intercept)
  const X: number[][] = completeCases.map(row => {
    const rowX: number[] = [1] // intercept
    for (const v of numericIndeps) {
      rowX.push(parseFloat(String(row[v])))
    }
    for (const dg of dummyGroups) {
      const { names } = encodeCategories([row], dg.baseName)
      const enc = encodeCategories([row], dg.baseName)
      rowX.push(...enc.matrix[0])
    }
    return rowX
  })

  const y = completeCases.map(row => parseFloat(String(row[dependent])))

  // OLS: β = (X'X)^{-1} X'y
  const Xt = transpose(X)
  const XtX = matMul(Xt, X)
  let XtXInv: number[][]
  try {
    XtXInv = matInverse(XtX)
  } catch {
    return errorResult('multiple_regression', 'Matrix is singular — check for collinearity')
  }
  const Xty = matMul(Xt, y.map(yi => [yi]))
  const beta = XtXInv.map(row => row.reduce((sum, val, j) => sum + val * Xty[j][0], 0))

  const yHat = X.map(row => row.reduce((sum, xi, j) => sum + xi * beta[j], 0))
  const residuals = y.map((yi, i) => yi - yHat[i])
  const my = mean(y)
  const ssRes = residuals.reduce((s, r) => s + r ** 2, 0)
  const ssTot = y.reduce((s, yi) => s + (yi - my) ** 2, 0)
  const r2 = 1 - ssRes / ssTot
  const adjR2 = 1 - (1 - r2) * (n - 1) / (n - k - 1)
  const mse = ssRes / (n - k - 1)
  const rse = Math.sqrt(mse)
  const fStat = (r2 / k) / ((1 - r2) / (n - k - 1))
  const fP = 1 - fCDF(fStat, k, n - k - 1)

  // Standard errors from diagonal of (X'X)^{-1} * MSE
  const ses = XtXInv.map((row, i) => Math.sqrt(row[i] * mse))
  const tCrit = getTCrit(alpha / 2, n - k - 1)

  const predNames = ['(Intercept)', ...allPredictorNames]
  const coefRows: (string | number | null)[][] = beta.map((b, i) => {
    const se = ses[i]
    const t = b / se
    const p = tToP2(t, n - k - 1)
    return [predNames[i], fmt(b), fmt(se), fmt(t), formatPValue(p), fmtCI(b - tCrit * se, b + tCrit * se), getSig(p)]
  })

  // VIF (simple approximation)
  const vifRows: (string | number | null)[][] = []
  if (allPredictorNames.length > 1) {
    for (let i = 0; i < allPredictorNames.length; i++) {
      const colX = X.map(row => row[i + 1])
      const otherX = X.map(row => row.filter((_, j) => j !== i + 1))
      try {
        const vif = 1 / (1 - computeR2(colX, otherX))
        vifRows.push([allPredictorNames[i], fmt(vif, 2), vif > 10 ? 'High' : vif > 5 ? 'Moderate' : 'OK'])
      } catch {
        vifRows.push([allPredictorNames[i], 'NA', ''])
      }
    }
  }

  const tables: ResultTable[] = [
    {
      id: 'model', title: 'Model Summary', headers: ['R', 'R²', 'Adj. R²', 'RSE', 'F', 'df1', 'df2', 'p (F)'],
      rows: [[fmt(Math.sqrt(r2)), fmt(r2), fmt(adjR2), fmt(rse), fmt(fStat), k, n - k - 1, formatPValue(fP)]]
    },
    {
      id: 'coefs', title: 'Coefficients',
      headers: ['Variable', 'B', 'SE', 't', 'p-value', `${Math.round(confidenceLevel * 100)}% CI`, 'Sig'],
      rows: coefRows
    }
  ]

  if (vifRows.length > 0) {
    tables.push({ id: 'vif', title: 'Variance Inflation Factors (VIF)', headers: ['Variable', 'VIF', 'Status'], rows: vifRows })
  }

  // Coefficient plot data (excluding intercept)
  const coefPlotData = beta.slice(1).map((b, i) => {
    const se = ses[i + 1]
    const t = b / se
    const p = tToP2(t, n - k - 1)
    return { name: allPredictorNames[i], estimate: b, ciLow: b - tCrit * se, ciHigh: b + tCrit * se, p }
  })

  const residData = residuals.map((r, i) => ({ fitted: yHat[i], residual: r, standardized: r / rse }))

  return {
    type: 'multiple_regression',
    summary: { n, k, r2: fmt(r2), adjR2: fmt(adjR2), fStat: fmt(fStat), pValue: formatPValue(fP) },
    tables,
    charts: [
      { type: 'coefficient_plot', title: 'Coefficient Plot', data: coefPlotData, config: {} },
      { type: 'residual_plot', title: 'Residuals vs Fitted', data: residData, config: {} }
    ],
    interpretation: `Multiple regression with ${k} predictors (n=${n}): R² = ${fmt(r2, 3)}, Adj. R² = ${fmt(adjR2, 3)}. ` +
      `F(${k}, ${n - k - 1}) = ${fmt(fStat, 2)}, p ${formatPValue(fP)}. ` +
      `Significant predictors: ${beta.slice(1).map((b, i) => {
        const t = b / ses[i + 1]; const p = tToP2(t, n - k - 1)
        return p < 0.05 ? allPredictorNames[i] : null
      }).filter(Boolean).join(', ') || 'none at p<0.05'}.`
  }
}

// ===================== BINARY LOGISTIC REGRESSION =====================

export interface LogisticRegressionConfig {
  outcome: string
  predictors: string[]
  confidenceLevel: number
}

export function runLogisticRegression(data: DataRow[], config: LogisticRegressionConfig): AnalysisResult {
  const { outcome, predictors, confidenceLevel = 0.95 } = config
  const alpha = 1 - confidenceLevel

  // Build design matrix
  const allPredictorNames: string[] = []
  const dummyGroups: { baseName: string; names: string[] }[] = []

  for (const v of predictors) {
    const numVals = getNumericValues(data, v).length
    if (numVals > data.length * 0.5) {
      allPredictorNames.push(v)
    } else {
      const { names } = encodeCategories(data, v)
      dummyGroups.push({ baseName: v, names })
      allPredictorNames.push(...names)
    }
  }

  const completeCases = data.filter(row => {
    const y = parseFloat(String(row[outcome] ?? ''))
    if (isNaN(y)) return false
    return predictors.every(v => row[v] !== null && row[v] !== undefined && row[v] !== '')
  })

  const n = completeCases.length
  const k = allPredictorNames.length

  if (n < k + 10) {
    return errorResult('logistic_regression', 'Insufficient observations')
  }

  // Build X and y
  const X: number[][] = completeCases.map(row => {
    const rowX: number[] = [1]
    for (const v of predictors) {
      const numVals = getNumericValues(data, v).length
      if (numVals > data.length * 0.5) {
        rowX.push(parseFloat(String(row[v])))
      } else {
        const enc = encodeCategories([row], v)
        rowX.push(...enc.matrix[0])
      }
    }
    return rowX
  })

  const y: number[] = completeCases.map(row => {
    const val = row[outcome]
    if (val === 1 || val === '1' || val === (true as unknown) || val === 'yes' || val === 'Yes' || val === 'TRUE') return 1
    return 0
  })

  // Newton-Raphson for logistic regression
  let beta = new Array(k + 1).fill(0)
  for (let iter = 0; iter < 100; iter++) {
    const pi = X.map(xi => sigmoid(xi.reduce((sum, xij, j) => sum + xij * beta[j], 0)))
    const W = pi.map(p => Math.max(p * (1 - p), 1e-10))

    // Score: X'(y - pi)
    const score = new Array(k + 1).fill(0)
    for (let j = 0; j <= k; j++)
      for (let i = 0; i < n; i++)
        score[j] += X[i][j] * (y[i] - pi[i])

    // Hessian: -X'WX
    const H: number[][] = Array.from({ length: k + 1 }, () => new Array(k + 1).fill(0))
    for (let j = 0; j <= k; j++)
      for (let l = 0; l <= k; l++)
        for (let i = 0; i < n; i++)
          H[j][l] -= X[i][j] * W[i] * X[i][l]

    let delta: number[]
    try {
      const Hinv = matInverse(H.map(row => row.map(v => -v)))
      delta = Hinv.map(row => row.reduce((sum, val, j) => sum + val * score[j], 0))
    } catch {
      break
    }

    const step = Math.max(...delta.map(Math.abs))
    beta = beta.map((b, j) => b + delta[j])
    if (step < 1e-6) break
  }

  // Standard errors from Hessian
  const pi = X.map(xi => sigmoid(xi.reduce((sum, xij, j) => sum + xij * beta[j], 0)))
  const W = pi.map(p => Math.max(p * (1 - p), 1e-10))
  const H: number[][] = Array.from({ length: k + 1 }, () => new Array(k + 1).fill(0))
  for (let j = 0; j <= k; j++)
    for (let l = 0; l <= k; l++)
      for (let i = 0; i < n; i++)
        H[j][l] += X[i][j] * W[i] * X[i][l]

  let Hinv: number[][]
  try {
    Hinv = matInverse(H)
  } catch {
    return errorResult('logistic_regression', 'Failed to compute standard errors (singular matrix)')
  }
  const ses = Hinv.map((row, i) => Math.sqrt(Math.max(row[i], 0)))

  // Log likelihood
  const logLik = y.reduce((sum, yi, i) => sum + (yi === 1 ? Math.log(Math.max(pi[i], 1e-10)) : Math.log(Math.max(1 - pi[i], 1e-10))), 0)
  const n1 = y.filter(yi => yi === 1).length
  const nullLogLik = n1 * Math.log(n1 / n) + (n - n1) * Math.log(1 - n1 / n)
  const modelChiSq = -2 * (nullLogLik - logLik)
  const modelP = chiSqP(modelChiSq, k)
  const nagelkerkeR2 = (1 - Math.exp((2 * (nullLogLik - logLik)) / n)) / (1 - Math.exp(2 * nullLogLik / n))

  const zCrit = 1.96
  const tCrit = zCrit // Use z for logistic

  const predNames = ['(Intercept)', ...allPredictorNames]
  const coefRows: (string | number | null)[][] = beta.map((b, i) => {
    const se = ses[i]
    const z = b / se
    const p = 2 * (1 - normalCDF(Math.abs(z)))
    const or = i === 0 ? null : Math.exp(b)
    const orLow = i === 0 ? null : Math.exp(b - tCrit * se)
    const orHigh = i === 0 ? null : Math.exp(b + tCrit * se)
    return [
      predNames[i], fmt(b), fmt(se), fmt(z), formatPValue(p),
      or !== null ? fmt(or, 2) : '-',
      or !== null ? fmtCI(orLow!, orHigh!, 2) : '-',
      getSig(p)
    ]
  })

  // AUC
  const scores = X.map((xi) => sigmoid(xi.reduce((sum, xij, j) => sum + xij * beta[j], 0)))
  const auc = computeAUC(y, scores)

  // Classification at 0.5 threshold
  const predicted = scores.map(s => s >= 0.5 ? 1 : 0)
  const tp = predicted.filter((p, i) => p === 1 && y[i] === 1).length
  const tn = predicted.filter((p, i) => p === 0 && y[i] === 0).length
  const fp = predicted.filter((p, i) => p === 1 && y[i] === 0).length
  const fn = predicted.filter((p, i) => p === 0 && y[i] === 1).length
  const sensitivity = tp / (tp + fn) || 0
  const specificity = tn / (tn + fp) || 0
  const accuracy = (tp + tn) / n

  const tables: ResultTable[] = [
    {
      id: 'model_fit', title: 'Model Fit', headers: ['Statistic', 'Value'],
      rows: [
        ['N', n], ['Events', n1], ['Model χ²', `${fmt(modelChiSq)} (df=${k}, p${formatPValue(modelP)})`],
        ['Nagelkerke R²', fmt(nagelkerkeR2, 3)], ['AUC', fmt(auc, 3)],
        ['Sensitivity', fmt(sensitivity, 3)], ['Specificity', fmt(specificity, 3)], ['Accuracy', fmt(accuracy, 3)]
      ]
    },
    {
      id: 'coefs', title: 'Coefficients',
      headers: ['Variable', 'β', 'SE', 'z', 'p-value', 'OR', '95% CI (OR)', 'Sig'],
      rows: coefRows
    },
    {
      id: 'classification', title: 'Classification Table', headers: ['', 'Predicted 0', 'Predicted 1'],
      rows: [['Actual 0', tn, fp], ['Actual 1', fn, tp]]
    }
  ]

  // Forest plot data (ORs for predictors)
  const forestData = beta.slice(1).map((b, i) => {
    const se = ses[i + 1]
    const z = b / se
    const p = 2 * (1 - normalCDF(Math.abs(z)))
    return {
      name: allPredictorNames[i],
      or: Math.exp(b),
      ciLow: Math.exp(b - 1.96 * se),
      ciHigh: Math.exp(b + 1.96 * se),
      p: formatPValue(p),
      sig: getSig(p)
    }
  })

  // ROC curve data
  const rocData = computeROCCurve(y, scores)

  return {
    type: 'logistic_regression',
    summary: { n, events: n1, chiSq: fmt(modelChiSq), nagelkerkeR2: fmt(nagelkerkeR2), auc: fmt(auc, 3) },
    tables,
    charts: [
      { type: 'forest_or', title: 'Odds Ratios', data: forestData, config: {} },
      { type: 'roc_curve', title: `ROC Curve (AUC=${fmt(auc, 3)})`, data: rocData, config: { auc } }
    ],
    interpretation: generateLogisticInterpretation(beta, ses, allPredictorNames, auc, nagelkerkeR2, n, n1)
  }
}

function generateLogisticInterpretation(beta: number[], ses: number[], names: string[], auc: number, r2: number, n: number, events: number): string {
  const sigPreds = beta.slice(1).map((b, i) => {
    const se = ses[i + 1]
    const z = b / se
    const p = 2 * (1 - normalCDF(Math.abs(z)))
    const or = Math.exp(b)
    if (p < 0.05) return `${names[i]} (OR=${fmt(or, 2)}, p${formatPValue(p)})`
    return null
  }).filter(Boolean)

  return `Logistic regression (n=${n}, events=${events}). Model AUC = ${fmt(auc, 3)}, Nagelkerke R² = ${fmt(r2, 3)}. ` +
    (sigPreds.length > 0
      ? `Significant predictors: ${sigPreds.join(', ')}.`
      : 'No predictors significant at p<0.05.')
}

function computeAUC(y: number[], scores: number[]): number {
  const n1 = y.filter(yi => yi === 1).length
  const n0 = y.length - n1
  if (n1 === 0 || n0 === 0) return 0.5
  // Wilcoxon-Mann-Whitney statistic
  let sum = 0
  const pos = scores.filter((_, i) => y[i] === 1)
  const neg = scores.filter((_, i) => y[i] === 0)
  for (const p of pos) for (const q of neg) sum += p > q ? 1 : p === q ? 0.5 : 0
  return sum / (n1 * n0)
}

function computeROCCurve(y: number[], scores: number[]): { fpr: number; tpr: number }[] {
  const sorted = scores.map((s, i) => ({ s, y: y[i] })).sort((a, b) => b.s - a.s)
  const n1 = y.filter(yi => yi === 1).length
  const n0 = y.length - n1
  const points: { fpr: number; tpr: number }[] = [{ fpr: 0, tpr: 0 }]
  let tp = 0, fp = 0
  for (const { y: yi } of sorted) {
    if (yi === 1) tp++; else fp++
    points.push({ fpr: fp / n0, tpr: tp / n1 })
  }
  return points
}

// ===================== POISSON REGRESSION =====================

export interface PoissonConfig {
  outcome: string
  predictors: string[]
  offsetVar?: string
  confidenceLevel: number
}

export function runPoissonRegression(data: DataRow[], config: PoissonConfig): AnalysisResult {
  const { outcome, predictors, confidenceLevel = 0.95 } = config

  const completeCases = data.filter(row =>
    parseFloat(String(row[outcome] ?? '')) >= 0 &&
    predictors.every(v => row[v] !== null && row[v] !== undefined)
  )
  const n = completeCases.length
  const y = completeCases.map(row => parseFloat(String(row[outcome])))

  // Build X matrix
  const allPredNames: string[] = []
  const X: number[][] = completeCases.map(row => {
    const rowX: number[] = [1]
    for (const v of predictors) {
      const numVals = getNumericValues(data, v).length
      if (numVals > data.length * 0.5) {
        rowX.push(parseFloat(String(row[v])))
        if (!allPredNames.includes(v)) allPredNames.push(v)
      } else {
        const enc = encodeCategories([row], v)
        const names = encodeCategories(data, v).names
        rowX.push(...enc.matrix[0])
        names.forEach(nm => { if (!allPredNames.includes(nm)) allPredNames.push(nm) })
      }
    }
    return rowX
  })

  const k = allPredNames.length

  // IRLS for Poisson
  let beta = new Array(k + 1).fill(0)
  for (let iter = 0; iter < 100; iter++) {
    const mu = X.map(xi => Math.exp(Math.max(-10, Math.min(10, xi.reduce((s, xij, j) => s + xij * beta[j], 0)))))
    const W = mu
    const score = new Array(k + 1).fill(0)
    for (let j = 0; j <= k; j++)
      for (let i = 0; i < n; i++)
        score[j] += X[i][j] * (y[i] - mu[i])

    const H: number[][] = Array.from({ length: k + 1 }, () => new Array(k + 1).fill(0))
    for (let j = 0; j <= k; j++)
      for (let l = 0; l <= k; l++)
        for (let i = 0; i < n; i++)
          H[j][l] += X[i][j] * W[i] * X[i][l]

    let delta: number[]
    try {
      const Hinv = matInverse(H)
      delta = Hinv.map(row => row.reduce((s, val, j) => s + val * score[j], 0))
    } catch { break }

    beta = beta.map((b, j) => b + delta[j])
    if (Math.max(...delta.map(Math.abs)) < 1e-6) break
  }

  // SEs and statistics
  const mu = X.map(xi => Math.exp(xi.reduce((s, xij, j) => s + xij * beta[j], 0)))
  const H: number[][] = Array.from({ length: k + 1 }, () => new Array(k + 1).fill(0))
  for (let j = 0; j <= k; j++)
    for (let l = 0; l <= k; l++)
      for (let i = 0; i < n; i++)
        H[j][l] += X[i][j] * mu[i] * X[i][l]

  let ses: number[]
  try {
    const Hinv = matInverse(H)
    ses = Hinv.map((row, i) => Math.sqrt(Math.max(row[i], 0)))
  } catch {
    ses = new Array(k + 1).fill(NaN)
  }

  const deviance = 2 * y.reduce((sum, yi, i) => sum + (yi > 0 ? yi * Math.log(yi / Math.max(mu[i], 1e-10)) : 0) - (yi - mu[i]), 0)
  const nullDeviance = 2 * (() => {
    const muNull = mean(y)
    return y.reduce((sum, yi) => sum + (yi > 0 ? yi * Math.log(yi / muNull) : 0) - (yi - muNull), 0)
  })()
  const aic = deviance + 2 * (k + 1)

  const predNames = ['(Intercept)', ...allPredNames]
  const coefRows: (string | number | null)[][] = beta.map((b, i) => {
    const se = ses[i]
    const z = b / se
    const p = 2 * (1 - normalCDF(Math.abs(z)))
    const irr = i === 0 ? null : Math.exp(b)
    return [
      predNames[i], fmt(b), fmt(se), fmt(z), formatPValue(p),
      irr !== null ? fmt(irr, 2) : '-',
      irr !== null ? fmtCI(Math.exp(b - 1.96 * se), Math.exp(b + 1.96 * se), 2) : '-',
      getSig(p)
    ]
  })

  const forestData = beta.slice(1).map((b, i) => {
    const se = ses[i + 1]
    const z = b / se
    const p = 2 * (1 - normalCDF(Math.abs(z)))
    return {
      name: allPredNames[i],
      irr: Math.exp(b),
      ciLow: Math.exp(b - 1.96 * se),
      ciHigh: Math.exp(b + 1.96 * se),
      p: formatPValue(p),
      sig: getSig(p)
    }
  })

  const tables: ResultTable[] = [
    { id: 'model_fit', title: 'Model Fit', headers: ['Statistic', 'Value'], rows: [['N', n], ['Deviance', fmt(deviance)], ['Null Deviance', fmt(nullDeviance)], ['AIC', fmt(aic)]] },
    { id: 'coefs', title: 'Coefficients', headers: ['Variable', 'β', 'SE', 'z', 'p-value', 'IRR', '95% CI (IRR)', 'Sig'], rows: coefRows }
  ]

  return {
    type: 'poisson_regression',
    summary: { n, deviance: fmt(deviance), aic: fmt(aic) },
    tables,
    charts: [{ type: 'forest_irr', title: 'Incidence Rate Ratios', data: forestData, config: {} }],
    interpretation: `Poisson regression (n=${n}): Deviance = ${fmt(deviance)}, AIC = ${fmt(aic)}. ` +
      `Significant predictors: ${beta.slice(1).map((b, i) => {
        const z = b / ses[i + 1]; const p = 2 * (1 - normalCDF(Math.abs(z)))
        return p < 0.05 ? `${allPredNames[i]} (IRR=${fmt(Math.exp(b), 2)})` : null
      }).filter(Boolean).join(', ') || 'none at p<0.05'}.`
  }
}

// ===================== HELPERS =====================

import { incompleteBeta as _incompleteBeta, tToP as _tToP } from './utils'

function fCDF(x: number, df1: number, df2: number): number {
  if (x <= 0) return 0
  const w = df1 * x / (df1 * x + df2)
  return _incompleteBeta(df1 / 2, df2 / 2, w)
}

function getTCrit(alpha: number, df: number): number {
  let lo = 0, hi = 10
  for (let i = 0; i < 50; i++) {
    const t = (lo + hi) / 2
    const p = tToP2(t, df) / 2
    if (Math.abs(p - alpha) < 1e-8) return t
    if (p > alpha) lo = t; else hi = t
  }
  return (lo + hi) / 2
}

function tToP2(t: number, df: number): number {
  return _tToP(t, df)
}

function computeR2(y: number[], X: number[][]): number {
  const n = y.length, k = X[0]?.length ?? 0
  if (k === 0) return 0
  const Xint = X.map(row => [1, ...row])
  try {
    const Xt = transpose(Xint)
    const XtX = matMul(Xt, Xint)
    const XtXInv = matInverse(XtX)
    const Xty = matMul(Xt, y.map(yi => [yi]))
    const beta = XtXInv.map(row => row.reduce((s, v, j) => s + v * Xty[j][0], 0))
    const my = mean(y)
    const ssRes = y.reduce((s, yi, i) => s + (yi - Xint[i].reduce((sum, xij, j) => sum + xij * beta[j], 0)) ** 2, 0)
    const ssTot = y.reduce((s, yi) => s + (yi - my) ** 2, 0)
    return Math.max(0, 1 - ssRes / ssTot)
  } catch {
    return 0
  }
}

function errorResult(type: string, message: string): AnalysisResult {
  return { type, summary: { error: message }, tables: [], charts: [], interpretation: `Error: ${message}` }
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
