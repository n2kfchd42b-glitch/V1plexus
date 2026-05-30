/**
 * Wrappers for analysis functions with automatic categorical encoding
 * These can be used to add encoding to existing analysis modules
 */

import { classifyVariables, autoEncodeDataset, createEncodingConfig } from './encoding'
import type { DataRow, AnalysisResult, AnalysisConfig } from './types'
import type { VariableClassification, AutoEncodeResult } from './encoding'

export interface EncodingContext {
  originalData: DataRow[]
  originalColumns: string[]
  columnNames: string[]  // Encoded column names
  classifications: VariableClassification[]
  encodingConfig: Record<string, string | number>
  encodedResult: AutoEncodeResult
}

/**
 * Create a numeric matrix from data with automatic categorical encoding
 * Useful for regression and multivariate analyses
 * 
 * @param data - Raw data with mixed types
 * @returns Object with:
 *   - matrix: numeric n × p matrix ready for analysis
 *   - columnNames: mapped column names after encoding
 *   - encodingMap: information about what was encoded
 */
export function prepareNumericMatrix(data: DataRow[]): {
  matrix: number[][]
  columnNames: string[]
  encodingContext: EncodingContext
} {
  const originalColumns = data.length > 0 ? Object.keys(data[0]) : []
  const classifications = classifyVariables(data)
  const encodingConfig = createEncodingConfig(classifications)
  const encodedResult = autoEncodeDataset(data)

  return {
    matrix: encodedResult.encodedData,
    columnNames: encodedResult.columnNames,
    encodingContext: {
      originalData: data,
      originalColumns,
      columnNames: encodedResult.columnNames,
      classifications,
      encodingConfig,
      encodedResult
    }
  }
}

/**
 * Extract numeric matrix for a specific set of columns
 * Automatically encodes categorical predictors
 * 
 * @param data - Raw dataset
 * @param selectedColumns - Subset of columns to include
 * @returns Matrix with only selected columns (encoding applied to categorical)
 */
export function extractSelectedMatrix(data: DataRow[], selectedColumns: string[]): {
  matrix: number[][]
  columnNames: string[]
  encodingContext: EncodingContext
} {
  const originalColumns = data.length > 0 ? Object.keys(data[0]) : []
  const skipColumns = new Set(originalColumns.filter(c => !selectedColumns.includes(c)))
  
  const classifications = classifyVariables(data)
    .filter(c => selectedColumns.includes(c.name))
  
  const encodingConfig = createEncodingConfig(classifications)
  const encodedResult = autoEncodeDataset(data, skipColumns)

  return {
    matrix: encodedResult.encodedData,
    columnNames: encodedResult.columnNames,
    encodingContext: {
      originalData: data,
      originalColumns,
      columnNames: encodedResult.columnNames,
      classifications,
      encodingConfig,
      encodedResult
    }
  }
}

/**
 * Get the numeric position of a column after encoding
 * Useful for extracting a dependent variable
 * 
 * @param context - EncodingContext from prepareNumericMatrix or extractSelectedMatrix
 * @param originalColumnName - Name of column in original data
 * @returns Index in encoded matrix, or -1 if not found
 */
export function getEncodedColumnIndex(context: EncodingContext, originalColumnName: string): number {
  const classification = context.classifications.find(c => c.name === originalColumnName)
  if (!classification) return -1

  let colIndex = 0
  for (const c of context.classifications) {
    if (c.name === originalColumnName) {
      return colIndex
    }
    if (c.type === 'continuous') {
      colIndex += 1
    } else if (c.type === 'binary') {
      colIndex += 1
    } else if (c.type === 'nominal') {
      const nonRefCount = c.uniqueValues.length - 1  // Drop reference
      colIndex += nonRefCount
    }
  }
  return -1
}

/**
 * Get encoded column names for a specific original variable
 * 
 * @param context - EncodingContext from prepareNumericMatrix
 * @param originalColumnName - Name of column in original data
 * @returns Array of encoded column names (could be 1 for continuous/binary, N-1 for nominal)
 */
export function getEncodedColumnNames(context: EncodingContext, originalColumnName: string): string[] {
  const startIdx = getEncodedColumnIndex(context, originalColumnName)
  if (startIdx === -1) return []

  const classification = context.classifications.find(c => c.name === originalColumnName)
  if (!classification) return []

  if (classification.type === 'binary' || classification.type === 'continuous') {
    return [originalColumnName]
  }

  if (classification.type === 'nominal') {
    return context.columnNames.slice(startIdx, startIdx + classification.uniqueValues.length - 1)
  }

  return []
}

/**
 * Extract a numeric vector for a specific column (e.g., for outcome in regression)
 * Returns NaN for missing values
 */
export function extractVector(
  data: DataRow[],
  columnName: string,
  treatMissingAs?: number
): number[] {
  return data.map(row => {
    const val = row[columnName]
    if (val === null || val === undefined || val === '') {
      return treatMissingAs ?? NaN
    }
    const num = typeof val === 'number' ? val : parseFloat(String(val))
    return isNaN(num) ? (treatMissingAs ?? NaN) : num
  })
}

/**
 * Create a design matrix for a regression-like analysis
 * X: predictors (with encoding), y: outcome
 * Automatically removes rows with missing values
 */
export function createRegressionData(
  data: DataRow[],
  outcomeColumn: string,
  predictorColumns: string[]
): {
  X: number[][]          // Design matrix (n × k)
  y: number[]            // Outcome vector (n)
  columnNames: string[]  // Encoded predictor names (k)
  n: number              // Sample size (complete cases)
  k: number              // Number of predictors
  indexMapping: number[] // Row indices in original data that were kept (for traceability)
} {
  const { matrix, columnNames, encodingContext } = extractSelectedMatrix(
    data,
    [outcomeColumn, ...predictorColumns]
  )

  // Get outcome vector
  const fullY = extractVector(data, outcomeColumn)

  // Find complete cases (no missing in X or y)
  const completeCaseIndices: number[] = []
  const X: number[][] = []
  const y: number[] = []

  for (let i = 0; i < matrix.length; i++) {
    if (!isNaN(fullY[i]) && matrix[i].every(v => !isNaN(v))) {
      X.push(matrix[i])
      y.push(fullY[i])
      completeCaseIndices.push(i)
    }
  }

  // Filter column names to only include predictors (exclude outcome if it's in matrix)
  const outcomeIdx = encodingContext.originalColumns.indexOf(outcomeColumn)
  const predictorIndices = predictorColumns.map(p => encodingContext.originalColumns.indexOf(p))
  
  // Map encoded column names back to just predictors
  const encodedPredictorNames: string[] = []
  let colIdx = 0
  for (const classification of encodingContext.classifications) {
    if (!predictorColumns.includes(classification.name)) {
      // Skip this variable
      if (classification.type === 'continuous' || classification.type === 'binary') {
        colIdx += 1
      } else if (classification.type === 'nominal') {
        colIdx += classification.uniqueValues.length - 1
      }
    } else {
      // Include this variable
      if (classification.type === 'continuous' || classification.type === 'binary') {
        encodedPredictorNames.push(columnNames[colIdx])
        colIdx += 1
      } else if (classification.type === 'nominal') {
        const numNominalCols = classification.uniqueValues.length - 1
        encodedPredictorNames.push(...columnNames.slice(colIdx, colIdx + numNominalCols))
        colIdx += numNominalCols
      }
    }
  }

  return {
    X,
    y,
    columnNames: encodedPredictorNames,
    n: X.length,
    k: encodedPredictorNames.length,
    indexMapping: completeCaseIndices
  }
}

/**
 * Create a contingency table from categorical data
 * Useful for chi-square and other categorical tests
 * No encoding needed here, but helps with standardization
 */
export function createContingencyData(
  data: DataRow[],
  var1: string,
  var2: string
): {
  table: number[][]
  cat1Values: string[]
  cat2Values: string[]
  n: number
} {
  const classifications = classifyVariables(data)
  
  const vals1 = data
    .map(row => String(row[var1] ?? '').trim())
    .filter(v => v !== '' && v !== 'null' && v !== 'undefined')
  
  const vals2 = data
    .map(row => String(row[var2] ?? '').trim())
    .filter(v => v !== '' && v !== 'null' && v !== 'undefined')

  const cat1 = [...new Set(vals1)].sort()
  const cat2 = [...new Set(vals2)].sort()

  const table: number[][] = Array(cat1.length).fill([]).map(() => Array(cat2.length).fill(0))

  for (let i = 0; i < Math.min(vals1.length, vals2.length); i++) {
    const r = cat1.indexOf(vals1[i])
    const c = cat2.indexOf(vals2[i])
    if (r >= 0 && c >= 0) table[r][c]++
  }

  return {
    table,
    cat1Values: cat1,
    cat2Values: cat2,
    n: Math.min(vals1.length, vals2.length)
  }
}
