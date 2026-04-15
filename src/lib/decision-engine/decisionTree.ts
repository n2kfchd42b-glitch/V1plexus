import type { ResearchIntent, VariableSelection, AnalysisTypeId, VariableType } from './types'

// ─── Guard: check if a variable type is "useful" (not text/id) ───────────────
function isUsable(type: VariableType | null | undefined): boolean {
  return type !== null && type !== undefined && type !== 'text' && type !== 'id'
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
    return {
      primary:
        outcomeType === 'binary' ? 'prevalence_estimation' : 'descriptive_statistics',
      alternatives: [
        {
          id: 'descriptive_statistics',
          reason: 'Always run descriptive statistics first regardless of primary analysis',
        },
      ],
    }
  }

  // ─── SURVIVE ──────────────────────────────────────────────────────────────
  if (intent === 'survive' || has_time) {
    return {
      primary: n_covariates > 0 ? 'cox_ph' : 'kaplan_meier',
      alternatives: [
        {
          id: 'kaplan_meier',
          reason: 'Unadjusted survival curves — run before Cox regression',
        },
        {
          id: 'cox_ph',
          reason: 'Adjusted hazard ratios controlling for covariates',
        },
      ],
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
          { id: 'chi_square', reason: 'Univariable association before regression' },
          { id: 'prevalence_estimation', reason: 'If you only need crude prevalence' },
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
          alternatives: [
            {
              id: 'independent_t_test',
              reason: 'If only one binary predictor and no adjustment',
            },
          ],
        }
      }
      const groups = variables.exposure?.unique_count ?? 2
      if (groups <= 2) {
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
        alternatives: [
          {
            id: 'pearson_correlation',
            reason: 'Point-biserial correlation for quick association',
          },
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
      const groups =
        variables.group_variable?.unique_count ??
        variables.exposure?.unique_count ??
        2
      if (groups <= 2) {
        return {
          primary: 'independent_t_test',
          alternatives: [
            { id: 'mann_whitney', reason: 'If outcome is non-normally distributed' },
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
        ],
      }
    }

    if (outcomeType === 'binary' || outcomeType === 'categorical') {
      return {
        primary: complete_cases < 40 ? 'fisher_exact' : 'chi_square',
        alternatives: [
          { id: 'logistic_regression', reason: 'If you need adjusted estimates' },
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

  const REASONS: Partial<Record<AnalysisTypeId, string>> = {
    logistic_regression:
      `Your outcome (${outcome}) is ${outcomeType} and you have ` +
      `${n_cov > 0 ? `${n_cov} covariate${n_cov > 1 ? 's' : ''} to control for` : 'a binary exposure'}. ` +
      `Logistic regression is appropriate for this combination with ${n} complete cases. ` +
      `Results will be reported as adjusted odds ratios (aOR) with 95% confidence intervals.`,

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
      `Non-parametric comparison of ${outcome} between two groups. Results reported as medians with IQR.`,

    one_way_anova:
      `Comparing ${outcome} across multiple groups defined by ${exposure}. ` +
      `ANOVA tests whether any group means differ.`,

    kruskal_wallis:
      `Non-parametric comparison of ${outcome} across multiple groups. ` +
      `Use when ANOVA assumptions are violated.`,

    descriptive_statistics:
      `A descriptive analysis will characterise your study population of ${n} participants ` +
      `across all selected variables.`,

    prevalence_estimation:
      `Estimating the proportion of the ${n}-participant sample with ${outcome} and the 95% confidence interval.`,

    pearson_correlation:
      `Measuring the linear relationship between ${outcome} and ${exposure} across ${n} observations.`,

    spearman_correlation:
      `Non-parametric correlation between ${outcome} and ${exposure}. ` +
      `Appropriate when normality cannot be assumed.`,

    poisson_regression:
      `${outcome} is a count variable. ` +
      `Poisson regression models the rate of events per unit of exposure time.`,
  }

  return (
    REASONS[analysis_type] ??
    `${analysis_type} was selected based on your variable types and research intent.`
  )
}
