// ─── INPUT TYPES ─────────────────────────────────────────────────────────────

export type ResearchIntent =
  | 'describe'   // Summarise population and variables
  | 'associate'  // Test relationship between two variables
  | 'predict'    // What factors predict an outcome
  | 'compare'    // Do groups differ on a measure
  | 'survive'    // Time to event / survival analysis
  | 'explore'    // Find patterns or clusters

export type VariableType =
  | 'continuous'
  | 'binary'
  | 'categorical'
  | 'date'
  | 'id'
  | 'text'
  | 'time_to_event'

export type EngineColumnSchema = {
  name: string
  label: string | null
  type: VariableType
  null_count: number
  unique_count: number
  min?: number | string
  max?: number | string
  mean?: number
  sample_values?: string[]
}

export type VariableSelection = {
  outcome: EngineColumnSchema | null
  exposure: EngineColumnSchema | null
  covariates: EngineColumnSchema[]
  time_variable: EngineColumnSchema | null
  event_variable: EngineColumnSchema | null
  group_variable: EngineColumnSchema | null
  strat_variable: EngineColumnSchema | null
}

export type DatasetContext = {
  dataset_id: string
  version_id: string
  dataset_name: string
  row_count: number
  complete_cases: number
  schema: EngineColumnSchema[]
}

// ─── OUTPUT TYPES ─────────────────────────────────────────────────────────────

export type AnalysisTypeId =
  | 'descriptive_statistics'
  | 'logistic_regression'
  | 'multinomial_regression'
  | 'linear_regression'
  | 'poisson_regression'
  | 'chi_square'
  | 'fisher_exact'
  | 'independent_t_test'
  | 'mann_whitney'
  | 'one_way_anova'
  | 'kruskal_wallis'
  | 'kaplan_meier'
  | 'cox_ph'
  | 'pearson_correlation'
  | 'spearman_correlation'
  | 'prevalence_estimation'
  | 'propensity_score_matching'

export type FeasibilityStatus = 'pass' | 'warn' | 'fail' | 'na'

export type FeasibilityCheck = {
  id: string
  label: string
  status: FeasibilityStatus
  value: string
  detail?: string
}

export type WorkflowStep = {
  number: number
  name: string
  description: string
  badge?: string
  analysis_type?: AnalysisTypeId
  /** Step cannot be auto-run — results appear inside the primary analysis output */
  display_only?: boolean
  /** Overrides specific fields of AnalysisConfig when building the step's backend config */
  config_override?: Partial<AnalysisConfig>
  // Populated by buildExecutableWorkflow — machine-runnable payload
  executable_config?: {
    backendType: string
    config: Record<string, unknown>
  }
  is_final?: boolean
}

export type AlternativeTest = {
  analysis_type: AnalysisTypeId
  name: string
  reason: string
}

export type LimitationFlag = {
  severity: 'warning' | 'info'
  message: string
}

export type AnalysisRecommendation = {
  primary: AnalysisTypeId
  primary_name: string
  reasoning: string
  feasibility: FeasibilityCheck[]
  can_run: boolean
  workflow_steps: WorkflowStep[]
  alternatives: AlternativeTest[]
  reporting_guideline: string
  strobe_items_auto: string[]
  flags: LimitationFlag[]
  analysis_config: AnalysisConfig
}

export type AnalysisConfig = {
  analysis_type: AnalysisTypeId
  dataset_id: string
  version_id: string
  outcome_variable: string | null
  exposure_variable: string | null
  covariate_variables: string[]
  time_variable: string | null
  event_variable: string | null
  group_variable: string | null
  strat_variable: string | null
  confidence_level: 0.90 | 0.95 | 0.99
  reference_category: 'first' | 'last' | null
}

export type AnalysisCategory =
  | 'descriptive'
  | 'regression'
  | 'survival'
  | 'comparative'
  | 'correlation'

export type AnalysisTypeMetadata = {
  id: AnalysisTypeId
  name: string
  category: AnalysisCategory
  icon: string
  short_description: string
  when_to_use: string
  outcome_types: VariableType[]
  predictor_types: VariableType[]
  requires_grouping: boolean
  requires_time: boolean
  min_sample_size: number
  reporting_guideline: string
}
