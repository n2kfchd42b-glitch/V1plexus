import { decideAnalysisType, generateReasoning } from './decisionTree'
import { checkFeasibility, canRun } from './feasibilityChecker'
import { buildWorkflow } from './workflowBuilder'
import { ANALYSIS_REGISTRY } from './analysisRegistry'
import { estimateCompleteCases } from './variableProfiler'
import type {
  ResearchIntent,
  VariableSelection,
  DatasetContext,
  AnalysisRecommendation,
  AnalysisTypeId,
  AnalysisConfig,
  LimitationFlag,
} from './types'
import type { AnalysisType } from '@/types/database'

// ─── ANALYSIS TYPE MAPPING ────────────────────────────────────────────────────
// Maps engine AnalysisTypeId → backend AnalysisType (exact strings from engine.ts)

export const ANALYSIS_TYPE_MAPPING: Record<AnalysisTypeId, AnalysisType> = {
  descriptive_statistics: 'descriptive',
  logistic_regression: 'logistic_regression',
  linear_regression: 'multiple_regression',
  poisson_regression: 'poisson_regression',
  chi_square: 'chi_square',
  fisher_exact: 'chi_square',       // closest available backend type
  independent_t_test: 't_test',
  mann_whitney: 't_test',           // non-parametric via t_test handler
  one_way_anova: 'anova',
  kruskal_wallis: 'anova',
  kaplan_meier: 'kaplan_meier',
  cox_ph: 'cox_regression',
  pearson_correlation: 'correlation',
  spearman_correlation: 'correlation',
  prevalence_estimation: 'frequency',
  propensity_score_matching: 'psm',
}

// ─── BACKEND CONFIG BUILDER ───────────────────────────────────────────────────
// Converts engine AnalysisConfig → backend Record<string, unknown> config shape
// that matches the existing config components' output format.

export function buildBackendConfig(config: AnalysisConfig): Record<string, unknown> {
  const {
    analysis_type,
    outcome_variable: outcome,
    exposure_variable: exposure,
    covariate_variables: covariates,
    time_variable,
    event_variable,
    group_variable,
    strat_variable,
    confidence_level,
  } = config

  const confidenceLevel = confidence_level ?? 0.95

  switch (analysis_type) {
    case 'descriptive_statistics': {
      const vars = [outcome, exposure, ...covariates].filter(Boolean) as string[]
      return { variables: vars.length > 0 ? vars : [] }
    }

    case 'logistic_regression':
      return {
        outcome: outcome ?? '',
        predictors: [exposure, ...covariates].filter(Boolean) as string[],
        confidenceLevel,
      }

    case 'linear_regression':
      return {
        outcome: outcome ?? '',
        predictors: [exposure, ...covariates].filter(Boolean) as string[],
        confidenceLevel,
      }

    case 'poisson_regression':
      return {
        outcome: outcome ?? '',
        predictors: [exposure, ...covariates].filter(Boolean) as string[],
        confidenceLevel,
      }

    case 'chi_square':
    case 'fisher_exact':
      return {
        variable1: outcome ?? '',
        variable2: exposure ?? '',
      }

    case 'independent_t_test':
    case 'mann_whitney':
      return {
        testType: 'independent',
        variable: outcome ?? '',
        groupVariable: exposure ?? group_variable ?? '',
        confidenceLevel,
      }

    case 'one_way_anova':
    case 'kruskal_wallis':
      return {
        dependent: outcome ?? '',
        factor1: exposure ?? group_variable ?? '',
        posthoc: analysis_type === 'one_way_anova' ? 'tukey' : 'none',
      }

    case 'kaplan_meier':
      return {
        timeVariable: time_variable ?? '',
        eventVariable: event_variable ?? '',
        groupVariable: exposure ?? group_variable ?? undefined,
        stratVariable: strat_variable ?? undefined,
        confidenceLevel,
      }

    case 'cox_ph':
      return {
        timeVariable: time_variable ?? '',
        eventVariable: event_variable ?? '',
        predictors: [exposure, ...covariates].filter(Boolean) as string[],
        confidenceLevel,
      }

    case 'pearson_correlation':
    case 'spearman_correlation':
      return {
        variable1: outcome ?? '',
        variable2: exposure ?? '',
      }

    case 'prevalence_estimation':
      return {
        variables: [outcome].filter(Boolean) as string[],
      }

    case 'propensity_score_matching':
      return {
        treatmentVariable: exposure ?? outcome ?? '',
        covariates: covariates,
        caliper: 0.2,
        confidenceLevel,
      }

    default:
      return {}
  }
}

// ─── CONFIG VALIDATOR ─────────────────────────────────────────────────────────

export function validateConfig(config: AnalysisConfig): string[] {
  const warnings: string[] = []
  const backendType = ANALYSIS_TYPE_MAPPING[config.analysis_type]

  if (!backendType) {
    warnings.push(`No backend mapping found for analysis_type: ${config.analysis_type}`)
    return warnings
  }

  if (
    ['logistic_regression', 'linear_regression', 'poisson_regression'].includes(
      config.analysis_type,
    ) &&
    !config.outcome_variable
  ) {
    warnings.push('outcome_variable is required for regression analyses')
  }

  if (
    ['kaplan_meier', 'cox_ph'].includes(config.analysis_type) &&
    (!config.time_variable || !config.event_variable)
  ) {
    warnings.push('time_variable and event_variable are required for survival analyses')
  }

  if (process.env.NODE_ENV === 'development' && warnings.length > 0) {
    console.warn('[DecisionEngine] Config warnings:', warnings)
  }

  return warnings
}

// ─── STROBE ITEMS ─────────────────────────────────────────────────────────────

function getStrobeItems(type: AnalysisTypeId): string[] {
  const STROBE_MAP: Partial<Record<AnalysisTypeId, string[]>> = {
    logistic_regression: ['6a', '12a', '12c', '13', '16'],
    linear_regression: ['6a', '12a', '12c', '13', '16'],
    kaplan_meier: ['6a', '12b', '12c', '13', '15'],
    cox_ph: ['6a', '12a', '12b', '12c', '13', '16'],
    chi_square: ['6a', '12a', '13', '14'],
    descriptive_statistics: ['6a', '13', '14'],
    prevalence_estimation: ['6a', '13', '14'],
    pearson_correlation: ['6a', '12a', '13'],
    spearman_correlation: ['6a', '12a', '13'],
  }
  return STROBE_MAP[type] ?? ['12a', '13']
}

// ─── MAIN PUBLIC API ──────────────────────────────────────────────────────────

export function getRecommendation(
  intent: ResearchIntent,
  variables: VariableSelection,
  context: DatasetContext,
): AnalysisRecommendation {
  const selected = [
    variables.outcome,
    variables.exposure,
    variables.time_variable,
    variables.event_variable,
    ...variables.covariates,
  ].filter(Boolean) as NonNullable<typeof variables.outcome>[]

  const complete_cases = estimateCompleteCases(selected, context.row_count)

  const { primary, alternatives } = decideAnalysisType(intent, variables, complete_cases)

  const feasibility = checkFeasibility(primary, variables, context)
  const registry_entry = ANALYSIS_REGISTRY[primary]
  const workflow = buildWorkflow(primary, variables, complete_cases)
  const reasoning = generateReasoning(primary, variables, complete_cases)

  const config: AnalysisConfig = {
    analysis_type: primary,
    dataset_id: context.dataset_id,
    version_id: context.version_id,
    outcome_variable: variables.outcome?.name ?? null,
    exposure_variable: variables.exposure?.name ?? null,
    covariate_variables: variables.covariates.map(c => c.name),
    time_variable: variables.time_variable?.name ?? null,
    event_variable: variables.event_variable?.name ?? null,
    group_variable: variables.group_variable?.name ?? null,
    strat_variable: variables.strat_variable?.name ?? null,
    confidence_level: 0.95,
    reference_category: 'first',
  }

  // Validate and log in dev
  validateConfig(config)

  const flags: LimitationFlag[] = []
  if (context.row_count > 0 && complete_cases < context.row_count * 0.7) {
    flags.push({
      severity: 'warning',
      message:
        `${Math.round((1 - complete_cases / context.row_count) * 100)}% of rows have missing data in ` +
        `selected variables. Consider MICE imputation before analysis.`,
    })
  }

  return {
    primary,
    primary_name: registry_entry.name,
    reasoning,
    feasibility,
    can_run: canRun(feasibility),
    workflow_steps: workflow,
    alternatives: alternatives.map(a => ({
      analysis_type: a.id,
      name: ANALYSIS_REGISTRY[a.id].name,
      reason: a.reason,
    })),
    reporting_guideline: registry_entry.reporting_guideline,
    strobe_items_auto: getStrobeItems(primary),
    flags,
    analysis_config: config,
  }
}

// ─── DEV TESTING HELPER ───────────────────────────────────────────────────────

if (process.env.NODE_ENV === 'development') {
  // @ts-ignore — dev-only smoke test for all 15 types
  if (typeof window !== 'undefined') {
    ;(window as typeof window & { __decisionEngine?: unknown }).__decisionEngine = {
      getRecommendation,
      buildBackendConfig,
      ANALYSIS_TYPE_MAPPING,
    }
  }
}

// ─── EXECUTABLE WORKFLOW BUILDER ─────────────────────────────────────────────
// Attaches machine-runnable configs to each workflow step that has analysis_type.
// Steps without analysis_type (assumption checks, charts) remain display-only.

export type ExecutableWorkflowStep = import('./types').WorkflowStep & {
  is_final: boolean
}

export function buildExecutableWorkflow(
  recommendation: AnalysisRecommendation,
): ExecutableWorkflowStep[] {
  const { workflow_steps, primary, analysis_config } = recommendation

  return workflow_steps.map(step => {
    if (!step.analysis_type) {
      return { ...step, is_final: false }
    }

    const is_final = step.analysis_type === primary
    // Build a config for this step by substituting the step's analysis_type
    // into the same variable selections from the full recommendation config.
    const stepAnalysisConfig: AnalysisConfig = {
      ...analysis_config,
      analysis_type: step.analysis_type,
    }
    const config = buildBackendConfig(stepAnalysisConfig)
    const backendType = ANALYSIS_TYPE_MAPPING[step.analysis_type]

    return {
      ...step,
      is_final,
      executable_config: { backendType, config },
    }
  })
}

// ─── RE-EXPORTS ───────────────────────────────────────────────────────────────

export * from './types'
export * from './analysisRegistry'
export * from './variableProfiler'
export type { AnalysisType }
