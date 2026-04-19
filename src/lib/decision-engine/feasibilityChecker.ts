import type {
  AnalysisTypeId,
  VariableSelection,
  DatasetContext,
  FeasibilityCheck,
  FeasibilityStatus,
} from './types'
import { ANALYSIS_REGISTRY } from './analysisRegistry'
import { estimateCompleteCases } from './variableProfiler'

export function checkFeasibility(
  analysis_type: AnalysisTypeId,
  variables: VariableSelection,
  context: DatasetContext,
): FeasibilityCheck[] {
  const checks: FeasibilityCheck[] = []
  const meta = ANALYSIS_REGISTRY[analysis_type]

  const selected = [
    variables.outcome,
    variables.exposure,
    variables.time_variable,
    variables.event_variable,
    ...variables.covariates,
  ].filter(Boolean) as NonNullable<typeof variables.outcome>[]

  const complete_cases = estimateCompleteCases(selected, context.row_count)

  // ─── SAMPLE SIZE ─────────────────────────────────────────────────────────
  const sizeStatus: FeasibilityStatus =
    complete_cases >= meta.min_sample_size * 2
      ? 'pass'
      : complete_cases >= meta.min_sample_size
        ? 'warn'
        : 'fail'

  checks.push({
    id: 'sample_size',
    label: 'Sample size',
    status: sizeStatus,
    value: `N = ${complete_cases.toLocaleString()} complete cases`,
    detail:
      sizeStatus !== 'pass'
        ? `Minimum recommended: N ≥ ${meta.min_sample_size}`
        : undefined,
  })

  // ─── OUTCOME COMPLETENESS ────────────────────────────────────────────────
  if (variables.outcome) {
    const pct = Math.round(
      ((context.row_count - variables.outcome.null_count) / context.row_count) * 100,
    )
    const outcomeStatus: FeasibilityStatus =
      pct >= 90 ? 'pass' : pct >= 75 ? 'warn' : 'fail'
    checks.push({
      id: 'outcome_completeness',
      label: 'Outcome completeness',
      status: outcomeStatus,
      value: `${pct}% non-missing`,
      detail:
        pct < 75
          ? 'High missingness may bias results. Consider MICE imputation.'
          : pct < 90
            ? 'Moderate missingness. Document in Methods section.'
            : undefined,
    })
  }

  // ─── EPV CHECK (logistic regression only) ────────────────────────────────
  if (analysis_type === 'logistic_regression' && variables.outcome) {
    const n_predictors = variables.covariates.length + (variables.exposure ? 1 : 0)
    if (n_predictors > 0) {
      // Estimate events from outcome non-missingness; assume conservative 30% minority-class
      // prevalence (can't know true prevalence without the data).
      const outcome_non_null = context.row_count > 0
        ? context.row_count - (variables.outcome.null_count ?? 0)
        : complete_cases
      const events = Math.round(Math.min(outcome_non_null, complete_cases) * 0.3)
      const epv = Math.round(events / n_predictors)
      const epvStatus: FeasibilityStatus = epv >= 10 ? 'pass' : epv >= 5 ? 'warn' : 'fail'
      checks.push({
        id: 'epv',
        label: 'Events per variable (estimated)',
        status: epvStatus,
        value: `EPV ≈ ${epv} (assumes ~30% prevalence)`,
        detail:
          epv < 10
            ? 'EPV < 10 — consider reducing predictors or using penalised regression. Verify actual event count before reporting.'
            : 'Estimated from outcome non-missingness. Verify actual event prevalence.',
      })
    }
  }

  // ─── CATEGORICAL LEVELS WARNING ──────────────────────────────────────────
  const catVars = [variables.exposure, ...variables.covariates].filter(
    v => v?.type === 'categorical',
  )
  for (const v of catVars) {
    if (!v) continue
    if (v.unique_count > 5) {
      checks.push({
        id: `cat_levels_${v.name}`,
        label: 'Categorical levels',
        status: 'warn',
        value: `${v.name}: ${v.unique_count} levels → ${v.unique_count - 1} dummy variables`,
        detail: 'High number of levels increases model complexity. Confirm this is intended.',
      })
    }
  }

  // ─── PSM: BINARY TREATMENT + ≥1 COVARIATE ───────────────────────────────
  if (analysis_type === 'propensity_score_matching') {
    const treatmentIsBinary = variables.exposure?.type === 'binary'
    checks.push({
      id: 'psm_treatment',
      label: 'Treatment variable (binary)',
      status: !variables.exposure ? 'fail' : treatmentIsBinary ? 'pass' : 'fail',
      value: variables.exposure
        ? `${variables.exposure.name} (${variables.exposure.type})`
        : 'Not selected',
      detail: !variables.exposure
        ? 'PSM requires a binary (0/1) treatment variable.'
        : !treatmentIsBinary
          ? `Treatment variable is ${variables.exposure.type}. PSM requires a binary (0/1) variable — re-select a binary column.`
          : undefined,
    })
    checks.push({
      id: 'psm_covariates',
      label: 'Covariates for balancing',
      status: variables.covariates.length > 0 ? 'pass' : 'fail',
      value: variables.covariates.length > 0
        ? `${variables.covariates.length} covariate(s) selected`
        : 'None selected',
      detail: variables.covariates.length === 0
        ? 'At least one covariate is required to estimate propensity scores.'
        : undefined,
    })
  }

  // ─── SURVIVAL: TIME + EVENT VARIABLES ────────────────────────────────────
  if (analysis_type === 'kaplan_meier' || analysis_type === 'cox_ph') {
    checks.push({
      id: 'time_variable',
      label: 'Time variable',
      status: variables.time_variable ? 'pass' : 'fail',
      value: variables.time_variable ? variables.time_variable.name : 'Not selected',
      detail: !variables.time_variable
        ? 'Survival analysis requires a time variable.'
        : undefined,
    })
    checks.push({
      id: 'event_variable',
      label: 'Event indicator',
      status: variables.event_variable ? 'pass' : 'fail',
      value: variables.event_variable ? variables.event_variable.name : 'Not selected',
      detail: !variables.event_variable
        ? 'Survival analysis requires a binary event indicator.'
        : undefined,
    })
  }

  return checks
}

export function canRun(checks: FeasibilityCheck[]): boolean {
  return !checks.some(c => c.status === 'fail')
}

export function getOverallStatus(checks: FeasibilityCheck[]): FeasibilityStatus {
  if (checks.some(c => c.status === 'fail')) return 'fail'
  if (checks.some(c => c.status === 'warn')) return 'warn'
  return 'pass'
}
