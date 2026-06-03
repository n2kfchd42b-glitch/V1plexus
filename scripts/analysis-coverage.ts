/**
 * Guided-path coverage smoke test.
 *
 * The numerical suite (analysis-regression.ts) calls each estimator with a
 * hand-written, CORRECT config. That misses a whole class of bug: the guided
 * decision engine builds the config itself via buildBackendConfig +
 * ANALYSIS_TYPE_MAPPING, and if that mapping emits a shape the analysis
 * function doesn't read, the analysis silently returns nothing.
 * (This is exactly how `prevalence_estimation` shipped emitting `{variables}`
 * while runFrequency only reads `rowVariable`.)
 *
 * This harness drives EVERY AnalysisTypeId through the real guided plumbing and
 * asserts the run produces output. It is the checklist that turns "some
 * analyses don't produce results" into a loud, specific failure.
 *
 * Run with:  npm run test:analysis:coverage   (tsx scripts/analysis-coverage.ts)
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { runAnalysis } from '../src/lib/analysis/engine'
import { buildBackendConfig, ANALYSIS_TYPE_MAPPING } from '../src/lib/decision-engine/index'
import type { AnalysisConfig, AnalysisTypeId } from '../src/lib/decision-engine/types'
import type { DataRow } from '../src/lib/analysis/types'

const here = dirname(fileURLToPath(import.meta.url))
const fixture = JSON.parse(readFileSync(join(here, 'analysis-fixture.json'), 'utf8')) as {
  data: DataRow[]
}
const data = fixture.data

// Representative variable roles for each analysis type, using the fixture's
// columns: continuous = age/sbp/survtime, binary = event/died, count = visits,
// 2-group = grp/sex, 3-group = region.
type Vars = Partial<Pick<AnalysisConfig,
  'outcome_variable' | 'exposure_variable' | 'covariate_variables' |
  'time_variable' | 'event_variable' | 'group_variable' | 'strat_variable'>>

const CASES: Record<AnalysisTypeId, Vars> = {
  descriptive_statistics:    { outcome_variable: 'age', covariate_variables: ['sbp'] },
  prevalence_estimation:     { outcome_variable: 'event' },
  logistic_regression:       { outcome_variable: 'event', exposure_variable: 'age', covariate_variables: ['sbp'] },
  multinomial_regression:    { outcome_variable: 'region', exposure_variable: 'age', covariate_variables: [] },
  linear_regression:         { outcome_variable: 'sbp', exposure_variable: 'age', covariate_variables: [] },
  poisson_regression:        { outcome_variable: 'visits', exposure_variable: 'age', covariate_variables: [] },
  chi_square:                { outcome_variable: 'sex', exposure_variable: 'event' },
  fisher_exact:              { outcome_variable: 'sex', exposure_variable: 'event' },
  independent_t_test:        { outcome_variable: 'sbp', exposure_variable: 'grp' },
  mann_whitney:              { outcome_variable: 'sbp', exposure_variable: 'grp' },
  one_way_anova:             { outcome_variable: 'sbp', exposure_variable: 'region' },
  kruskal_wallis:            { outcome_variable: 'sbp', exposure_variable: 'region' },
  pearson_correlation:       { outcome_variable: 'age', exposure_variable: 'sbp' },
  spearman_correlation:      { outcome_variable: 'age', exposure_variable: 'sbp' },
  kaplan_meier:              { time_variable: 'survtime', event_variable: 'died', group_variable: 'grp' },
  cox_ph:                    { time_variable: 'survtime', event_variable: 'died', exposure_variable: 'age', covariate_variables: [] },
  propensity_score_matching: { exposure_variable: 'event', covariate_variables: ['age', 'sbp'] },
}

async function main() {
let passed = 0
const failures: string[] = []

for (const [type, vars] of Object.entries(CASES) as [AnalysisTypeId, Vars][]) {
  const config: AnalysisConfig = {
    analysis_type: type,
    dataset_id: 'fixture',
    version_id: 'fixture',
    outcome_variable: vars.outcome_variable ?? null,
    exposure_variable: vars.exposure_variable ?? null,
    covariate_variables: vars.covariate_variables ?? [],
    time_variable: vars.time_variable ?? null,
    event_variable: vars.event_variable ?? null,
    group_variable: vars.group_variable ?? null,
    strat_variable: vars.strat_variable ?? null,
    confidence_level: 0.95,
    reference_category: 'first',
  }

  const backendType = ANALYSIS_TYPE_MAPPING[type]
  const backendConfig = buildBackendConfig(config)

  try {
    const res = await runAnalysis(backendType, data, backendConfig)
    const err = (res.summary as Record<string, unknown>)?.error
    if (err) {
      failures.push(`${type} (→ ${backendType}): returned error: ${String(err)}`)
    } else if (!res.tables || res.tables.length === 0) {
      failures.push(`${type} (→ ${backendType}): produced 0 result tables`)
    } else if (res.tables.every(t => !t.rows || t.rows.length === 0)) {
      failures.push(`${type} (→ ${backendType}): all result tables are empty`)
    } else {
      passed++
    }
  } catch (e) {
    failures.push(`${type} (→ ${backendType}): threw ${e instanceof Error ? e.message : String(e)}`)
  }
}

if (failures.length > 0) {
  console.error(`\n❌ Guided-path coverage FAILED — ${failures.length} type(s) produce no usable output, ${passed} ok:\n`)
  for (const f of failures) console.error('  • ' + f)
  process.exit(1)
}
console.log(`✅ Guided-path coverage: all ${passed} analysis types produce non-empty results through buildBackendConfig.`)
}

main().catch(e => { console.error(e); process.exit(1) })
