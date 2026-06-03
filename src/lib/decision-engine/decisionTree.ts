import type { ResearchIntent, VariableSelection, AnalysisTypeId, VariableType } from './types'

// ─── Guard: check if a variable type is "useful" (not text/id) ───────────────
function isUsable(type: VariableType | null | undefined): boolean {
  return type !== null && type !== undefined && type !== 'text' && type !== 'id'
}

// |Fisher's skewness| above this is treated as "substantially non-normal", so
// the engine leads with a non-parametric test (a common rule-of-thumb cutoff).
const SKEW_NONNORMAL_THRESHOLD = 1

// True when a column's measured distribution is skewed enough that a
// rank-based (non-parametric) test is the safer primary choice. Returns false
// when skewness wasn't computed (small/unknown column) so we fall back to the
// parametric default rather than guessing.
function prefersNonParametric(col: { skewness?: number } | null | undefined): boolean {
  return col != null && col.skewness != null && Math.abs(col.skewness) >= SKEW_NONNORMAL_THRESHOLD
}

// Distinct levels of a grouping variable; falls back to 2 when unknown.
function groupCount(col: { unique_count?: number } | null | undefined): number {
  return col?.unique_count && col.unique_count > 0 ? col.unique_count : 2
}

// ─── Core decision logic ──────────────────────────────────────────────────────

export function decideAnalysisType(
  intent: ResearchIntent,
  variables: VariableSelection,
  complete_cases: number,
): {
  primary: AnalysisTypeId
  alternatives: { id: AnalysisTypeId; reason: string }[]
} {
  const outcomeType = variables.outcome?.type ?? null
  const exposureType = variables.exposure?.type ?? null
  const n_covariates = variables.covariates.length
  const has_time = variables.time_variable !== null

  // ─── DESCRIBE ─────────────────────────────────────────────────────────────
  if (intent === 'describe') {
    const primary = outcomeType === 'binary' ? 'prevalence_estimation' : 'descriptive_statistics'
    return {
      primary,
      alternatives: primary === 'prevalence_estimation'
        ? [{ id: 'descriptive_statistics', reason: 'Always run descriptive statistics alongside prevalence estimation' }]
        : [],
    }
  }

  // ─── SURVIVE ──────────────────────────────────────────────────────────────
  if (intent === 'survive' || has_time) {
    const survivePrimary = n_covariates > 0 ? 'cox_ph' : 'kaplan_meier'
    return {
      primary: survivePrimary,
      alternatives: survivePrimary === 'cox_ph'
        ? [{ id: 'kaplan_meier', reason: 'Unadjusted survival curves — always run before Cox regression' }]
        : [{ id: 'cox_ph', reason: 'Add covariates to get adjusted hazard ratios' }],
    }
  }

  // ─── PREDICT ──────────────────────────────────────────────────────────────
  if (intent === 'predict') {
    // Guard: need a valid outcome
    if (!outcomeType || !isUsable(outcomeType)) {
      return { primary: 'descriptive_statistics', alternatives: [] }
    }
    if (outcomeType === 'binary') {
      return {
        primary: 'logistic_regression',
        alternatives: [
          { id: 'prevalence_estimation', reason: 'If you only need crude prevalence without predictors' },
        ],
      }
    }
    if (outcomeType === 'categorical') {
      return {
        primary: 'multinomial_regression',
        alternatives: [
          { id: 'descriptive_statistics', reason: 'If you only need category frequencies' },
        ],
      }
    }
    if (outcomeType === 'continuous') {
      return {
        primary: 'linear_regression',
        alternatives: [
          {
            id: 'pearson_correlation',
            reason: 'If only one continuous predictor and no adjustment needed',
          },
          {
            id: 'poisson_regression',
            reason: 'If outcome is a count variable (number of events/episodes)',
          },
        ],
      }
    }
  }

  // ─── ASSOCIATE ────────────────────────────────────────────────────────────
  if (intent === 'associate') {
    if (!outcomeType || !isUsable(outcomeType)) {
      return { primary: 'descriptive_statistics', alternatives: [] }
    }

    // Both categorical / binary
    if (
      (outcomeType === 'binary' || outcomeType === 'categorical') &&
      (exposureType === 'binary' || exposureType === 'categorical')
    ) {
      // Categorical outcome (3+ classes) needs multinomial regression, not logistic
      if (outcomeType === 'categorical') {
        if (complete_cases < 40) {
          return {
            primary: 'chi_square',
            alternatives: [
              { id: 'fisher_exact', reason: 'If any expected cell frequency < 5' },
              { id: 'multinomial_regression', reason: 'If you want adjusted relative risk ratios' },
            ],
          }
        }
        if (n_covariates > 0) {
          return {
            primary: 'multinomial_regression',
            alternatives: [
              { id: 'chi_square', reason: 'Unadjusted association without covariates' },
            ],
          }
        }
        return {
          primary: 'chi_square',
          alternatives: [
            { id: 'fisher_exact', reason: 'If expected cell frequencies < 5' },
            { id: 'multinomial_regression', reason: 'If you want to adjust for covariates' },
          ],
        }
      }

      // Binary outcome
      if (complete_cases < 40) {
        return {
          primary: 'fisher_exact',
          alternatives: [
            { id: 'chi_square', reason: 'Use if all expected cell frequencies ≥ 5' },
          ],
        }
      }
      if (n_covariates > 0) {
        return {
          primary: 'logistic_regression',
          alternatives: [
            { id: 'propensity_score_matching', reason: 'Balance confounders via matched cohort before outcome analysis — preferred for observational causal inference' },
            { id: 'chi_square', reason: 'Unadjusted association without covariates' },
          ],
        }
      }
      return {
        primary: 'chi_square',
        alternatives: [
          { id: 'fisher_exact', reason: 'If expected cell frequencies < 5' },
          { id: 'logistic_regression', reason: 'If you want to adjust for covariates' },
        ],
      }
    }

    // Both continuous
    if (outcomeType === 'continuous' && exposureType === 'continuous') {
      // With covariates, correlation cannot adjust — use regression
      if (n_covariates > 0) {
        return {
          primary: 'linear_regression',
          alternatives: [
            { id: 'pearson_correlation', reason: 'Unadjusted association without covariates' },
            { id: 'spearman_correlation', reason: 'If either variable is non-normally distributed and no adjustment needed' },
          ],
        }
      }
      // Skewed in either variable → lead with the rank-based correlation.
      const eitherSkewed = prefersNonParametric(variables.outcome) || prefersNonParametric(variables.exposure)
      if (eitherSkewed) {
        return {
          primary: 'spearman_correlation',
          alternatives: [
            { id: 'pearson_correlation', reason: 'If both variables are approximately normally distributed' },
            { id: 'linear_regression', reason: 'If you want to adjust for covariates' },
          ],
        }
      }
      return {
        primary: 'pearson_correlation',
        alternatives: [
          {
            id: 'spearman_correlation',
            reason: 'If either variable is non-normally distributed',
          },
          { id: 'linear_regression', reason: 'If you want to adjust for covariates' },
        ],
      }
    }

    // Continuous outcome, binary/categorical exposure
    if (
      outcomeType === 'continuous' &&
      (exposureType === 'binary' || exposureType === 'categorical')
    ) {
      if (n_covariates > 0) {
        return {
          primary: 'linear_regression',
          alternatives: [],
        }
      }
      const groups = groupCount(variables.exposure)
      const skewed = prefersNonParametric(variables.outcome)
      if (groups <= 2) {
        if (skewed) {
          return {
            primary: 'mann_whitney',
            alternatives: [
              { id: 'independent_t_test', reason: 'If the outcome is approximately normally distributed' },
              { id: 'linear_regression', reason: 'If you need to adjust for covariates' },
            ],
          }
        }
        return {
          primary: 'independent_t_test',
          alternatives: [
            { id: 'mann_whitney', reason: 'If outcome is non-normally distributed' },
            {
              id: 'linear_regression',
              reason: 'If you need to adjust for covariates',
            },
          ],
        }
      }
      if (skewed) {
        return {
          primary: 'kruskal_wallis',
          alternatives: [
            { id: 'one_way_anova', reason: 'If the outcome is approximately normally distributed' },
          ],
        }
      }
      return {
        primary: 'one_way_anova',
        alternatives: [
          { id: 'kruskal_wallis', reason: 'If outcome is non-normally distributed' },
        ],
      }
    }

    // Binary outcome, continuous exposure
    if (outcomeType === 'binary' && exposureType === 'continuous') {
      return {
        primary: 'logistic_regression',
        alternatives: [],
      }
    }

    // Categorical outcome (3+ classes), continuous exposure
    if (outcomeType === 'categorical' && exposureType === 'continuous') {
      return {
        primary: 'multinomial_regression',
        alternatives: [
          { id: 'descriptive_statistics', reason: 'If you only need distribution summaries by category' },
        ],
      }
    }
  }

  // ─── COMPARE ──────────────────────────────────────────────────────────────
  if (intent === 'compare') {
    if (!outcomeType || !isUsable(outcomeType)) {
      return { primary: 'descriptive_statistics', alternatives: [] }
    }

    if (outcomeType === 'continuous') {
      const groups = groupCount(variables.group_variable ?? variables.exposure)
      const skewed = prefersNonParametric(variables.outcome)
      const ancovaAlt = n_covariates > 0
        ? [{ id: 'linear_regression' as const, reason: 'Adjust for covariates via ANCOVA (linear regression with group as predictor)' }]
        : []
      if (groups <= 2) {
        if (skewed) {
          return {
            primary: 'mann_whitney',
            alternatives: [
              { id: 'independent_t_test', reason: 'If the outcome is approximately normally distributed' },
              ...ancovaAlt,
            ],
          }
        }
        return {
          primary: 'independent_t_test',
          alternatives: [
            { id: 'mann_whitney', reason: 'If outcome is non-normally distributed' },
            ...ancovaAlt,
          ],
        }
      }
      if (skewed) {
        return {
          primary: 'kruskal_wallis',
          alternatives: [
            { id: 'one_way_anova', reason: 'If normality and equal-variance assumptions hold' },
            ...ancovaAlt,
          ],
        }
      }
      return {
        primary: 'one_way_anova',
        alternatives: [
          {
            id: 'kruskal_wallis',
            reason: 'If normality or equal variance assumption is violated',
          },
          ...ancovaAlt,
        ],
      }
    }

    if (outcomeType === 'binary') {
      return {
        primary: complete_cases < 40 ? 'fisher_exact' : 'chi_square',
        alternatives: [
          { id: 'logistic_regression', reason: 'If you need adjusted estimates controlling for covariates' },
        ],
      }
    }

    if (outcomeType === 'categorical') {
      return {
        primary: complete_cases < 40 ? 'fisher_exact' : 'chi_square',
        alternatives: [
          { id: 'multinomial_regression', reason: 'If you need adjusted estimates for 3+ outcome categories' },
        ],
      }
    }
  }

  // ─── EXPLORE ──────────────────────────────────────────────────────────────
  if (intent === 'explore') {
    return {
      primary: 'descriptive_statistics',
      alternatives: [
        {
          id: 'pearson_correlation',
          reason: 'Correlation matrix across continuous variables',
        },
        {
          id: 'chi_square',
          reason: 'Test associations between categorical variables',
        },
      ],
    }
  }

  // ─── FALLBACK ─────────────────────────────────────────────────────────────
  return { primary: 'descriptive_statistics', alternatives: [] }
}

// ─── Plain-language reasoning generator ──────────────────────────────────────

export function generateReasoning(
  analysis_type: AnalysisTypeId,
  variables: VariableSelection,
  complete_cases: number,
): string {
  const outcome = variables.outcome?.name ?? 'outcome'
  const outcomeType = variables.outcome?.type ?? 'unknown'
  const exposure = variables.exposure?.name ?? 'predictor'
  const n_cov = variables.covariates.length
  const n = complete_cases.toLocaleString()

  // When the chosen test is non-parametric because the outcome is skewed, say so
  // explicitly with the measured value — this is the "why" a student needs.
  const outcomeSkew = variables.outcome?.skewness
  const skewNote =
    outcomeSkew != null && Math.abs(outcomeSkew) >= 1
      ? ` Your data on ${outcome} is ${outcomeSkew > 0 ? 'right' : 'left'}-skewed ` +
        `(skewness = ${outcomeSkew.toFixed(2)}), so a rank-based test is more robust than its parametric counterpart.`
      : ''

  const REASONS: Partial<Record<AnalysisTypeId, string>> = {
    logistic_regression:
      `Your outcome (${outcome}) is ${outcomeType} and you have ` +
      `${n_cov > 0 ? `${n_cov} covariate${n_cov > 1 ? 's' : ''} to control for` : 'a binary exposure'}. ` +
      `Logistic regression is appropriate for this combination with ${n} complete cases. ` +
      `Results will be reported as adjusted odds ratios (aOR) with 95% confidence intervals.`,

    multinomial_regression:
      `Your outcome (${outcome}) is categorical with multiple unordered classes. ` +
      `${n_cov > 0 ? `With ${n_cov} covariate${n_cov > 1 ? 's' : ''} to control for, multinomial` : 'Multinomial'} ` +
      `logistic regression models each class simultaneously against a reference category across ${n} complete cases. ` +
      `Results will be reported as relative risk ratios (RRR) with 95% confidence intervals per class.`,

    linear_regression:
      `Your outcome (${outcome}) is continuous and you want to examine predictors across ${n} participants. ` +
      `Linear regression will provide adjusted β coefficients with 95% CIs.`,

    kaplan_meier:
      `Survival analysis is indicated by your time variable and event indicator. ` +
      `Kaplan-Meier curves will show survival probability over time with a log-rank test to compare groups.`,

    cox_ph:
      `With ${n_cov} covariates and a time-to-event outcome, Cox regression provides ` +
      `adjusted hazard ratios controlling for confounding.`,

    chi_square:
      `Both ${outcome} and ${exposure} are categorical variables. ` +
      `Chi-square tests independence between them across ${n} observations.`,

    fisher_exact:
      `With ${n} complete cases and both variables being binary, ` +
      `Fisher's exact test is preferred over chi-square for small samples.`,

    independent_t_test:
      `You are comparing ${outcome} (continuous) between two groups defined by ${exposure}. ` +
      `Independent t-test is appropriate if ${outcome} is approximately normally distributed.`,

    mann_whitney:
      `Non-parametric comparison of ${outcome} between two groups. Results reported as medians with IQR.` + skewNote,

    one_way_anova:
      `Comparing ${outcome} across multiple groups defined by ${exposure}. ` +
      `ANOVA tests whether any group means differ.`,

    kruskal_wallis:
      `Non-parametric comparison of ${outcome} across multiple groups. ` +
      `Use when ANOVA assumptions are violated.` + skewNote,

    descriptive_statistics:
      `A descriptive analysis will characterise your study population of ${n} participants ` +
      `across all selected variables.`,

    prevalence_estimation:
      `Estimating the proportion of the ${n}-participant sample with ${outcome} and the 95% confidence interval.`,

    pearson_correlation:
      `Measuring the linear relationship between ${outcome} and ${exposure} across ${n} observations.`,

    spearman_correlation:
      `Non-parametric correlation between ${outcome} and ${exposure}. ` +
      `Appropriate when normality cannot be assumed.` + skewNote,

    poisson_regression:
      `${outcome} is a count variable. ` +
      `Poisson regression models the rate of events per unit of exposure time.`,

    propensity_score_matching:
      `You have a binary treatment (${exposure}) and ${n_cov} confounder(s) to control for across ${n} participants. ` +
      `Propensity score matching will balance covariate distributions between treated and control groups — ` +
      `creating a pseudo-randomised cohort before your primary outcome analysis.`,
  }

  return (
    REASONS[analysis_type] ??
    `${analysis_type} was selected based on your variable types and research intent.`
  )
}
