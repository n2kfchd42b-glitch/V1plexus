export interface AnalysisNarrative {
  id: string
  project_id: string
  dataset_id: string | null
  analysis_run_id: string | null
  analysis_type: string
  variables: Record<string, unknown>
  deterministic_text: string
  ai_text: string | null
  ai_requested: boolean
  ai_generated_at: string | null
  active_version: 'deterministic' | 'ai'
  components: Record<string, unknown>
  created_by: string | null
  created_at: string
}

export interface SensitivityComparison {
  label: string
  method_variant: string
  estimate: number | null
  ci_lower: number | null
  ci_upper: number | null
  p_value: number | null
  metric_label: string
  n: number
  note: string
}

export interface SensitivityResult {
  id: string
  project_id: string
  dataset_id: string
  analysis_type: string
  primary_variables: {
    outcome: string
    exposure: string
    covariates: string[]
  }
  comparisons: SensitivityComparison[]
  consistent: boolean | null
  created_at: string
}

export interface VariableProfile {
  name: string
  dtype: 'numeric' | 'categorical' | 'boolean' | 'datetime' | 'text'
  role_hint: string
  n_missing: number
  pct_missing: number
  unique_count: number
  is_constant: boolean
  is_id_like: boolean
  // numeric only
  mean?: number | null
  sd?: number | null
  min?: number | null
  max?: number | null
  p25?: number | null
  p50?: number | null
  p75?: number | null
  skewness?: number | null
  kurtosis?: number | null
  outlier_count?: number
  outlier_pct?: number
  // categorical
  top_values?: Array<{ value: string; count: number }>
}

export interface DataPortrait {
  id: string
  dataset_id: string
  project_id: string
  n_rows: number | null
  n_columns: number | null
  file_size_bytes: number | null
  overall_missing_pct: number | null
  missing_pattern: 'mcar' | 'mar' | 'mnar' | 'unknown' | null
  little_mcar_p_value: number | null
  missing_pattern_notes: string | null
  variable_profiles: VariableProfile[]
  imputation_recommendations: Array<{
    variable: string
    recommendation: string
    reason: string
  }>
  analysis_recommendations: Array<{
    analysis_type: string
    reason: string
    confidence: 'high' | 'medium' | 'low'
  }>
  status: 'pending' | 'running' | 'complete' | 'failed'
  error_message: string | null
  created_at: string
  completed_at: string | null
}

export interface TimelineEntry {
  id: string
  project_id: string
  dataset_id: string
  parent_id: string | null
  branch_name: string
  is_primary: boolean
  analysis_type: string
  variables: Record<string, unknown>
  key_result: {
    estimate: number
    ci_lower: number
    ci_upper: number
    p_value: number
    metric_label: string
  } | null
  label: string | null
  assumption_status: 'green' | 'amber' | 'red' | null
  assumption_check_id: string | null
  causal_dag_id: string | null
  created_by: string | null
  created_at: string
}
