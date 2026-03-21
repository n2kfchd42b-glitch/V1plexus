// Multivariate analyses: Time Series, PCA, Factor Analysis, Cluster Analysis

import type { DataRow, AnalysisResult, ResultTable } from './types'
import { getNumericValues, mean, sd, variance, pearsonR, transpose, matMul, matInverse, fmt, formatPValue, getSig } from './utils'

// ===================== TIME SERIES =====================

export interface TimeSeriesConfig {
  dateVariable: string
  valueVariable: string
  movingAvgWindow: number
  decompose: boolean
}

export function runTimeSeries(data: DataRow[], config: TimeSeriesConfig): AnalysisResult {
  const { dateVariable, valueVariable, movingAvgWindow = 12, decompose = true } = config

  const sorted = data
    .map(row => ({
      date: String(row[dateVariable] ?? ''),
      value: parseFloat(String(row[valueVariable] ?? ''))
    }))
    .filter(r => r.date && !isNaN(r.value))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  const n = sorted.length
  const values = sorted.map(r => r.value)

  // Moving average
  const maWindow = Math.min(movingAvgWindow, Math.floor(n / 2))
  const trend = values.map((_, i) => {
    const start = Math.max(0, i - Math.floor(maWindow / 2))
    const end = Math.min(n, start + maWindow)
    const window = values.slice(start, end)
    return window.reduce((a, b) => a + b, 0) / window.length
  })

  // Seasonal decomposition (simple additive)
  const seasonal = new Array(n).fill(0)
  if (decompose && n >= 24) {
    const period = 12 // assume monthly
    for (let s = 0; s < period; s++) {
      const seasonVals = values.filter((_, i) => i % period === s)
      const seasonMean = seasonVals.reduce((a, b) => a + b, 0) / seasonVals.length
      const overallMean = mean(values)
      const sf = seasonMean - overallMean
      for (let i = s; i < n; i += period) seasonal[i] = sf
    }
  }

  const residuals = values.map((v, i) => v - trend[i] - seasonal[i])

  // ACF (first 20 lags)
  const acfData: { lag: number; acf: number }[] = []
  const vm = mean(values)
  const ss = values.reduce((s, v) => s + (v - vm) ** 2, 0)
  for (let lag = 1; lag <= Math.min(20, Math.floor(n / 4)); lag++) {
    let cov = 0
    for (let i = lag; i < n; i++) cov += (values[i] - vm) * (values[i - lag] - vm)
    acfData.push({ lag, acf: cov / ss })
  }

  // Summary statistics
  const valMean = mean(values)
  const valSD = sd(values)
  const min = Math.min(...values)
  const max = Math.max(...values)

  const chartData = sorted.map((r, i) => ({
    date: r.date,
    observed: r.value,
    trend: trend[i],
    seasonal: seasonal[i],
    residual: residuals[i]
  }))

  const tables: ResultTable[] = [
    {
      id: 'summary', title: 'Time Series Summary', headers: ['Statistic', 'Value'],
      rows: [['N observations', n], ['Mean', fmt(valMean)], ['SD', fmt(valSD)], ['Min', fmt(min)], ['Max', fmt(max)], ['Moving avg window', maWindow]]
    },
    {
      id: 'acf', title: 'Autocorrelation Function (ACF)',
      headers: ['Lag', 'ACF'],
      rows: acfData.map(r => [r.lag, fmt(r.acf, 4)])
    }
  ]

  return {
    type: 'time_series',
    summary: { n, mean: fmt(valMean), sd: fmt(valSD) },
    tables,
    charts: [
      { type: 'time_series', title: `${valueVariable} Over Time`, data: chartData, config: { hasDecomposition: decompose && n >= 24 } },
      { type: 'acf_plot', title: 'Autocorrelation', data: acfData, config: { n } }
    ],
    interpretation: `Time series of ${valueVariable} (n=${n} observations). Mean = ${fmt(valMean, 2)}, SD = ${fmt(valSD, 2)}. ` +
      `Range: ${fmt(min, 2)} to ${fmt(max, 2)}. ` +
      (decompose ? 'Additive decomposition into trend, seasonal, and residual components applied.' : '')
  }
}

// ===================== PCA =====================

export interface PCAConfig {
  variables: string[]
  nComponents: number
  standardize: boolean
}

export function runPCA(data: DataRow[], config: PCAConfig): AnalysisResult {
  const { variables, nComponents = 2, standardize = true } = config

  // Build data matrix
  const completeCases = data.filter(row =>
    variables.every(v => {
      const val = parseFloat(String(row[v] ?? ''))
      return !isNaN(val)
    })
  )
  const n = completeCases.length
  const p = variables.length
  const nComp = Math.min(nComponents, p)

  if (n < p + 1) {
    return { type: 'pca', summary: { error: 'Insufficient observations' }, tables: [], charts: [], interpretation: 'Error: insufficient observations' }
  }

  // Build data matrix X (n × p)
  const X: number[][] = completeCases.map(row =>
    variables.map(v => parseFloat(String(row[v])))
  )

  // Center and optionally scale
  const means = variables.map((_, j) => mean(X.map(row => row[j])))
  const sds = variables.map((_, j) => sd(X.map(row => row[j])))

  const Xstd: number[][] = X.map(row =>
    row.map((xij, j) => (xij - means[j]) / (standardize ? sds[j] : 1))
  )

  // Covariance/correlation matrix
  const Xt = transpose(Xstd)
  const covMatrix: number[][] = Array.from({ length: p }, (_, i) =>
    Array.from({ length: p }, (_, j) =>
      Xt[i].reduce((sum, xi, k) => sum + xi * Xt[j][k], 0) / (n - 1)
    )
  )

  // Power iteration for top eigenvalues/eigenvectors
  const { eigenvalues, eigenvectors } = powerIteration(covMatrix, nComp)

  const totalVariance = eigenvalues.reduce((a, b) => a + b, eigenvalues.reduce((a, b) => a + b, 0))
  const sumAll = covMatrix.reduce((sum, row, i) => sum + row[i], 0)
  const varExplained = eigenvalues.slice(0, nComp).map(ev => ev / sumAll * 100)
  const cumVar = varExplained.map((_, i) => varExplained.slice(0, i + 1).reduce((a, b) => a + b, 0))

  // Scores (n × nComp)
  const scores = Xstd.map(row =>
    eigenvectors.map(ev => row.reduce((sum, xij, j) => sum + xij * ev[j], 0))
  )

  const screeData = eigenvalues.slice(0, Math.min(p, 10)).map((ev, i) => ({
    component: i + 1,
    eigenvalue: ev,
    varExplained: ev / sumAll * 100,
    cumVar: eigenvalues.slice(0, i + 1).reduce((a, b) => a + b, 0) / sumAll * 100
  }))

  // Loadings table
  const loadingHeaders = ['Variable', ...Array.from({ length: nComp }, (_, i) => `PC${i + 1}`), 'Communality']
  const loadingRows: (string | number | null)[][] = variables.map((v, j) => {
    const loads = eigenvectors.map(ev => ev[j])
    const communality = loads.slice(0, nComp).reduce((sum, l) => sum + l ** 2, 0)
    return [v, ...loads.slice(0, nComp).map(l => fmt(l, 3)), fmt(communality, 3)]
  })

  // Biplot data
  const biplotData = {
    scores: scores.map((s, i) => ({ id: i, pc1: s[0], pc2: s[1] || 0 })),
    loadings: variables.map((v, j) => ({
      variable: v,
      pc1: eigenvectors[0][j] * Math.sqrt(eigenvalues[0]),
      pc2: eigenvectors[1]?.[j] * Math.sqrt(eigenvalues[1] || 0) || 0
    }))
  }

  const tables: ResultTable[] = [
    {
      id: 'eigenvalues', title: 'Eigenvalues and Variance Explained',
      headers: ['Component', 'Eigenvalue', '% Variance', 'Cumulative %'],
      rows: screeData.map(r => [r.component, fmt(r.eigenvalue, 4), fmt(r.varExplained, 2) + '%', fmt(r.cumVar, 2) + '%'])
    },
    {
      id: 'loadings', title: 'Component Loadings', headers: loadingHeaders, rows: loadingRows
    }
  ]

  return {
    type: 'pca',
    summary: { n, p, nComp, varExplained1: fmt(varExplained[0], 1), varExplained2: fmt(varExplained[1] || 0, 1) },
    tables,
    charts: [
      { type: 'scree_plot', title: 'Scree Plot', data: screeData, config: {} },
      { type: 'biplot', title: 'Biplot (PC1 × PC2)', data: biplotData, config: { variables } }
    ],
    interpretation: `PCA on ${p} variables (n=${n}). PC1 explains ${fmt(varExplained[0], 1)}% of variance, ` +
      `PC2 explains ${fmt(varExplained[1] || 0, 1)}%. ` +
      `First ${nComp} components explain ${fmt(cumVar[nComp - 1], 1)}% of total variance.`
  }
}

// Power iteration for eigendecomposition
function powerIteration(A: number[][], k: number): { eigenvalues: number[]; eigenvectors: number[][] } {
  const n = A.length
  const eigenvalues: number[] = []
  const eigenvectors: number[][] = []
  let B = A.map(row => [...row])

  for (let comp = 0; comp < k; comp++) {
    let v: number[] = Array.from({ length: n }, (_, i) => i === 0 ? 1 : 0)
    let lambda = 0

    for (let iter = 0; iter < 200; iter++) {
      const Bv = B.map(row => row.reduce((sum, bij, j) => sum + bij * v[j], 0))
      const norm = Math.sqrt(Bv.reduce((s, x) => s + x * x, 0))
      if (norm < 1e-12) break
      const vNew = Bv.map(x => x / norm)
      const lambdaNew = norm
      const diff = Math.abs(lambdaNew - lambda) + vNew.reduce((s, x, i) => s + Math.abs(x - v[i]), 0)
      v = vNew; lambda = lambdaNew
      if (diff < 1e-8) break
    }

    eigenvalues.push(Math.max(0, lambda))
    eigenvectors.push(v)

    // Deflation
    B = B.map((row, i) => row.map((bij, j) => bij - lambda * v[i] * v[j]))
  }

  return { eigenvalues, eigenvectors }
}

// ===================== CLUSTER ANALYSIS =====================

export interface ClusterConfig {
  variables: string[]
  method: 'kmeans' | 'hierarchical'
  nClusters: number
  standardize: boolean
}

export function runClusterAnalysis(data: DataRow[], config: ClusterConfig): AnalysisResult {
  const { variables, method, nClusters = 3, standardize = true } = config

  const completeCases = data.filter(row =>
    variables.every(v => !isNaN(parseFloat(String(row[v] ?? ''))))
  )
  const n = completeCases.length
  const p = variables.length

  // Build and optionally scale matrix
  const X: number[][] = completeCases.map(row => variables.map(v => parseFloat(String(row[v]))))
  const means = variables.map((_, j) => mean(X.map(row => row[j])))
  const sds = variables.map((_, j) => sd(X.map(row => row[j])))
  const Xscaled = standardize ? X.map(row => row.map((xij, j) => sds[j] > 0 ? (xij - means[j]) / sds[j] : 0)) : X

  let assignments: number[]
  let centers: number[][]
  let wcss: number

  if (method === 'kmeans') {
    const result = kMeans(Xscaled, nClusters)
    assignments = result.assignments
    centers = result.centers
    wcss = result.wcss
  } else {
    assignments = hierarchicalClustering(Xscaled, nClusters)
    centers = Array.from({ length: nClusters }, (_, k) => {
      const clusterPoints = Xscaled.filter((_, i) => assignments[i] === k)
      if (clusterPoints.length === 0) return variables.map(() => 0)
      return variables.map((_, j) => mean(clusterPoints.map(row => row[j])))
    })
    wcss = assignments.reduce((sum, cluster, i) => {
      const c = centers[cluster]
      return sum + Xscaled[i].reduce((s, xij, j) => s + (xij - c[j]) ** 2, 0)
    }, 0)
  }

  // Cluster sizes
  const clusterSizes = Array.from({ length: nClusters }, (_, k) => assignments.filter(a => a === k).length)

  // Silhouette scores (simplified)
  const silhouettes = assignments.map((cluster, i) => {
    const sameCluster = Xscaled.filter((_, j) => assignments[j] === cluster && j !== i)
    if (sameCluster.length === 0) return 0
    const a = mean(sameCluster.map(row => euclidean(Xscaled[i], row)))
    const bs = Array.from({ length: nClusters }, (_, k) => {
      if (k === cluster) return Infinity
      const otherCluster = Xscaled.filter((_, j) => assignments[j] === k)
      return otherCluster.length > 0 ? mean(otherCluster.map(row => euclidean(Xscaled[i], row))) : Infinity
    })
    const b = Math.min(...bs)
    return b === Infinity ? 0 : (b - a) / Math.max(a, b)
  })

  const avgSilhouette = mean(silhouettes)

  // Center table (un-scaled)
  const centerRows: (string | number | null)[][] = Array.from({ length: nClusters }, (_, k) => [
    k + 1,
    clusterSizes[k],
    ...variables.map((v, j) => fmt(means[j] + centers[k][j] * (standardize ? sds[j] : 1)))
  ])

  const tables: ResultTable[] = [
    {
      id: 'cluster_centers', title: 'Cluster Centers',
      headers: ['Cluster', 'N', ...variables],
      rows: centerRows
    },
    {
      id: 'cluster_quality', title: 'Cluster Quality', headers: ['Metric', 'Value'],
      rows: [['N clusters', nClusters], ['WCSS', fmt(wcss)], ['Avg Silhouette', fmt(avgSilhouette, 3)]]
    }
  ]

  // PCA for scatter plot
  let scatterData: unknown[] = []
  if (p >= 2) {
    const { eigenvectors } = powerIteration(
      Xscaled[0].map((_, j) => Xscaled[0].map((__, k) => mean(Xscaled.map(row => row[j] * row[k])) - mean(Xscaled.map(row => row[j])) * mean(Xscaled.map(row => row[k])))),
      2
    )
    scatterData = Xscaled.map((row, i) => ({
      pc1: row.reduce((s, xij, j) => s + xij * (eigenvectors[0]?.[j] ?? (j === 0 ? 1 : 0)), 0),
      pc2: row.reduce((s, xij, j) => s + xij * (eigenvectors[1]?.[j] ?? (j === 1 ? 1 : 0)), 0),
      cluster: assignments[i] + 1
    }))
  }

  return {
    type: 'cluster_analysis',
    summary: { n, nClusters, wcss: fmt(wcss), avgSilhouette: fmt(avgSilhouette, 3) },
    tables,
    charts: [
      { type: 'cluster_scatter', title: 'Cluster Plot (PC1 × PC2)', data: scatterData, config: { nClusters } },
      { type: 'silhouette_plot', title: 'Silhouette Plot', data: silhouettes.map((s, i) => ({ id: i, silhouette: s, cluster: assignments[i] + 1 })), config: {} }
    ],
    interpretation: `${method === 'kmeans' ? 'K-means' : 'Hierarchical'} clustering with ${nClusters} clusters (n=${n}). ` +
      `Cluster sizes: ${clusterSizes.join(', ')}. ` +
      `Average silhouette score = ${fmt(avgSilhouette, 3)} (${avgSilhouette > 0.5 ? 'good' : avgSilhouette > 0.25 ? 'fair' : 'weak'} structure).`
  }
}

function euclidean(a: number[], b: number[]): number {
  return Math.sqrt(a.reduce((sum, ai, i) => sum + (ai - b[i]) ** 2, 0))
}

function kMeans(X: number[][], k: number, maxIter = 100): { assignments: number[]; centers: number[][]; wcss: number } {
  const n = X.length, p = X[0].length
  // K-means++ initialization
  const centers: number[][] = [X[Math.floor(Math.random() * n)].slice()]
  while (centers.length < k) {
    const dists = X.map(row => Math.min(...centers.map(c => euclidean(row, c) ** 2)))
    const sum = dists.reduce((a, b) => a + b, 0)
    let r = Math.random() * sum, idx = 0
    for (let i = 0; i < n; i++) { r -= dists[i]; if (r <= 0) { idx = i; break } }
    centers.push(X[idx].slice())
  }

  let assignments = new Array(n).fill(0)
  for (let iter = 0; iter < maxIter; iter++) {
    const newAssignments = X.map(row => {
      const dists = centers.map(c => euclidean(row, c))
      return dists.indexOf(Math.min(...dists))
    })
    const changed = newAssignments.some((a, i) => a !== assignments[i])
    assignments = newAssignments
    if (!changed) break

    for (let c = 0; c < k; c++) {
      const clusterPts = X.filter((_, i) => assignments[i] === c)
      if (clusterPts.length === 0) continue
      for (let j = 0; j < p; j++) centers[c][j] = mean(clusterPts.map(row => row[j]))
    }
  }

  const wcss = assignments.reduce((sum, cluster, i) => sum + euclidean(X[i], centers[cluster]) ** 2, 0)
  return { assignments, centers, wcss }
}

function hierarchicalClustering(X: number[][], k: number): number[] {
  const n = X.length
  // Single linkage hierarchical clustering
  const clusters = X.map((_, i) => [i])
  const dist = (c1: number[], c2: number[]) =>
    Math.min(...c1.flatMap(i => c2.map(j => euclidean(X[i], X[j]))))

  while (clusters.length > k) {
    let minDist = Infinity, mergeI = 0, mergeJ = 1
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const d = dist(clusters[i], clusters[j])
        if (d < minDist) { minDist = d; mergeI = i; mergeJ = j }
      }
    }
    clusters[mergeI] = [...clusters[mergeI], ...clusters[mergeJ]]
    clusters.splice(mergeJ, 1)
  }

  const assignments = new Array(n).fill(0)
  clusters.forEach((cluster, k) => cluster.forEach(i => { assignments[i] = k }))
  return assignments
}
