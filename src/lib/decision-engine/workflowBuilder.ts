import type { AnalysisTypeId, VariableSelection, WorkflowStep } from './types'

export function buildWorkflow(
  analysis_type: AnalysisTypeId,
  variables: VariableSelection,
  n: number,
): WorkflowStep[] {
  const outcome = variables.outcome?.name ?? 'outcome'
  const exposure = variables.exposure?.name ?? 'exposure'
  const cov_list =
    variables.covariates.map(c => c.name).join(', ') || 'no covariates'

  const WORKFLOWS: Record<AnalysisTypeId, WorkflowStep[]> = {
    logistic_regression: [
      {
        number: 1,
        name: 'Descriptive Statistics (Table 1)',
        description: `Characterise all ${n.toLocaleString()} participants by ${exposure} group — embedded in results`,
        badge: 'in results',
        display_only: true,
      },
      {
        number: 2,
        name: 'Univariable logistic regression',
        description: `Crude odds ratios for ${exposure} against ${outcome} — no covariate adjustment`,
        badge: 'auto-run',
        analysis_type: 'logistic_regression',
        config_override: { covariate_variables: [] },
      },
      {
        number: 3,
        name: 'Multivariable logistic regression',
        description: `Adjusted OR for ${exposure} controlling for ${cov_list}`,
        badge: 'primary analysis',
        analysis_type: 'logistic_regression',
      },
      {
        number: 4,
        name: 'Assumption checks',
        description: 'Multicollinearity (VIF), complete separation, influential observations — review in results',
        badge: 'in results',
        display_only: true,
      },
      {
        number: 5,
        name: 'Forest plot — Adjusted Odds Ratios',
        description: `Publication-ready chart for ${outcome} predictors with 95% CIs — generated in results`,
        badge: 'in results',
        display_only: true,
      },
    ],

    multinomial_regression: [
      {
        number: 1,
        name: 'Descriptive Statistics (Table 1)',
        description: `Characterise all ${n.toLocaleString()} participants by ${exposure} group — embedded in results`,
        badge: 'in results',
        display_only: true,
      },
      {
        number: 2,
        name: 'Outcome category frequencies',
        description: `Distribution of ${outcome} categories — n (%) per class — embedded in results`,
        badge: 'in results',
        display_only: true,
      },
      {
        number: 3,
        name: 'Multinomial logistic regression',
        description: `Relative risk ratios for ${outcome} categories vs reference, controlling for ${cov_list}`,
        badge: 'primary analysis',
        analysis_type: 'multinomial_regression',
      },
      {
        number: 4,
        name: 'Assumption checks',
        description: 'Multicollinearity (VIF), complete separation per outcome class — review in results',
        badge: 'in results',
        display_only: true,
      },
    ],

    linear_regression: [
      {
        number: 1,
        name: 'Descriptive Statistics',
        description: `Distribution of ${outcome} — mean, SD, normality check — embedded in results`,
        badge: 'in results',
        display_only: true,
      },
      {
        number: 2,
        name: 'Univariable linear regression',
        description: `Crude β for ${exposure} against ${outcome} — no covariate adjustment`,
        badge: 'auto-run',
        analysis_type: 'linear_regression',
        config_override: { covariate_variables: [] },
      },
      {
        number: 3,
        name: 'Multivariable linear regression',
        description: `Adjusted β coefficients for ${outcome} with ${cov_list}`,
        badge: 'primary analysis',
        analysis_type: 'linear_regression',
      },
      {
        number: 4,
        name: 'Assumption checks',
        description: 'Normality of residuals, homoscedasticity, influential observations — review in results',
        badge: 'in results',
        display_only: true,
      },
    ],

    kaplan_meier: [
      {
        number: 1,
        name: 'Descriptive Statistics',
        description: 'Characterise study population and event rate — embedded in results',
        badge: 'in results',
        display_only: true,
      },
      {
        number: 2,
        name: 'Kaplan-Meier survival curves',
        description: variables.strat_variable
          ? `Stratified KM curves by ${exposure} group, adjusted for ${variables.strat_variable.name}`
          : `Survival curves by ${exposure} group with log-rank test`,
        badge: 'primary analysis',
        analysis_type: 'kaplan_meier',
      },
      {
        number: 3,
        name: 'Median survival table',
        description: 'Median survival time with 95% CIs per group — shown in results',
        badge: 'in results',
        display_only: true,
      },
    ],

    cox_ph: [
      {
        number: 1,
        name: 'Kaplan-Meier curves',
        description: 'Unadjusted survival — run before Cox regression',
        badge: 'auto-run',
        analysis_type: 'kaplan_meier',
      },
      {
        number: 2,
        name: 'Cox proportional hazards',
        description: `Adjusted HRs for ${exposure} controlling for ${cov_list}`,
        badge: 'primary analysis',
        analysis_type: 'cox_ph',
      },
      {
        number: 3,
        name: 'Schoenfeld residuals (PH assumption)',
        description: 'Test proportional hazards assumption — no automated implementation; review residual plot in Cox output',
        badge: 'in results',
        display_only: true,
      },
      {
        number: 4,
        name: 'Forest plot — Hazard Ratios',
        description: 'Adjusted HRs with 95% CIs — generated in results',
        badge: 'in results',
        display_only: true,
      },
    ],

    chi_square: [
      {
        number: 1,
        name: 'Frequency table',
        description: `${outcome} × ${exposure} cross-tabulation — shown in results`,
        badge: 'in results',
        display_only: true,
      },
      {
        number: 2,
        name: 'Chi-square test',
        description: 'Test of independence with expected cell frequencies',
        badge: 'primary analysis',
        analysis_type: 'chi_square',
      },
      {
        number: 3,
        name: 'Effect size',
        description: "Cramér's V — shown in results",
        badge: 'in results',
        display_only: true,
      },
    ],

    fisher_exact: [
      {
        number: 1,
        name: 'Frequency table',
        description: `2×2 contingency table for ${outcome} × ${exposure} — shown in results`,
        badge: 'in results',
        display_only: true,
      },
      {
        number: 2,
        name: "Fisher's exact test",
        description: 'Exact p-value for small sample sizes',
        badge: 'primary analysis',
        analysis_type: 'fisher_exact',
      },
    ],

    independent_t_test: [
      {
        number: 1,
        name: 'Normality check',
        description: `Shapiro-Wilk test for ${outcome} — no automated implementation; check histogram in results`,
        badge: 'in results',
        display_only: true,
      },
      {
        number: 2,
        name: 'Independent t-test',
        description: `Mean ${outcome} in ${exposure} = 0 vs ${exposure} = 1`,
        badge: 'primary analysis',
        analysis_type: 'independent_t_test',
      },
      {
        number: 3,
        name: 'Box plot',
        description: `${outcome} distribution by ${exposure} group — shown in results`,
        badge: 'in results',
        display_only: true,
      },
    ],

    mann_whitney: [
      {
        number: 1,
        name: 'Descriptive statistics by group',
        description: `Median (IQR) of ${outcome} per ${exposure} group`,
        badge: 'auto-generated',
      },
      {
        number: 2,
        name: 'Mann-Whitney U test',
        description: 'Non-parametric two-group comparison',
        badge: 'primary analysis',
        analysis_type: 'mann_whitney',
      },
    ],

    paired_t_test: [
      {
        number: 1,
        name: 'Paired differences summary',
        description: `Distribution of ${outcome} − ${exposure} per subject — shown in results`,
        badge: 'in results',
        display_only: true,
      },
      {
        number: 2,
        name: 'Paired t-test',
        description: `Mean difference between ${outcome} and ${exposure}`,
        badge: 'primary analysis',
        analysis_type: 'paired_t_test',
      },
    ],

    wilcoxon_signed_rank: [
      {
        number: 1,
        name: 'Paired differences summary',
        description: `Median difference between ${outcome} and ${exposure} — shown in results`,
        badge: 'in results',
        display_only: true,
      },
      {
        number: 2,
        name: 'Wilcoxon signed-rank test',
        description: 'Non-parametric paired comparison',
        badge: 'primary analysis',
        analysis_type: 'wilcoxon_signed_rank',
      },
    ],

    one_way_anova: [
      {
        number: 1,
        name: 'Descriptive statistics by group',
        description: `Mean (SD) of ${outcome} per ${exposure} group — shown in results`,
        badge: 'in results',
        display_only: true,
      },
      {
        number: 2,
        name: 'One-way ANOVA',
        description: `F-test comparing ${outcome} across groups`,
        badge: 'primary analysis',
        analysis_type: 'one_way_anova',
      },
      {
        number: 3,
        name: "Post-hoc tests (Tukey's HSD)",
        description: 'Pairwise comparisons — included in results when ANOVA is significant',
        badge: 'in results',
        display_only: true,
      },
    ],

    kruskal_wallis: [
      {
        number: 1,
        name: 'Descriptive statistics by group',
        description: `Median (IQR) of ${outcome} per group`,
        badge: 'auto-generated',
      },
      {
        number: 2,
        name: 'Kruskal-Wallis test',
        description: 'Non-parametric multi-group comparison',
        badge: 'primary analysis',
        analysis_type: 'kruskal_wallis',
      },
    ],

    pearson_correlation: [
      {
        number: 1,
        name: 'Scatter plot',
        description: `${outcome} vs ${exposure} with regression line — shown in results`,
        badge: 'in results',
        display_only: true,
      },
      {
        number: 2,
        name: 'Pearson correlation',
        description: 'r coefficient and p-value',
        badge: 'primary analysis',
        analysis_type: 'pearson_correlation',
      },
    ],

    spearman_correlation: [
      {
        number: 1,
        name: 'Scatter plot',
        description: `${outcome} vs ${exposure} — shown in results`,
        badge: 'in results',
        display_only: true,
      },
      {
        number: 2,
        name: 'Spearman correlation',
        description: 'rho coefficient and p-value',
        badge: 'primary analysis',
        analysis_type: 'spearman_correlation',
      },
    ],

    descriptive_statistics: [
      {
        number: 1,
        name: 'Descriptive statistics',
        description: 'Mean (SD) for continuous, n (%) for categorical variables',
        badge: 'primary analysis',
        analysis_type: 'descriptive_statistics',
      },
      {
        number: 2,
        name: 'Table 1 generation',
        description: 'Journal-standard baseline characteristics table — shown in results',
        badge: 'in results',
        display_only: true,
      },
    ],

    prevalence_estimation: [
      {
        number: 1,
        name: 'Prevalence estimation',
        description: `Proportion with ${outcome} and 95% confidence interval`,
        badge: 'primary analysis',
        analysis_type: 'prevalence_estimation',
      },
      {
        number: 2,
        name: 'Stratified prevalence',
        description: `Prevalence by ${exposure} subgroup — shown in results if exposure selected`,
        badge: 'in results',
        display_only: true,
      },
    ],

    poisson_regression: [
      {
        number: 1,
        name: 'Descriptive — outcome distribution',
        description: `Distribution of ${outcome} count variable — embedded in results`,
        badge: 'in results',
        display_only: true,
      },
      {
        number: 2,
        name: 'Poisson regression',
        description: `Incidence rate ratios for ${outcome}`,
        badge: 'primary analysis',
        analysis_type: 'poisson_regression',
      },
    ],

    propensity_score_matching: [
      {
        number: 1,
        name: 'Descriptive Statistics (pre-matching)',
        description: `Table 1 — covariate distribution by ${exposure} group before matching`,
        badge: 'auto-run',
        analysis_type: 'descriptive_statistics',
      },
      {
        number: 2,
        name: 'Propensity score estimation',
        description: `Logistic regression: P(${exposure}=1 | covariates) — estimated during matching step`,
        badge: 'in results',
        display_only: true,
      },
      {
        number: 3,
        name: '1:1 nearest-neighbour matching',
        description: `Match treated to controls within 0.2 × SD(logit PS) caliper — balance via standardised mean differences`,
        badge: 'primary analysis',
        analysis_type: 'propensity_score_matching',
      },
      {
        number: 4,
        name: 'Love plot — covariate balance',
        description: 'SMD before vs after matching — shown in results',
        badge: 'in results',
        display_only: true,
      },
      {
        number: 5,
        name: 'Outcome analysis on matched cohort',
        description: 'Run your outcome analysis on the matched dataset as a follow-up step',
        badge: 'manual next step',
        display_only: true,
      },
    ],
  }

  // Fallback: generic 2-step workflow
  return (
    WORKFLOWS[analysis_type] ?? [
      {
        number: 1,
        name: 'Run analysis',
        description: `Run ${analysis_type} on ${n.toLocaleString()} complete cases`,
        badge: 'primary analysis',
        analysis_type,
      },
    ]
  )
}
