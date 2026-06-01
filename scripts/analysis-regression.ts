/**
 * Numerical regression suite for the statistical engine.
 *
 * Runs the ACTUAL analysis functions on a fixed canonical dataset and asserts
 * their outputs match reference values computed independently in Python
 * (scipy / statsmodels) — see scripts/gen-analysis-fixture.py.
 *
 * Run with:  npm run test:analysis   (tsx scripts/analysis-regression.ts)
 *
 * This is the end-to-end protection the audit flagged as missing: it pins each
 * estimator to a known-correct numeric result so a future change that breaks the
 * math fails loudly.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { runCorrelation, runTTest, runAnova, runChiSquare } from '../src/lib/analysis/tests'
import {
  runMultipleRegression, runLogisticRegression, runPoissonRegression, runMultinomialRegression,
} from '../src/lib/analysis/regression'
import { runKaplanMeier, runCoxRegression } from '../src/lib/analysis/survival'
import type { AnalysisResult, DataRow } from '../src/lib/analysis/types'

const here = dirname(fileURLToPath(import.meta.url))
const fixture = JSON.parse(readFileSync(join(here, 'analysis-fixture.json'), 'utf8')) as {
  data: DataRow[]
  ref: Record<string, Record<string, number>>
}
const { data, ref } = fixture

// ── tiny assert harness ───────────────────────────────────────────────────────
let passed = 0
const failures: string[] = []

function num(v: unknown): number {
  if (typeof v === 'number') return v
  const s = String(v ?? '')
  if (s.includes('<')) return 0.0005 // "<0.001"
  return parseFloat(s.replace(/[^0-9eE.+-]/g, ''))
}

function near(label: string, actual: number, expected: number, tol: number) {
  if (Number.isNaN(actual)) {
    failures.push(`${label}: got NaN, expected ${expected}`)
    return
  }
  if (Math.abs(actual - expected) <= tol) {
    passed++
  } else {
    failures.push(`${label}: got ${actual}, expected ${expected} (±${tol})`)
  }
}

function cell(res: AnalysisResult, tableId: string, row: number, col: number): unknown {
  const t = res.tables.find(tb => tb.id === tableId)
  return t?.rows[row]?.[col]
}

// ── 1. Pearson correlation (age vs sbp) ──────────────────────────────────────
{
  const r = runCorrelation(data, { variables: ['age', 'sbp'], method: 'pearson', pAdjustment: 'none' })
  near('pearson r', num(r.summary.correlation), ref.pearson_age_sbp.r, 0.005)
}

// ── 2. Spearman correlation (age vs sbp) ─────────────────────────────────────
{
  const r = runCorrelation(data, { variables: ['age', 'sbp'], method: 'spearman', pAdjustment: 'none' })
  near('spearman rho', num(r.summary.correlation), ref.spearman_age_sbp.rho, 0.005)
}

// ── 3. Welch independent t-test (sbp by grp) ─────────────────────────────────
{
  const r = runTTest(data, {
    testType: 'independent', variable: 'sbp', groupVariable: 'grp',
    confidenceLevel: 0.95, equalVariances: false,
  })
  near('welch t',  num(cell(r, 't_test', 0, 1)), ref.welch_ttest_sbp_grp.t, 0.01)
  near('welch df', num(cell(r, 't_test', 0, 2)), ref.welch_ttest_sbp_grp.df, 0.1)
  near('welch p',  num(cell(r, 't_test', 0, 3)), ref.welch_ttest_sbp_grp.p, 0.01)
}

// ── 4. One-way ANOVA (sbp by region) ─────────────────────────────────────────
{
  const r = runAnova(data, { dependent: 'sbp', factor1: 'region', posthoc: 'none' })
  near('anova F', num(r.summary.fStat), ref.anova_sbp_region.F, 0.02)
  near('anova p', num(r.summary.pValue), ref.anova_sbp_region.p, 0.01)
}

// ── 5. Chi-square (sex × event, no Yates) ────────────────────────────────────
{
  const r = runChiSquare(data, { variable1: 'sex', variable2: 'event', showExpected: false, yatesCorrection: false })
  near('chi2', num(r.summary.chiSq), ref.chisq_sex_event.chi2, 0.01)
  near('chi2 df', num(r.summary.df), ref.chisq_sex_event.df, 0)
  near('chi2 p', num(r.summary.pValue), ref.chisq_sex_event.p, 0.01)
}

// ── 6. OLS linear regression (sbp ~ age) ─────────────────────────────────────
{
  const r = runMultipleRegression(data, { dependent: 'sbp', independents: ['age'], confidenceLevel: 0.95 })
  near('ols beta_age', num(r.summary.coefficient), ref.ols_sbp_age.beta_age, 0.005)
  near('ols r2', num(r.summary.r2), ref.ols_sbp_age.r2, 0.005)
}

// ── 7. Logistic regression (event ~ age) ─────────────────────────────────────
{
  const r = runLogisticRegression(data, { outcome: 'event', predictors: ['age'], confidenceLevel: 0.95 })
  near('logit OR_age', num(r.summary.odds_ratio), ref.logit_event_age.OR_age, 0.02)
}

// ── 8. Cox proportional hazards (survtime, died ~ age) ───────────────────────
{
  const r = runCoxRegression(data, {
    timeVariable: 'survtime', eventVariable: 'died', predictors: ['age'], confidenceLevel: 0.95,
  })
  near('cox HR_age', num(r.summary.hazard_ratio), ref.cox_survtime_age.HR_age, 0.02)
}

// ── 9. Kaplan-Meier log-rank test (survival by grp) ──────────────────────────
{
  const r = runKaplanMeier(data, {
    timeVariable: 'survtime', eventVariable: 'died', groupVariable: 'grp', confidenceLevel: 0.95,
  })
  near('km log-rank p', num(r.summary.logRankP), ref.logrank_survtime_grp.p, 0.02)
}

// ── 10. Poisson regression (visits ~ age) ────────────────────────────────────
{
  const r = runPoissonRegression(data, { outcome: 'visits', predictors: ['age'], confidenceLevel: 0.95 })
  near('poisson IRR_age', num(r.summary.estimate), ref.poisson_visits_age.IRR_age, 0.01)
}

// ── 11. Multinomial regression (region ~ age) — primary RRR (North vs East) ──
{
  const r = runMultinomialRegression(data, { outcome: 'region', predictors: ['age'], confidenceLevel: 0.95 })
  near('multinomial RRR_age', num(r.summary.odds_ratio), ref.multinomial_region_north_vs_east_age.RRR_age, 0.05)
}

// ── report ────────────────────────────────────────────────────────────────────
if (failures.length > 0) {
  console.error(`\n❌ Analysis regression FAILED — ${failures.length} mismatch(es), ${passed} passed:\n`)
  for (const f of failures) console.error('  • ' + f)
  process.exit(1)
}
console.log(`✅ Analysis numerical regression: all ${passed} assertions match scipy/statsmodels references.`)
