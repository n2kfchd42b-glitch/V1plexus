// Quality engine — not yet deployed. Stubs only.

export interface ColumnInfo {
  name: string
  type: string
  sample_values?: unknown[]
}

export function runQualityChecks() { return [] }

export function calculateQualityScore() {
  return {
    overall_score: 0,
    completeness: null,
    validity: null,
    uniqueness: null,
    consistency: null,
    errors_count: 0,
    warnings_count: 0,
  }
}

export function generateAutoRules(_columns: ColumnInfo[]) { return [] }
