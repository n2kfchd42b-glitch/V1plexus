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
        description: `Characterise all ${n.toLocaleString()} participants by ${exposure} group`,
        badge: 'auto-generates Table 1',
        analysis_type: 'descriptive_statistics',
      },
      {
        number: 2,
        name: 'Univariable logistic regression',
        description: `Crude odds ratios for ${exposure} and each covariate independently`,
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
        description: 'Multicollinearity (VIF), complete separation, influential observations',
        badge: 'auto-run by PLEXUS',
      },
      {
        number: 5,
        name: 'Forest plot — Adjusted Odds Ratios',
        description: `Publication-ready chart for ${outcome} predictors with 95% CIs`,
        badge: 'auto-generated',
      },
    ],

    linear_regression: [
      {
        number: 1,
        name: 'Descriptive Statistics',
        description: `Distribution of ${outcome} — mean, SD, normality check`,
        badge: 'auto-generated',
        analysis_type: 'descriptive_statistics',
      },
      {
        number: 2,
        name: 'Univariable linear regression',
        description: `Crude associations between ${outcome} and each predictor`,
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
        description: 'Normality of residuals, homoscedasticity, influential observations',
        badge: 'auto-run by PLEXUS',
      },
    ],

    kaplan_meier: [
      {
        number: 1,
        name: 'Descriptive Statistics',
        description: 'Characterise study population and event rate',
        badge: 'auto-generated',
        analysis_type: 'descriptive_statistics',
      },
      {
        number: 2,
        name: 'Kaplan-Meier survival curves',
        description: `Survival curves by ${exposure} group with log-rank test`,
        badge: 'primary analysis',
        analysis_type: 'kaplan_meier',
      },
      {
        number: 3,
        name: 'Median survival table',
        description: 'Median survival time with 95% CIs per group',
        badge: 'auto-generated',
      },
    ],

    cox_ph: [
      {
        number: 1,
        name: 'Kaplan-Meier curves',
        description: 'Unadjusted survival — run before Cox regression',
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
        name: 'Schoenfeld residuals',
        description: 'Test proportional hazards assumption',
        badge: 'auto-run by PLEXUS',
      },
      {
        number: 4,
        name: 'Forest plot — Hazard Ratios',
        description: 'Adjusted HRs with 95% CIs',
        badge: 'auto-generated',
      },
    ],

    chi_square: [
      {
        number: 1,
        name: 'Frequency table',
        description: `${outcome} × ${exposure} cross-tabulation with row and column percentages`,
        badge: 'auto-generated',
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
        description: "Cramér's V to quantify association strength",
        badge: 'auto-generated',
      },
    ],

    fisher_exact: [
      {
        number: 1,
        name: 'Frequency table',
        description: `2×2 contingency table for ${outcome} × ${exposure}`,
        badge: 'auto-generated',
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
        description: `Shapiro-Wilk test for ${outcome} in each group`,
        badge: 'auto-run by PLEXUS',
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
        description: `${outcome} distribution by ${exposure} group`,
        badge: 'auto-generated',
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

    one_way_anova: [
      {
        number: 1,
        name: 'Descriptive statistics by group',
        description: `Mean (SD) of ${outcome} per ${exposure} group`,
        badge: 'auto-generated',
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
        description: 'Pairwise comparisons between groups',
        badge: 'if ANOVA is significant',
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
        description: `${outcome} vs ${exposure} with regression line`,
        badge: 'auto-generated',
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
        description: `${outcome} vs ${exposure}`,
        badge: 'auto-generated',
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
        description: 'Journal-standard baseline characteristics table',
        badge: 'auto-generates Table 1',
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
        description: `Prevalence by ${exposure} subgroup`,
        badge: 'if exposure selected',
      },
    ],

    poisson_regression: [
      {
        number: 1,
        name: 'Descriptive — outcome distribution',
        description: `Distribution of ${outcome} count variable`,
        badge: 'auto-generated',
      },
      {
        number: 2,
        name: 'Poisson regression',
        description: `Incidence rate ratios for ${outcome}`,
        badge: 'primary analysis',
        analysis_type: 'poisson_regression',
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
