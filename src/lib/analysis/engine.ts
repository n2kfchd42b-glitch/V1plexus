// Main analysis engine - dispatches to specific analysis modules

import type { DataRow, AnalysisResult } from './types'
import type { AnalysisType } from '@/types/database'

import { runDescriptive } from './descriptive'
import { runFrequency } from './frequencies'
import { runChiSquare, runTTest, runAnova, runCorrelation } from './tests'
import { runSimpleRegression, runMultipleRegression, runLogisticRegression, runPoissonRegression } from './regression'
import { runKaplanMeier, runCoxRegression } from './survival'
import { runTimeSeries, runPCA, runClusterAnalysis } from './multivariate'
import { runMetaAnalysis, runOutbreakInvestigation, runSampleSize } from './special'

export type { DataRow, AnalysisResult } from './types'

export async function runAnalysis(
  analysisType: AnalysisType,
  data: DataRow[],
  config: Record<string, unknown>
): Promise<AnalysisResult> {
  try {
    switch (analysisType) {
      case 'descriptive':
        return runDescriptive(data, config as unknown as Parameters<typeof runDescriptive>[1])
      case 'frequency':
        return runFrequency(data, config as unknown as Parameters<typeof runFrequency>[1])
      case 'chi_square':
        return runChiSquare(data, config as unknown as Parameters<typeof runChiSquare>[1])
      case 't_test':
        return runTTest(data, config as unknown as Parameters<typeof runTTest>[1])
      case 'anova':
        return runAnova(data, config as unknown as Parameters<typeof runAnova>[1])
      case 'correlation':
        return runCorrelation(data, config as unknown as Parameters<typeof runCorrelation>[1])
      case 'simple_regression':
        return runSimpleRegression(data, config as unknown as Parameters<typeof runSimpleRegression>[1])
      case 'multiple_regression':
        return runMultipleRegression(data, config as unknown as Parameters<typeof runMultipleRegression>[1])
      case 'logistic_regression':
        return runLogisticRegression(data, config as unknown as Parameters<typeof runLogisticRegression>[1])
      case 'multinomial_regression': {
        // Approximation: one-vs-rest binary logistic regressions
        const mnRes = runLogisticRegression(data, config as unknown as Parameters<typeof runLogisticRegression>[1])
        return {
          ...mnRes,
          interpretation: '⚠️ Approximation: results shown are from a binary logistic regression (one-vs-rest). '
            + 'True multinomial logistic regression requires simultaneous MLE across all outcome categories. '
            + 'Treat relative risk ratios and confidence intervals as indicative only.\n\n'
            + (mnRes.interpretation ?? '')
        }
      }
      case 'ordinal_regression': {
        // Approximation: binary logistic instead of proportional odds
        const orRes = runLogisticRegression(data, config as unknown as Parameters<typeof runLogisticRegression>[1])
        return {
          ...orRes,
          interpretation: '⚠️ Approximation: results shown are from a binary logistic regression. '
            + 'True ordinal logistic (proportional odds) regression requires IRLS estimation and produces '
            + 'separate threshold parameters for each category boundary. '
            + 'Proportional odds assumption is not tested here.\n\n'
            + (orRes.interpretation ?? '')
        }
      }
      case 'poisson_regression':
        return runPoissonRegression(data, config as unknown as Parameters<typeof runPoissonRegression>[1])
      case 'negbinomial_regression': {
        // Approximation: Poisson regression (theta = ∞ = no overdispersion correction)
        const nbRes = runPoissonRegression(data, config as unknown as Parameters<typeof runPoissonRegression>[1])
        return {
          ...nbRes,
          interpretation: '⚠️ Approximation: results shown use Poisson regression (θ = ∞). '
            + 'True negative binomial regression estimates a dispersion parameter (θ) via MLE to account for overdispersion. '
            + 'If your count data is overdispersed (variance > mean), standard errors and p-values shown here will be too narrow.\n\n'
            + (nbRes.interpretation ?? '')
        }
      }
      case 'kaplan_meier':
        return runKaplanMeier(data, config as unknown as Parameters<typeof runKaplanMeier>[1])
      case 'cox_regression':
        return runCoxRegression(data, config as unknown as Parameters<typeof runCoxRegression>[1])
      case 'time_series':
        return runTimeSeries(data, config as unknown as Parameters<typeof runTimeSeries>[1])
      case 'pca':
        return runPCA(data, config as unknown as Parameters<typeof runPCA>[1])
      case 'factor_analysis': {
        // Approximation: PCA used as proxy for EFA (no rotation, no communality iteration)
        const faRes = runPCA(data, { ...config, nComponents: config.nFactors ?? 3 } as unknown as Parameters<typeof runPCA>[1])
        return {
          ...faRes,
          interpretation: '⚠️ Approximation: results shown are from PCA, used as a proxy for factor analysis. '
            + 'True exploratory factor analysis (EFA) uses iterated principal axis factoring with varimax or promax rotation '
            + 'and iterates until communalities converge. Loadings, communalities, and factor scores shown here '
            + 'will differ from those produced by true EFA software (R fa(), SPSS FACTOR).\n\n'
            + (faRes.interpretation ?? '')
        }
      }
      case 'cluster_analysis':
        return runClusterAnalysis(data, config as unknown as Parameters<typeof runClusterAnalysis>[1])
      case 'meta_analysis':
        return runMetaAnalysis(data, config as unknown as Parameters<typeof runMetaAnalysis>[1])
      case 'spatial_analysis':
        return { type: 'spatial_analysis', summary: { note: 'Spatial analysis requires map data' }, tables: [], charts: [], interpretation: 'Spatial analysis produces a choropleth map. Upload GeoJSON and case data to visualize.' }
      case 'outbreak_investigation':
        return runOutbreakInvestigation(data, config as unknown as Parameters<typeof runOutbreakInvestigation>[1])
      case 'sample_size':
        return runSampleSize(config as unknown as Parameters<typeof runSampleSize>[0])
      default:
        return { type: analysisType, summary: {}, tables: [], charts: [], interpretation: 'Analysis type not implemented.' }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error occurred'
    return {
      type: analysisType,
      summary: { error: message },
      tables: [],
      charts: [],
      interpretation: `Analysis failed: ${message}`
    }
  }
}

// Parse CSV data from string
export function parseCSVData(csvString: string): DataRow[] {
  const lines = csvString.trim().split('\n')
  if (lines.length < 2) return []
  const headers = parseCSVLine(lines[0])
  return lines.slice(1).map(line => {
    const values = parseCSVLine(line)
    const row: DataRow = {}
    headers.forEach((h, i) => {
      const val = values[i]
      if (val === '' || val === undefined) {
        row[h] = null
      } else {
        const num = Number(val)
        row[h] = isNaN(num) ? val : num
      }
    })
    return row
  })
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = '', inQuotes = false
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') {
      inQuotes = !inQuotes
    } else if (line[i] === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += line[i]
    }
  }
  result.push(current.trim())
  return result
}

// Detect column types from data
export function detectColumnTypes(data: DataRow[]): Record<string, 'numeric' | 'categorical' | 'date' | 'binary'> {
  if (data.length === 0) return {}
  const columns = Object.keys(data[0])
  const types: Record<string, 'numeric' | 'categorical' | 'date' | 'binary'> = {}

  for (const col of columns) {
    const vals = data.map(row => row[col]).filter(v => v !== null && v !== undefined && v !== '')
    if (vals.length === 0) { types[col] = 'categorical'; continue }

    const uniqueVals = new Set(vals.map(v => String(v).toLowerCase()))

    // Check binary
    if (uniqueVals.size <= 2 && (
      [...uniqueVals].every(v => ['0', '1', 'yes', 'no', 'true', 'false', 'y', 'n'].includes(v))
    )) {
      types[col] = 'binary'
      continue
    }

    // Check date
    const datePattern = /^\d{4}-\d{2}-\d{2}|^\d{1,2}\/\d{1,2}\/\d{4}/
    if (vals.slice(0, 10).every(v => datePattern.test(String(v)))) {
      types[col] = 'date'
      continue
    }

    // Check numeric
    const numericCount = vals.filter(v => !isNaN(Number(v))).length
    if (numericCount / vals.length > 0.9) {
      types[col] = uniqueVals.size <= 2 ? 'binary' : 'numeric'
      continue
    }

    types[col] = 'categorical'
  }
  return types
}
