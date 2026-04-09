export type EstimationMethod = 'psm' | 'ipw' | 'doubly_robust'
export type EstimationStatus = 'pending' | 'running' | 'complete' | 'failed'

export interface BalanceRow {
  variable: string
  smd_before: number
  smd_after: number
  balanced: boolean
}

export interface EstimationResult {
  id: string
  dag_id: string
  dataset_id: string
  project_id: string
  method: EstimationMethod
  ate: number | null
  att: number | null
  ate_ci_lower: number | null
  ate_ci_upper: number | null
  att_ci_lower: number | null
  att_ci_upper: number | null
  std_error: number | null
  p_value: number | null
  diagnostics: Record<string, unknown>
  balance_table: BalanceRow[]
  bootstrap_estimates: number[]
  status: EstimationStatus
  error_message: string | null
  created_by: string | null
  created_at: string
  completed_at: string | null
}

export interface SensitivityPoint {
  rr_confounder_exposure: number
  rr_confounder_outcome_needed: number
  nullifies_effect: boolean
}

export interface EValueResult {
  evalue_id: string | null
  evalue_estimate: number
  evalue_ci_bound: number
  rr_input: number
  sensitivity_curve: SensitivityPoint[]
  interpretation: string
}

export interface NarrativeComponents {
  exposure: string
  outcome: string
  method_used: string
  ate: number | null
  ate_formatted: string
  ci_formatted: string
  p_formatted: string
  is_significant: boolean
  direction: string
  magnitude_descriptor: string
  adjustment_variables: string[]
  evalue: number | null
  evalue_ci: number | null
  estimates_consistent: boolean
  warnings: string[]
}

export interface NarrativeResult {
  narrative_id: string | null
  narrative_text: string
  narrative_components: NarrativeComponents
}
