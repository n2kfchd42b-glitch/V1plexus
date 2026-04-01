/**
 * Automatic Variable Type Detection and Categorical Encoding
 * 
 * Detects whether variables are continuous, binary, nominal, or ordinal
 * and automatically encodes them for analysis.
 */

import type { DataRow } from './types'

export type VariableType = 'continuous' | 'binary' | 'nominal' | 'ordinal'

export interface VariableClassification {
  name: string
  type: VariableType
  uniqueValues: (string | number)[]
  referenceCategory?: string | number  // For binary/nominal
  isMissing: boolean
}

export interface EncodedVariable {
  originalName: string
  originalType: VariableType
  encodedNames: string[]        // For one-hot: ["var_cat1", "var_cat2"], for binary: ["var"]
  encodedMatrix: number[][]
  mapping: Record<string, number> // Maps original values to encoded representation
  referenceCategory: string | number
}

// Default reference categories (checked in order)
const DEFAULT_REFERENCE_CATEGORIES = [
  'No', 'no', 'NO',
  'False', 'false', 'FALSE',
  'Control', 'control', 'CONTROL',
  'Unexposed', 'unexposed', 'UNEXPOSED',
  'Placebo', 'placebo', 'PLACEBO',
  '0'
]

/**
 * Classify each variable as continuous, binary, nominal, or ordinal
 */
export function classifyVariables(data: DataRow[]): VariableClassification[] {
  if (data.length === 0) return []

  const columns = Object.keys(data[0])
  const classifications: VariableClassification[] = []

  for (const col of columns) {
    const values = data.map(row => row[col]).filter(v => v !== null && v !== undefined && v !== '')
    const uniqueSet = new Set(values.map(v => (typeof v === 'string' ? v : String(v))))
    const uniqueArray = Array.from(uniqueSet).sort()
    const uniqueValues = uniqueArray.map((v: string) => {
      // Try to parse back to number if original was number
      const original = values.find(val => String(val) === v)
      return typeof original === 'number' ? original : v
    }) as (string | number)[]

    if (values.length === 0) {
      classifications.push({
        name: col,
        type: 'nominal',
        uniqueValues: [],
        isMissing: true
      })
      continue
    }

    const classification = classifyVariable(col, values as (string | number)[], uniqueValues)
    classifications.push(classification)
  }

  return classifications
}

/**
 * Classify a single variable
 */
function classifyVariable(
  name: string,
  values: unknown[],
  uniqueValues: (string | number)[]
): VariableClassification {
  // Check binary (exactly 2 unique values)
  if (uniqueValues.length === 2) {
    return {
      name,
      type: 'binary',
      uniqueValues,
      referenceCategory: findBinaryReference(uniqueValues),
      isMissing: false
    }
  }

  // Check if all numeric
  const allNumeric = values.every(v => typeof v === 'number' || !isNaN(Number(v)))

  if (allNumeric) {
    // Continuous: numeric with >2 unique values
    if (uniqueValues.length > 2) {
      return {
        name,
        type: 'continuous',
        uniqueValues,
        isMissing: false
      }
    }
  }

  // Nominal: categorical with 3+ unique values
  if (uniqueValues.length >= 3) {
    return {
      name,
      type: 'nominal',
      uniqueValues,
      referenceCategory: findCategoryReference(uniqueValues),
      isMissing: false
    }
  }

  // Fallback
  return {
    name,
    type: 'nominal',
    uniqueValues,
    referenceCategory: uniqueValues[0],
    isMissing: false
  }
}

/**
 * Find best reference category for binary variable
 * Priority: known reference categories (No/False/Control/etc), then alphabetically first
 */
function findBinaryReference(values: (string | number)[]): string | number {
  const strValues = values.map(v => String(v))

  // Check for known reference categories first
  for (const refCat of DEFAULT_REFERENCE_CATEGORIES) {
    if (strValues.includes(refCat)) return refCat
  }

  // Fall back to alphabetically first
  return strValues[0]
}

/**
 * Find best reference category for nominal variable
 * Same logic as binary: known reference categories, then alphabetically first
 */
function findCategoryReference(values: (string | number)[]): string | number {
  const strValues = values.map(v => String(v))

  // Check for known reference categories first
  for (const refCat of DEFAULT_REFERENCE_CATEGORIES) {
    if (strValues.includes(refCat)) return refCat
  }

  // Fall back to alphabetically first
  return strValues[0]
}

/**
 * Encode a binary variable to 0/1
 * Reference category -> 0, comparison category -> 1
 */
export function encodeBinary(
  data: DataRow[],
  columnName: string,
  referenceCategory: string | number
): EncodedVariable {
  const values = data.map(row => row[columnName])
  const uniqueVals = Array.from(new Set(values.filter(v => v !== null && v !== undefined && v !== '')))

  if (uniqueVals.length !== 2) {
    throw new Error(`Expected binary variable, got ${uniqueVals.length} unique values in ${columnName}`)
  }

  const ref = String(referenceCategory)
  const comparison = uniqueVals.find(v => String(v) !== ref)

  if (!comparison) {
    throw new Error(`Reference category ${ref} not found in ${columnName}`)
  }

  const encodedMatrix = values.map(v => {
    const strVal = String(v)
    if (strVal === ref) return [0]
    if (strVal === String(comparison)) return [1]
    return [0] // Treat missing as reference
  })

  return {
    originalName: columnName,
    originalType: 'binary',
    encodedNames: [columnName],
    encodedMatrix,
    mapping: {
      [ref]: 0,
      [String(comparison)]: 1
    },
    referenceCategory: ref
  }
}

/**
 * Encode a nominal variable using one-hot encoding
 * Drop reference category to avoid multicollinearity
 */
export function encodeNominal(
  data: DataRow[],
  columnName: string,
  referenceCategory: string | number
): EncodedVariable {
  const values = data.map(row => row[columnName])
  const uniqueVals = Array.from(
    new Set(values.filter(v => v !== null && v !== undefined && v !== ''))
  ).map(v => String(v)).sort()

  if (uniqueVals.length < 3) {
    throw new Error(`Expected categorical with 3+ values, got ${uniqueVals.length} in ${columnName}`)
  }

  const ref = String(referenceCategory)
  const nonRefVals = uniqueVals.filter(v => v !== ref)
  const encodedNames = nonRefVals.map(v => `${columnName}_${v}`)

  const encodedMatrix = values.map(v => {
    const strVal = v !== null && v !== undefined && v !== '' ? String(v) : ref
    return nonRefVals.map(cat => strVal === cat ? 1 : 0)
  })

  const mapping: Record<string, number> = {}
  nonRefVals.forEach((cat) => {
    mapping[cat] = 1  // Indicates this category is represented
  })
  mapping[ref] = 0  // Reference category

  return {
    originalName: columnName,
    originalType: 'nominal',
    encodedNames,
    encodedMatrix,
    mapping,
    referenceCategory: ref
  }
}

/**
 * Auto-encode all variables in dataset based on their type
 * Returns original data with categorical variables encoded + metadata
 */
export interface AutoEncodeResult {
  encodedData: number[][]           // Rows of numbers (all encoded)
  columnNames: string[]              // New column names (original continuous + encoded categorical)
  variableMetadata: VariableClassification[]
  encodingMap: Record<string, EncodedVariable> // Maps original column name to encoding
}

export function autoEncodeDataset(
  data: DataRow[],
  skipColumns?: Set<string>
): AutoEncodeResult {
  const classifications = classifyVariables(data)
  const encodingMap: Record<string, EncodedVariable> = {}
  const allEncodedColumns: { name: string; data: number[] }[] = []

  for (const classification of classifications) {
    if (skipColumns?.has(classification.name)) {
      continue
    }

    if (classification.type === 'continuous') {
      // Keep continuous as-is, just convert to numbers
      const numData = data.map(row => {
        const val = row[classification.name]
        return typeof val === 'number' ? val : Number(val) || 0
      })
      allEncodedColumns.push({ name: classification.name, data: numData })
    } else if (classification.type === 'binary') {
      const encoded = encodeBinary(data, classification.name, classification.referenceCategory!)
      encodingMap[classification.name] = encoded
      encoded.encodedMatrix.forEach((rowVals, rowIdx) => {
        if (rowIdx === 0) {
          rowVals.forEach((_, colIdx) => {
            allEncodedColumns.push({ name: encoded.encodedNames[colIdx], data: [] })
          })
        }
        rowVals.forEach((val, colIdx) => {
          allEncodedColumns[allEncodedColumns.length - rowVals.length + colIdx].data.push(val)
        })
      })
    } else if (classification.type === 'nominal') {
      const encoded = encodeNominal(data, classification.name, classification.referenceCategory!)
      encodingMap[classification.name] = encoded
      encoded.encodedMatrix.forEach((rowVals, rowIdx) => {
        if (rowIdx === 0) {
          rowVals.forEach((_, colIdx) => {
            allEncodedColumns.push({ name: encoded.encodedNames[colIdx], data: [] })
          })
        }
        rowVals.forEach((val, colIdx) => {
          const idx = allEncodedColumns.length - rowVals.length + colIdx
          if (idx >= 0 && idx < allEncodedColumns.length) {
            allEncodedColumns[idx].data.push(val)
          }
        })
      })
    }
  }

  // Build encoded data matrix
  const encodedData: number[][] = []
  for (let i = 0; i < data.length; i++) {
    encodedData.push(allEncodedColumns.map(col => col.data[i] !== undefined ? col.data[i] : 0))
  }

  return {
    encodedData,
    columnNames: allEncodedColumns.map(col => col.name),
    variableMetadata: classifications,
    encodingMap
  }
}

/**
 * Get configuration object for reference categories (user-configurable)
 */
export function createEncodingConfig(
  classifications: VariableClassification[],
  overrides?: Record<string, string | number>
): Record<string, string | number> {
  const config: Record<string, string | number> = {}

  for (const classification of classifications) {
    if (classification.type === 'binary' || classification.type === 'nominal') {
      const override = overrides?.[classification.name]
      config[classification.name] = override ?? classification.referenceCategory ?? classification.uniqueValues[0]
    }
  }

  return config
}
