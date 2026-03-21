// Statistical utility functions

import type { DataRow } from './types'

// Extract numeric values from a column, removing nulls/NaN
export function getNumericValues(data: DataRow[], column: string): number[] {
  return data
    .map(row => {
      const val = row[column]
      if (val === null || val === undefined || val === '') return NaN
      const n = typeof val === 'number' ? val : parseFloat(String(val))
      return n
    })
    .filter(n => !isNaN(n))
}

// Extract string values from a column, removing nulls
export function getCategoricalValues(data: DataRow[], column: string): string[] {
  return data
    .map(row => {
      const val = row[column]
      if (val === null || val === undefined || val === '') return null
      return String(val)
    })
    .filter((v): v is string => v !== null)
}

// Get all unique categories for a column
export function getUniqueCategories(data: DataRow[], column: string): string[] {
  const vals = getCategoricalValues(data, column)
  return [...new Set(vals)].sort()
}

// Count missing values
export function countMissing(data: DataRow[], column: string): number {
  return data.filter(row => {
    const val = row[column]
    return val === null || val === undefined || val === '' || (typeof val === 'number' && isNaN(val))
  }).length
}

// Format p-value for display
export function formatPValue(p: number): string {
  if (p < 0.001) return '<0.001'
  if (p < 0.01) return p.toFixed(3)
  if (p < 0.1) return p.toFixed(3)
  return p.toFixed(3)
}

// Get significance stars
export function getSig(p: number): string {
  if (p < 0.001) return '***'
  if (p < 0.01) return '**'
  if (p < 0.05) return '*'
  if (p < 0.1) return '†'
  return ''
}

// Format number to significant figures
export function fmt(n: number, decimals = 3): string {
  if (!isFinite(n)) return 'NA'
  return n.toFixed(decimals)
}

// Format confidence interval
export function fmtCI(low: number, high: number, decimals = 2): string {
  return `${fmt(low, decimals)} – ${fmt(high, decimals)}`
}

// Normal distribution CDF using error function approximation
export function normalCDF(x: number): number {
  // Abramowitz and Stegun approximation
  const t = 1 / (1 + 0.2316419 * Math.abs(x))
  const d = 0.3989422820 * Math.exp(-x * x / 2)
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.7814779 + t * (-1.8212560 + t * 1.3302744))))
  return x >= 0 ? 1 - p : p
}

// Two-tailed p-value from z-score
export function zToP(z: number): number {
  return 2 * (1 - normalCDF(Math.abs(z)))
}

// Student t CDF using regularized incomplete beta function
export function studentTCDF(t: number, df: number): number {
  // Use regularized incomplete beta function approximation
  const x = df / (df + t * t)
  const ib = incompleteBeta(df / 2, 0.5, x)
  return 1 - ib / 2
}

// Two-tailed p-value from t-statistic
export function tToP(t: number, df: number): number {
  return 2 * (1 - studentTCDF(Math.abs(t), df))
}

// Chi-square CDF
export function chiSqCDF(x: number, df: number): number {
  if (x <= 0) return 0
  return regularizedGammaP(df / 2, x / 2)
}

// Chi-square p-value (upper tail)
export function chiSqP(x: number, df: number): number {
  return 1 - chiSqCDF(x, df)
}

// F distribution CDF
export function fCDF(x: number, df1: number, df2: number): number {
  if (x <= 0) return 0
  const w = df1 * x / (df1 * x + df2)
  return incompleteBeta(df1 / 2, df2 / 2, w)
}

// F p-value (upper tail)
export function fToP(f: number, df1: number, df2: number): number {
  return 1 - fCDF(f, df1, df2)
}

// Regularized incomplete gamma function P(a,x)
export function regularizedGammaP(a: number, x: number): number {
  if (x < 0) return 0
  if (x === 0) return 0
  if (x < a + 1) {
    // Series representation
    let term = 1 / a
    let sum = term
    for (let i = 1; i < 200; i++) {
      term *= x / (a + i)
      sum += term
      if (Math.abs(term) < 1e-10 * Math.abs(sum)) break
    }
    return sum * Math.exp(-x + a * Math.log(x) - logGamma(a))
  } else {
    // Continued fraction
    let b = x + 1 - a
    let c = 1e30
    let d = 1 / b
    let h = d
    for (let i = 1; i <= 200; i++) {
      const an = -i * (i - a)
      b += 2
      d = an * d + b
      c = b + an / c
      if (Math.abs(d) < 1e-30) d = 1e-30
      if (Math.abs(c) < 1e-30) c = 1e-30
      d = 1 / d
      const del = d * c
      h *= del
      if (Math.abs(del - 1) < 1e-10) break
    }
    return 1 - Math.exp(-x + a * Math.log(x) - logGamma(a)) * h
  }
}

// Log gamma function
export function logGamma(x: number): number {
  // Stirling's approximation
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5]
  let y = x
  let tmp = x + 5.5
  tmp -= (x + 0.5) * Math.log(tmp)
  let ser = 1.000000000190015
  for (let j = 0; j < 6; j++) {
    ser += c[j] / ++y
  }
  return -tmp + Math.log(2.5066282746310005 * ser / x)
}

// Regularized incomplete beta function B(x; a, b) / B(a, b)
export function incompleteBeta(a: number, b: number, x: number): number {
  if (x < 0 || x > 1) return NaN
  if (x === 0) return 0
  if (x === 1) return 1
  const bt = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x))
  if (x < (a + 1) / (a + b + 2)) {
    return bt * betaCF(a, b, x) / a
  } else {
    return 1 - bt * betaCF(b, a, 1 - x) / b
  }
}

// Continued fraction for incomplete beta
function betaCF(a: number, b: number, x: number): number {
  const maxIter = 200
  const eps = 3e-7
  const fpMin = 1e-30
  const qab = a + b
  const qap = a + 1
  const qam = a - 1
  let c = 1
  let d = 1 - qab * x / qap
  if (Math.abs(d) < fpMin) d = fpMin
  d = 1 / d
  let h = d
  for (let m = 1; m <= maxIter; m++) {
    const m2 = 2 * m
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2))
    d = 1 + aa * d
    if (Math.abs(d) < fpMin) d = fpMin
    c = 1 + aa / c
    if (Math.abs(c) < fpMin) c = fpMin
    d = 1 / d
    h *= d * c
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2))
    d = 1 + aa * d
    if (Math.abs(d) < fpMin) d = fpMin
    c = 1 + aa / c
    if (Math.abs(c) < fpMin) c = fpMin
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < eps) break
  }
  return h
}

// Pearson correlation coefficient
export function pearsonR(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 2) return NaN
  const n = x.length
  const mx = x.reduce((a, b) => a + b, 0) / n
  const my = y.reduce((a, b) => a + b, 0) / n
  let num = 0, dx2 = 0, dy2 = 0
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx
    const dy = y[i] - my
    num += dx * dy
    dx2 += dx * dx
    dy2 += dy * dy
  }
  return num / Math.sqrt(dx2 * dy2)
}

// Spearman rank correlation
export function spearmanR(x: number[], y: number[]): number {
  const rx = rankArray(x)
  const ry = rankArray(y)
  return pearsonR(rx, ry)
}

// Rank array (handling ties with average rank)
export function rankArray(arr: number[]): number[] {
  const sorted = arr.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v)
  const ranks = new Array(arr.length)
  let i = 0
  while (i < sorted.length) {
    let j = i
    while (j < sorted.length - 1 && sorted[j + 1].v === sorted[i].v) j++
    const rank = (i + j) / 2 + 1
    for (let k = i; k <= j; k++) ranks[sorted[k].i] = rank
    i = j + 1
  }
  return ranks
}

// Mean of array
export function mean(arr: number[]): number {
  if (arr.length === 0) return NaN
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

// Variance of array (sample variance by default)
export function variance(arr: number[], population = false): number {
  if (arr.length < 2) return NaN
  const m = mean(arr)
  const ss = arr.reduce((sum, x) => sum + (x - m) ** 2, 0)
  return ss / (population ? arr.length : arr.length - 1)
}

// Standard deviation
export function sd(arr: number[], population = false): number {
  return Math.sqrt(variance(arr, population))
}

// Median
export function median(arr: number[]): number {
  if (arr.length === 0) return NaN
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

// Percentile (0-100)
export function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return NaN
  const sorted = [...arr].sort((a, b) => a - b)
  const index = (p / 100) * (sorted.length - 1)
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  if (lower === upper) return sorted[lower]
  return sorted[lower] + (index - lower) * (sorted[upper] - sorted[lower])
}

// Skewness (Fisher's)
export function skewness(arr: number[]): number {
  if (arr.length < 3) return NaN
  const n = arr.length
  const m = mean(arr)
  const s = sd(arr)
  if (s === 0) return 0
  const sum = arr.reduce((acc, x) => acc + ((x - m) / s) ** 3, 0)
  return (n / ((n - 1) * (n - 2))) * sum
}

// Kurtosis (excess kurtosis)
export function kurtosis(arr: number[]): number {
  if (arr.length < 4) return NaN
  const n = arr.length
  const m = mean(arr)
  const s = sd(arr)
  if (s === 0) return 0
  const sum = arr.reduce((acc, x) => acc + ((x - m) / s) ** 4, 0)
  const k = (n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3)) * sum
  const correction = 3 * (n - 1) ** 2 / ((n - 2) * (n - 3))
  return k - correction
}

// Quantile-quantile data for normal Q-Q plot
export function qqNormalData(arr: number[]): { theoretical: number; observed: number }[] {
  const sorted = [...arr].sort((a, b) => a - b)
  const n = sorted.length
  return sorted.map((v, i) => {
    const p = (i + 0.5) / n
    // Rational approximation for normal quantile
    const theoretical = normalQuantile(p)
    return { theoretical, observed: v }
  })
}

// Normal quantile (inverse CDF) - rational approximation
export function normalQuantile(p: number): number {
  if (p <= 0) return -Infinity
  if (p >= 1) return Infinity
  if (p < 0.5) return -rationalApproxNQ(Math.sqrt(-2 * Math.log(p)))
  return rationalApproxNQ(Math.sqrt(-2 * Math.log(1 - p)))
}

function rationalApproxNQ(t: number): number {
  const c = [2.515517, 0.802853, 0.010328]
  const d = [1.432788, 0.189269, 0.001308]
  return t - (c[0] + t * (c[1] + t * c[2])) / (1 + t * (d[0] + t * (d[1] + t * d[2])))
}

// Matrix multiplication (2D arrays)
export function matMul(A: number[][], B: number[][]): number[][] {
  const m = A.length, n = B[0].length, k = B.length
  const C = Array.from({ length: m }, () => new Array(n).fill(0))
  for (let i = 0; i < m; i++)
    for (let j = 0; j < n; j++)
      for (let l = 0; l < k; l++)
        C[i][j] += A[i][l] * B[l][j]
  return C
}

// Matrix transpose
export function transpose(A: number[][]): number[][] {
  return A[0].map((_, i) => A.map(row => row[i]))
}

// Matrix inverse using Gauss-Jordan elimination
export function matInverse(A: number[][]): number[][] {
  const n = A.length
  const aug = A.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => i === j ? 1 : 0)])
  for (let col = 0; col < n; col++) {
    let pivot = col
    for (let row = col + 1; row < n; row++)
      if (Math.abs(aug[row][col]) > Math.abs(aug[pivot][col])) pivot = row;
    [aug[col], aug[pivot]] = [aug[pivot], aug[col]]
    const pivotVal = aug[col][col]
    if (Math.abs(pivotVal) < 1e-10) throw new Error('Matrix is singular')
    for (let j = 0; j < 2 * n; j++) aug[col][j] /= pivotVal
    for (let row = 0; row < n; row++) {
      if (row === col) continue
      const factor = aug[row][col]
      for (let j = 0; j < 2 * n; j++) aug[row][j] -= factor * aug[col][j]
    }
  }
  return aug.map(row => row.slice(n))
}

// Solve linear system Ax = b using Gaussian elimination
export function solveLin(A: number[][], b: number[]): number[] {
  const n = A.length
  const aug = A.map((row, i) => [...row, b[i]])
  for (let col = 0; col < n; col++) {
    let pivot = col
    for (let row = col + 1; row < n; row++)
      if (Math.abs(aug[row][col]) > Math.abs(aug[pivot][col])) pivot = row;
    [aug[col], aug[pivot]] = [aug[pivot], aug[col]]
    const pv = aug[col][col]
    if (Math.abs(pv) < 1e-12) continue
    for (let j = col; j <= n; j++) aug[col][j] /= pv
    for (let row = 0; row < n; row++) {
      if (row === col) continue
      const f = aug[row][col]
      for (let j = col; j <= n; j++) aug[row][j] -= f * aug[col][j]
    }
  }
  return aug.map(row => row[n])
}

// Encode categorical variable to dummy variables (one-hot, drop first)
export function encodeCategories(data: DataRow[], column: string, refCategory?: string): {
  names: string[]
  matrix: number[][]
  categories: string[]
  ref: string
} {
  const cats = getUniqueCategories(data, column)
  const ref = refCategory ?? cats[0]
  const nonRef = cats.filter(c => c !== ref)
  const names = nonRef.map(c => `${column}_${c}`)
  const matrix = data.map(row => {
    const val = row[column] !== null && row[column] !== undefined ? String(row[column]) : null
    return nonRef.map(c => val === c ? 1 : 0)
  })
  return { names, matrix, categories: cats, ref }
}

// Sigmoid function
export function sigmoid(x: number): number {
  if (x >= 0) {
    const e = Math.exp(-x)
    return 1 / (1 + e)
  } else {
    const e = Math.exp(x)
    return e / (1 + e)
  }
}

// Count frequencies of categorical values
export function countFrequencies(values: string[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const v of values) {
    map.set(v, (map.get(v) ?? 0) + 1)
  }
  return map
}

// Cramér's V effect size for chi-square
export function cramersV(chiSq: number, n: number, rows: number, cols: number): number {
  return Math.sqrt(chiSq / (n * (Math.min(rows, cols) - 1)))
}

// Cohen's d for effect size (t-test)
export function cohensD(mean1: number, mean2: number, sd1: number, sd2: number, n1: number, n2: number): number {
  const pooledSD = Math.sqrt(((n1 - 1) * sd1 ** 2 + (n2 - 1) * sd2 ** 2) / (n1 + n2 - 2))
  return Math.abs(mean1 - mean2) / pooledSD
}
