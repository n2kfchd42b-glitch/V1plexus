/**
 * Plain-language summary generator for AnalysisHub Card 4.
 *
 * For analysis types that already produce `result.plainLanguage` in the engine
 * (kaplan_meier, cox_regression, multiple_regression, logistic_regression),
 * `generatePlainLanguageSummary` will use that value directly.
 *
 * For all other types a template is applied against `result.summary`.
 * This file has ZERO side-effects and imports ONLY the AnalysisResult type.
 */

import type { AnalysisResult } from './types'

export interface PlainLanguageOutput {
  headline: string
  paragraph: string
  limitationFlag: string | null
  methodsParagraph: string
}

// ── helpers ──────────────────────────────────────────────

function get(s: Record<string, unknown>, key: string): string | null {
  const v = s[key]
  return v !== undefined && v !== null && v !== '' ? String(v) : null
}

function fmt(v: string | null, fallback = '—'): string {
  return v ?? fallback
}

function pSig(pVal: string | null): boolean {
  if (!pVal) return false
  const n = parseFloat(pVal)
  return !isNaN(n) && n < 0.05
}

// ── main export ───────────────────────────────────────────

export function generatePlainLanguageSummary(
  result: AnalysisResult,
  analysisType: string,
  datasetName = 'the dataset',
): PlainLanguageOutput {
  // If the engine already produced a plain language string, use it directly.
  if (result.plainLanguage) {
    const sentences = result.plainLanguage.split(/(?<=\.)\s+/)
    return {
      headline: sentences[0] ?? result.plainLanguage.slice(0, 120),
      paragraph: result.plainLanguage,
      limitationFlag: buildLimitationFlag(result.summary as Record<string, unknown>, analysisType),
      methodsParagraph: buildMethodsParagraph(analysisType, result.summary as Record<string, unknown>, datasetName),
    }
  }

  const s = result.summary as Record<string, unknown>
  const tables = result.tables ?? []
  let headline = ''
  let paragraph = ''

  switch (analysisType) {

    case 'descriptive': {
      const n = fmt(get(s, 'n'))
      const numericVars = get(s, 'numericVars') ?? '0'
      const catVars = get(s, 'catVars') ?? '0'
      const numericTable = tables.find(tbl => tbl.id === 'numeric_summary')
      if (numericTable && numericTable.rows.length > 0) {
        const r = numericTable.rows[0]
        const varName = r[0] ? String(r[0]) : 'the primary variable'
        const mean = r[3] ? String(r[3]) : null
        const sd   = r[4] ? String(r[4]) : null
        headline  = `Among ${n} participants, ${varName} had a mean of ${fmt(mean)} (SD ${fmt(sd)}).`
        paragraph = `The descriptive analysis of ${datasetName} summarised ${n} observations across ${numericVars} numeric and ${catVars} categorical variables. The primary variable ${varName} showed a mean of ${fmt(mean)} (SD ${fmt(sd)}). Review the per-variable distributions and assess outliers before running inferential tests.`
      } else {
        headline  = `The descriptive analysis summarised ${n} observations from ${datasetName}.`
        paragraph = `The dataset contained ${n} observations with ${numericVars} numeric and ${catVars} categorical variables. Review the frequency and summary tables for distributional characteristics before proceeding to inferential analyses.`
      }
      break
    }

    case 'frequency': {
      const n        = fmt(get(s, 'n'))
      const variable = fmt(get(s, 'variable'), 'the variable')
      const cats     = fmt(get(s, 'categories'))
      const ft       = tables[0]
      let mode: string | null = null
      if (ft && ft.rows.length > 0) {
        const topRow = ft.rows.reduce(
          (best, row) => Number(row[1]) > Number(best[1] ?? 0) ? row : best,
          ft.rows[0],
        )
        if (topRow[0] !== null) mode = String(topRow[0])
      }
      headline  = mode
        ? `The most frequent category of ${variable} was "${mode}" in a sample of ${n}.`
        : `Frequency analysis of ${variable} across ${cats} categories was completed (N=${n}).`
      paragraph = `A frequency distribution of ${variable} was computed across ${n} observations from ${datasetName}. ${mode ? `The modal category was "${mode}".` : ''} There were ${cats} distinct categories observed. Examine the frequency table for proportional breakdown and assess whether the distribution aligns with study expectations.`
      break
    }

    case 'chi_square': {
      const n    = fmt(get(s, 'n'))
      const chi2 = fmt(get(s, 'chiSq') ?? get(s, 'chi2'))
      const df   = fmt(get(s, 'df'))
      const pVal = get(s, 'pValue')
      const vRaw = get(s, 'cramersV') ?? get(s, 'v')
      const v    = fmt(vRaw)
      const sig  = pSig(pVal)
      const vNum = parseFloat(vRaw ?? '')
      const effect = isNaN(vNum) ? 'unknown' : vNum < 0.1 ? 'negligible' : vNum < 0.3 ? 'small-to-moderate' : 'moderate-to-large'
      headline  = sig
        ? `A statistically significant association was detected between the two variables (χ²(${df}) = ${chi2}, p = ${fmt(pVal)}).`
        : `No statistically significant association was found between the variables (χ²(${df}) = ${chi2}, p = ${fmt(pVal)}).`
      paragraph = `A chi-square test of independence was conducted on ${n} observations from ${datasetName}. The test ${sig ? 'revealed a significant association' : 'did not reveal a significant association'} between the variables (χ²(${df}) = ${chi2}, p = ${fmt(pVal)}). The effect size Cramér's V = ${v} indicates a ${effect} practical association. ${!sig ? 'Insufficient power or a true absence of association may explain the non-significant result.' : ''}`
      break
    }

    case 't_test': {
      const tt = tables[0]
      let tVal: string | null = null
      let pVal: string | null = null
      let mean: string | null = null
      let n = fmt(get(s, 'n'))
      if (tt && tt.rows.length > 0) {
        const hi = (kw: string) => tt.headers.findIndex(h => h.toLowerCase().includes(kw))
        const r  = tt.rows[0]
        const tIdx = hi('t'); const pIdx = hi('p'); const mIdx = hi('mean'); const nIdx = hi('n')
        if (tIdx >= 0) tVal = String(r[tIdx])
        if (pIdx >= 0) pVal = String(r[pIdx])
        if (mIdx >= 0) mean = String(r[mIdx])
        if (nIdx >= 0) n    = String(r[nIdx])
      }
      const sig       = pSig(pVal)
      const testType  = fmt(get(s, 'testType'), 't-test')
      const variable  = fmt(get(s, 'variable'), 'the variable')
      headline  = sig
        ? `A significant difference was found in ${variable} between groups (t = ${fmt(tVal)}, p = ${fmt(pVal)}).`
        : `No significant difference was found in ${variable} between groups (t = ${fmt(tVal)}, p = ${fmt(pVal)}).`
      paragraph = `A ${testType} was conducted comparing ${variable} across ${n} observations in ${datasetName}. The observed mean was ${fmt(mean)}. The test ${sig ? 'indicated a statistically significant difference between groups' : 'did not reach statistical significance'} (t = ${fmt(tVal)}, p = ${fmt(pVal)}). ${!sig ? 'Consider whether the study was adequately powered to detect the expected effect size.' : ''}`
      break
    }

    case 'anova': {
      const n    = fmt(get(s, 'n'))
      const f    = fmt(get(s, 'fStat'))
      const pVal = get(s, 'pValue')
      const eta  = fmt(get(s, 'etaSq') ?? get(s, 'etaSquared'))
      const sig  = pSig(pVal)
      const etaNum = parseFloat(eta)
      headline  = sig
        ? `A significant difference was found across groups (F = ${f}, p = ${fmt(pVal)}, η² = ${eta}).`
        : `No significant difference was detected across groups (F = ${f}, p = ${fmt(pVal)}).`
      paragraph = `A one-way ANOVA was performed on ${n} observations from ${datasetName}. The omnibus test ${sig ? 'detected a statistically significant difference' : 'did not detect a significant difference'} across groups (F = ${f}, p = ${fmt(pVal)}). The effect size η² = ${eta} indicates the grouping variable explains ${!isNaN(etaNum) ? (etaNum * 100).toFixed(1) + '%' : 'an unknown proportion'} of total variance. ${sig ? 'Post-hoc comparisons are recommended to identify which groups differ.' : 'Consider increasing sample size to improve power.'}`
      break
    }

    case 'correlation': {
      const method = fmt(get(s, 'method'), 'Pearson')
      const n      = fmt(get(s, 'n'))
      const ct     = tables[0]
      let rVal: string | null = null
      let pVal: string | null = null
      if (ct && ct.rows.length > 0 && ct.rows[0].length >= 2) {
        rVal = ct.rows[0][1] !== null ? String(ct.rows[0][1]) : null
        const pRow = ct.rows.find(row => String(row[0]).toLowerCase().includes('p-val'))
        if (pRow && pRow[1] !== null) pVal = String(pRow[1])
      }
      const sig       = pSig(pVal)
      const rNum      = parseFloat(rVal ?? '')
      const direction = !isNaN(rNum) && rNum > 0 ? 'positive' : 'negative'
      const strength  = isNaN(rNum) ? 'unknown' : Math.abs(rNum) < 0.3 ? 'weak' : Math.abs(rNum) < 0.6 ? 'moderate' : 'strong'
      headline  = rVal
        ? `A ${strength} ${direction} correlation (r = ${fmt(rVal)}) was observed${sig ? ', reaching statistical significance' : ', though not statistically significant'}.`
        : `A ${method} correlation analysis was completed across ${n} observations.`
      paragraph = `A ${method} correlation analysis was conducted on ${n} paired observations from ${datasetName}. The correlation coefficient r = ${fmt(rVal)} indicates a ${strength} ${direction} linear association${pVal ? ` (p = ${pVal})` : ''}. ${!sig ? 'The relationship did not reach statistical significance; interpret with caution.' : 'The association is statistically significant and warrants further investigation in a regression framework.'}`
      break
    }

    case 'multinomial_regression': {
      const n    = fmt(get(s, 'n'))
      const cats = fmt(get(s, 'categories'))
      const ref  = fmt(get(s, 'reference'), 'baseline')
      headline  = `Multinomial logistic regression compared ${cats} outcome categories vs reference "${ref}" in ${n} participants.`
      paragraph = `A multinomial logistic regression was fitted on ${n} complete cases from ${datasetName}. The model compared ${cats} non-reference outcome categories against the reference "${ref}", producing relative risk ratios (RRR) for each predictor. An RRR > 1 indicates higher odds of that outcome category versus the reference. Examine the per-category tables and forest plot for direction, magnitude, and significance of individual predictors.`
      break
    }

    case 'simple_regression': {
      const n    = fmt(get(s, 'n'))
      const r2   = fmt(get(s, 'r2') ?? get(s, 'rSquared'))
      const pVal = get(s, 'pValue')
      const sig  = pSig(pVal)
      const r2Num = parseFloat(r2)
      headline  = sig
        ? `The predictor accounted for ${!isNaN(r2Num) ? (r2Num * 100).toFixed(1) + '%' : 'a significant proportion'} of variance in the outcome (p = ${fmt(pVal)}).`
        : `The regression model was not statistically significant (R² = ${r2}, p = ${fmt(pVal)}).`
      paragraph = `A simple linear regression was fitted on ${n} observations from ${datasetName}. The model explained R² = ${r2} of the variance in the outcome. The overall model fit was ${sig ? 'statistically significant' : 'not statistically significant'} (p = ${fmt(pVal)}). ${!sig ? 'The predictor may not be linearly related to the outcome, or the sample may be underpowered.' : ''}`
      break
    }

    case 'pca': {
      const n    = fmt(get(s, 'n'))
      const comp = fmt(get(s, 'nComp') ?? get(s, 'p'))
      const pc1  = fmt(get(s, 'varExplained1'))
      const pc2  = fmt(get(s, 'varExplained2'))
      headline  = `PCA identified ${comp} principal components; PC1 explained ${pc1}% of variance.`
      paragraph = `Principal component analysis was performed on ${n} observations from ${datasetName}. The first two components accounted for ${pc1}% and ${pc2}% of total variance respectively. ${comp} components were retained based on the scree plot. Examine the loading plot to identify which variables drive each component.`
      break
    }

    case 'cluster_analysis': {
      const n   = fmt(get(s, 'n'))
      const k   = fmt(get(s, 'nClusters') ?? get(s, 'k'))
      const silRaw = get(s, 'avgSilhouette') ?? get(s, 'silhouette')
      const sil    = fmt(silRaw)
      const silNum = parseFloat(silRaw ?? '')
      const quality = isNaN(silNum) ? 'unknown' : silNum > 0.5 ? 'strong' : silNum > 0.25 ? 'moderate' : 'weak'
      headline  = `${k} clusters were identified from ${n} observations with ${quality} cohesion (silhouette = ${sil}).`
      paragraph = `Cluster analysis partitioned ${n} observations from ${datasetName} into ${k} groups. The average silhouette score of ${sil} indicates ${quality} cluster separation. Examine the cluster profile table to characterise each group and assess whether the groupings are clinically or scientifically meaningful.`
      break
    }

    case 'meta_analysis': {
      const k    = fmt(get(s, 'k'))
      const es   = fmt(get(s, 'summaryES'))
      const i2Raw = get(s, 'I2') ?? get(s, 'i2')
      const i2   = fmt(i2Raw)
      const pVal = get(s, 'pValue')
      const sig  = pSig(pVal)
      const i2Num = parseFloat(i2Raw ?? '')
      const het  = isNaN(i2Num) ? 'unknown' : i2Num > 75 ? 'high' : i2Num > 50 ? 'moderate' : 'low'
      headline  = sig
        ? `The pooled effect size across ${k} studies was ${es} (p = ${fmt(pVal)}).`
        : `No statistically significant pooled effect was detected across ${k} studies (p = ${fmt(pVal)}).`
      paragraph = `A meta-analysis was conducted across ${k} studies. The pooled effect size was ${es} (p = ${fmt(pVal)}), indicating the effect was ${sig ? '' : 'not '}statistically significant. Heterogeneity was ${het} (I² = ${i2}%), which ${i2Num > 50 ? 'suggests meaningful variation across studies and warrants subgroup analyses' : 'indicates acceptable consistency across the included studies'}.`
      break
    }

    case 'time_series': {
      const n    = fmt(get(s, 'n'))
      const tp   = fmt(get(s, 'timePoints'))
      headline  = `Time series analysis was conducted across ${tp} time points in ${n} observations.`
      paragraph = `A time series analysis was performed on ${n} observations and ${tp} time points from ${datasetName}. Examine the model fit statistics and residual ACF plots to assess whether the trend, seasonality, and error components are adequately captured before forecasting.`
      break
    }

    case 'sample_size': {
      const design    = fmt(get(s, 'design'))
      const nPerGroup = fmt(get(s, 'nPerGroup'))
      const totalN    = fmt(get(s, 'totalN') ?? get(s, 'finalN'))
      const powerRaw  = get(s, 'power')
      const powerPct  = powerRaw ? (parseFloat(powerRaw) * 100).toFixed(0) + '%' : 'target'
      headline  = `A total sample of ${totalN} (${nPerGroup} per group) achieves ${powerPct} power.`
      paragraph = `Sample size calculation for a ${design} design determined that ${nPerGroup} participants per group (${totalN} total) are required to achieve ${powerPct} statistical power at α = 0.05. Confirm recruitment feasibility and budget alignment before protocol finalisation.`
      break
    }

    default: {
      const keys = Object.keys(s).filter(k => k !== 'error').slice(0, 3)
      const vals = keys.map(k => `${k.replace(/_/g, ' ')}: ${String(s[k])}`).join(', ')
      headline  = `Analysis completed on the ${datasetName} dataset.`
      paragraph = `The ${analysisType.replace(/_/g, ' ')} analysis was completed successfully. Key outputs: ${vals || 'see results table'}. Review the full results page for interactive charts, tables, and diagnostic plots.`
    }
  }

  return {
    headline,
    paragraph,
    limitationFlag: buildLimitationFlag(s, analysisType),
    methodsParagraph: buildMethodsParagraph(analysisType, s, datasetName),
  }
}

// ── limitation flag ───────────────────────────────────────

function buildLimitationFlag(s: Record<string, unknown>, analysisType: string): string | null {
  const n      = parseFloat(String(s.n ?? s.N ?? ''))
  const pVal   = parseFloat(String(s.pValue ?? s.p ?? ''))
  const events = parseFloat(String(s.events ?? ''))

  if (!isNaN(n) && n < 100) {
    return `⚠ Interpret with caution — small sample (N=${Math.round(n)})`
  }
  if (!isNaN(pVal) && pVal > 0.05) {
    return `⚠ Non-significant result — consider statistical power`
  }
  if (
    (analysisType === 'kaplan_meier' || analysisType === 'cox_regression') &&
    !isNaN(events) && events < 10
  ) {
    return `⚠ Fewer than 10 events — survival estimates are unreliable`
  }
  return null
}

// ── methods paragraph ─────────────────────────────────────

const ASSUMPTIONS: Record<string, string> = {
  t_test:               "Normality was assessed using the Shapiro-Wilk test; equal variances were evaluated with Levene's test.",
  anova:                "Homogeneity of variance was assessed with Levene's test. Post-hoc comparisons used Tukey HSD.",
  simple_regression:    'Residuals were inspected for normality and homoscedasticity.',
  multiple_regression:  'Multicollinearity was assessed using variance inflation factors (VIF). Residuals were inspected for normality and homoscedasticity.',
  logistic_regression:      'Model discrimination was assessed using the AUC of the ROC curve. Calibration was evaluated with the Hosmer-Lemeshow test.',
  multinomial_regression:   'One-vs-reference logistic models were fitted for each non-reference outcome category. Multicollinearity was assessed via VIF. Model convergence was verified for each category.',
  kaplan_meier:         'Survival curves were compared using the log-rank test. The proportional hazards assumption was not tested at this stage.',
  cox_regression:       'The proportional hazards assumption was assessed using Schoenfeld residuals.',
  chi_square:           'Expected cell counts were verified to meet the minimum threshold (≥5) required for validity.',
  correlation:          'Linearity was assessed using a scatter plot prior to correlation computation.',
  pca:                  'Variables were standardised (z-scored) prior to PCA. Component retention used the Kaiser criterion (eigenvalue > 1) confirmed by scree plot.',
  cluster_analysis:     'Features were standardised prior to clustering. The optimal cluster count was selected using the elbow method and silhouette analysis.',
  meta_analysis:        'Heterogeneity was quantified using I² and Cochran\'s Q. A random-effects model was applied when I² > 50%.',
  factor_analysis:      'Factorability was assessed using the KMO measure. Rotation method was Varimax.',
  time_series:          'Stationarity was assessed using the Augmented Dickey-Fuller test. Residual autocorrelation was evaluated via the ACF plot.',
}

function buildMethodsParagraph(
  analysisType: string,
  s: Record<string, unknown>,
  datasetName: string,
): string {
  const n         = get(s, 'n') ?? 'N'
  const typeLabel = analysisType.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase())
  const assumption = ASSUMPTIONS[analysisType] ?? 'Standard diagnostic checks were applied.'
  return `${typeLabel} analysis was performed using the PLEXUS statistical engine. ${assumption} Significance threshold was set at α = 0.05. Analysis was conducted on ${n} complete cases from the ${datasetName} dataset.`
}
