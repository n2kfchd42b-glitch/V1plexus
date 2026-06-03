import type { AnalysisTypeId, AnalysisTypeMetadata, AnalysisCategory } from './types'

export const ANALYSIS_REGISTRY: Record<AnalysisTypeId, AnalysisTypeMetadata> = {
  descriptive_statistics: {
    id: 'descriptive_statistics',
    name: 'Descriptive Statistics',
    category: 'descriptive',
    icon: '📊',
    short_description: 'Summarise your study population',
    when_to_use:
      'First step in any analysis. Generates Table 1 showing population characteristics.',
    outcome_types: [],
    predictor_types: ['continuous', 'binary', 'categorical', 'date'],
    requires_grouping: false,
    requires_time: false,
    min_sample_size: 5,
    reporting_guideline: 'STROBE',
  },

  logistic_regression: {
    id: 'logistic_regression',
    name: 'Logistic Regression',
    category: 'regression',
    icon: '📈',
    short_description: 'Binary outcome, multiple predictors',
    when_to_use:
      'When your outcome is binary (yes/no, positive/negative) and you want adjusted odds ratios.',
    outcome_types: ['binary'],
    predictor_types: ['continuous', 'binary', 'categorical'],
    requires_grouping: false,
    requires_time: false,
    min_sample_size: 50,
    reporting_guideline: 'STROBE',
  },

  multinomial_regression: {
    id: 'multinomial_regression',
    name: 'Multinomial Logistic Regression',
    category: 'regression',
    icon: '🎯',
    short_description: 'Categorical outcome with 3+ classes, multiple predictors',
    when_to_use:
      'When your outcome has 3 or more unordered categories (e.g. disease type A/B/C) and you want relative risk ratios across all classes simultaneously.',
    outcome_types: ['categorical'],
    predictor_types: ['continuous', 'binary', 'categorical'],
    requires_grouping: false,
    requires_time: false,
    min_sample_size: 60,
    reporting_guideline: 'STROBE',
  },

  linear_regression: {
    id: 'linear_regression',
    name: 'Linear Regression',
    category: 'regression',
    icon: '📉',
    short_description: 'Continuous outcome, multiple predictors',
    when_to_use:
      'When your outcome is continuous (e.g. haemoglobin, weight) and you want regression coefficients.',
    outcome_types: ['continuous'],
    predictor_types: ['continuous', 'binary', 'categorical'],
    requires_grouping: false,
    requires_time: false,
    min_sample_size: 30,
    reporting_guideline: 'STROBE',
  },

  poisson_regression: {
    id: 'poisson_regression',
    name: 'Poisson Regression',
    category: 'regression',
    icon: '🔢',
    short_description: 'Count outcome, rate ratios',
    when_to_use:
      'When your outcome is a count (e.g. number of episodes, events per person-time). Reports rate ratios.',
    outcome_types: ['continuous'],
    predictor_types: ['continuous', 'binary', 'categorical'],
    requires_grouping: false,
    requires_time: false,
    min_sample_size: 30,
    reporting_guideline: 'STROBE',
  },

  chi_square: {
    id: 'chi_square',
    name: 'Chi-Square Test',
    category: 'comparative',
    icon: '🔲',
    short_description: 'Association between categorical variables',
    when_to_use:
      'When both variables are categorical or binary and you want to test independence. Requires expected cell frequency ≥ 5.',
    outcome_types: ['binary', 'categorical'],
    predictor_types: ['binary', 'categorical'],
    requires_grouping: false,
    requires_time: false,
    min_sample_size: 20,
    reporting_guideline: 'STROBE',
  },

  fisher_exact: {
    id: 'fisher_exact',
    name: "Fisher's Exact Test",
    category: 'comparative',
    icon: '🎲',
    short_description: 'Small sample categorical association',
    when_to_use:
      'When chi-square assumptions are violated (expected cells < 5). Preferred for small samples or 2×2 tables.',
    outcome_types: ['binary'],
    predictor_types: ['binary'],
    requires_grouping: false,
    requires_time: false,
    min_sample_size: 5,
    reporting_guideline: 'STROBE',
  },

  independent_t_test: {
    id: 'independent_t_test',
    name: 'Independent T-Test',
    category: 'comparative',
    icon: '⚖️',
    short_description: 'Compare means between two groups',
    when_to_use:
      'When comparing a continuous outcome between two independent groups and the outcome is approximately normal.',
    outcome_types: ['continuous'],
    predictor_types: ['binary'],
    requires_grouping: true,
    requires_time: false,
    min_sample_size: 20,
    reporting_guideline: 'STROBE',
  },

  mann_whitney: {
    id: 'mann_whitney',
    name: 'Mann-Whitney U Test',
    category: 'comparative',
    icon: '📐',
    short_description: 'Non-parametric two-group comparison',
    when_to_use:
      'When comparing a continuous outcome between two groups but normality assumption is violated. Reports medians and IQR.',
    outcome_types: ['continuous'],
    predictor_types: ['binary'],
    requires_grouping: true,
    requires_time: false,
    min_sample_size: 10,
    reporting_guideline: 'STROBE',
  },

  paired_t_test: {
    id: 'paired_t_test',
    name: 'Paired T-Test',
    category: 'comparative',
    icon: '🔗',
    short_description: 'Compare two repeated measurements',
    when_to_use:
      'When comparing two repeated measurements on the same subjects (e.g. before vs after) and the paired differences are approximately normal.',
    outcome_types: ['continuous'],
    predictor_types: ['continuous'],
    requires_grouping: false,
    requires_time: false,
    min_sample_size: 15,
    reporting_guideline: 'STROBE',
  },

  wilcoxon_signed_rank: {
    id: 'wilcoxon_signed_rank',
    name: 'Wilcoxon Signed-Rank Test',
    category: 'comparative',
    icon: '🪢',
    short_description: 'Non-parametric paired comparison',
    when_to_use:
      'Non-parametric alternative to the paired t-test: two repeated measurements on the same subjects when the paired differences are non-normal. Reports the median difference.',
    outcome_types: ['continuous'],
    predictor_types: ['continuous'],
    requires_grouping: false,
    requires_time: false,
    min_sample_size: 10,
    reporting_guideline: 'STROBE',
  },

  one_way_anova: {
    id: 'one_way_anova',
    name: 'One-Way ANOVA',
    category: 'comparative',
    icon: '🎻',
    short_description: 'Compare means across 3+ groups',
    when_to_use:
      'When comparing a continuous outcome across three or more groups and normality and equal variance hold.',
    outcome_types: ['continuous'],
    predictor_types: ['categorical'],
    requires_grouping: true,
    requires_time: false,
    min_sample_size: 30,
    reporting_guideline: 'STROBE',
  },

  kruskal_wallis: {
    id: 'kruskal_wallis',
    name: 'Kruskal-Wallis Test',
    category: 'comparative',
    icon: '📦',
    short_description: 'Non-parametric 3+ group comparison',
    when_to_use:
      'Non-parametric alternative to ANOVA when normality is violated. For comparing continuous outcomes across three or more groups.',
    outcome_types: ['continuous'],
    predictor_types: ['categorical'],
    requires_grouping: true,
    requires_time: false,
    min_sample_size: 15,
    reporting_guideline: 'STROBE',
  },

  kaplan_meier: {
    id: 'kaplan_meier',
    name: 'Kaplan-Meier Survival',
    category: 'survival',
    icon: '⏱️',
    short_description: 'Survival curves and log-rank test',
    when_to_use:
      'When your outcome is time to an event (death, recovery, loss to follow-up). Compares survival between groups.',
    outcome_types: ['time_to_event'],
    predictor_types: ['binary', 'categorical'],
    requires_grouping: true,
    requires_time: true,
    min_sample_size: 20,
    reporting_guideline: 'STROBE',
  },

  cox_ph: {
    id: 'cox_ph',
    name: 'Cox Proportional Hazards',
    category: 'survival',
    icon: '📊',
    short_description: 'Adjusted hazard ratios for survival',
    when_to_use:
      'Adjusted survival analysis with multiple predictors. Reports hazard ratios (HR) with 95% CIs.',
    outcome_types: ['time_to_event'],
    predictor_types: ['continuous', 'binary', 'categorical'],
    requires_grouping: false,
    requires_time: true,
    min_sample_size: 50,
    reporting_guideline: 'STROBE',
  },

  pearson_correlation: {
    id: 'pearson_correlation',
    name: 'Pearson Correlation',
    category: 'correlation',
    icon: '🔗',
    short_description: 'Linear relationship between two continuous variables',
    when_to_use:
      'When both variables are continuous and approximately normally distributed. Reports r and p-value.',
    outcome_types: ['continuous'],
    predictor_types: ['continuous'],
    requires_grouping: false,
    requires_time: false,
    min_sample_size: 10,
    reporting_guideline: 'STROBE',
  },

  spearman_correlation: {
    id: 'spearman_correlation',
    name: 'Spearman Correlation',
    category: 'correlation',
    icon: '🔄',
    short_description: 'Non-parametric correlation',
    when_to_use:
      'When variables are continuous but non-normal, or when one variable is ordinal. Reports rho and p-value.',
    outcome_types: ['continuous'],
    predictor_types: ['continuous'],
    requires_grouping: false,
    requires_time: false,
    min_sample_size: 10,
    reporting_guideline: 'STROBE',
  },

  prevalence_estimation: {
    id: 'prevalence_estimation',
    name: 'Prevalence Estimation',
    category: 'descriptive',
    icon: '🏷️',
    short_description: 'Estimate disease or outcome prevalence',
    when_to_use:
      'When you want to estimate the proportion of a population with a condition. Reports prevalence with 95% CI.',
    outcome_types: ['binary'],
    predictor_types: ['binary', 'categorical'],
    requires_grouping: false,
    requires_time: false,
    min_sample_size: 30,
    reporting_guideline: 'STROBE',
  },

  propensity_score_matching: {
    id: 'propensity_score_matching',
    name: 'Propensity Score Matching',
    category: 'regression',
    icon: '⚖️',
    short_description: 'Balance confounders between treated and control groups',
    when_to_use:
      'Observational study with a binary treatment variable and known confounders. ' +
      'Creates matched pairs with similar covariate profiles to emulate a randomised trial before outcome analysis.',
    outcome_types: ['binary'],
    predictor_types: ['continuous', 'binary', 'categorical'],
    requires_grouping: false,
    requires_time: false,
    min_sample_size: 40,
    reporting_guideline: 'STROBE',
  },
}

export const ANALYSIS_CATEGORIES: { id: AnalysisCategory; label: string }[] = [
  { id: 'descriptive', label: 'Descriptive' },
  { id: 'regression', label: 'Regression & Prediction' },
  { id: 'survival', label: 'Survival Analysis' },
  { id: 'comparative', label: 'Comparative Tests' },
  { id: 'correlation', label: 'Correlation' },
]
