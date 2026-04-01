/**
 * Integration utilities for automatic encoding
 * Helps components and frontend code work with the encoding system
 */

import { classifyVariables, createEncodingConfig } from './encoding'
import type { DataRow } from './types'
import type { VariableClassification } from './encoding'

/**
 * Inspect a dataset and return variable classifications
 * Useful for UI components showing variable types and reference categories
 */
export function inspectDataset(data: DataRow[]): {
  classifications: VariableClassification[]
  encodingConfig: Record<string, string | number>
} {
  const classifications = classifyVariables(data)
  const encodingConfig = createEncodingConfig(classifications)
  
  return {
    classifications,
    encodingConfig
  }
}

/**
 * Get a human-readable description of a variable's type
 */
export function describeVariableType(type: string): string {
  switch (type) {
    case 'continuous':
      return 'Continuous (numeric)'
    case 'binary':
      return 'Binary (two categories)'
    case 'nominal':
      return 'Nominal (multiple categories)'
    case 'ordinal':
      return 'Ordinal (ranked categories)'
    default:
      return 'Unknown'
  }
}

/**
 * Build a summary of encoding changes that will be applied
 */
export function buildEncodingSummary(classifications: VariableClassification[]): string[] {
  const summaries: string[] = []

  for (const classification of classifications) {
    if (classification.type === 'continuous') {
      summaries.push(`${classification.name}: continuous (${classification.uniqueValues.length} values) — kept as-is`)
    } else if (classification.type === 'binary') {
      summaries.push(
        `${classification.name}: binary (${classification.uniqueValues.join(', ')}) — ` +
        `will encode to 0/1 with reference = "${classification.referenceCategory}"`
      )
    } else if (classification.type === 'nominal') {
      summaries.push(
        `${classification.name}: nominal (${classification.uniqueValues.length} categories: ${
          classification.uniqueValues.slice(0, 3).join(', ')
        }${classification.uniqueValues.length > 3 ? '...' : ''}) — ` +
        `will use one-hot encoding with reference = "${classification.referenceCategory}"`
      )
    }
  }

  return summaries
}

/**
 * Helper to merge encoding config with user overrides
 * Returns final reference categories to use for analysis
 */
export function resolveEncodingConfig(
  classifications: VariableClassification[],
  userOverrides?: Record<string, string | number>
): Record<string, string | number> {
  const config: Record<string, string | number> = {}

  for (const classification of classifications) {
    if (classification.type === 'binary' || classification.type === 'nominal') {
      const override = userOverrides?.[classification.name]
      config[classification.name] = override ?? classification.referenceCategory ?? classification.uniqueValues[0]
    }
  }

  return config
}
