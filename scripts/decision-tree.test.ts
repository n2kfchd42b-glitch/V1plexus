/**
 * Decision-tree routing test.
 *
 * Pins the analysis the guided engine recommends for representative
 * variable shapes — especially the distribution-aware parametric vs
 * non-parametric choice added in the correctness pass. A future change that
 * reroutes (e.g. recommending a t-test for skewed data again) fails loudly.
 *
 * Run with:  npm run test:decisions   (tsx scripts/decision-tree.test.ts)
 */

import { decideAnalysisType } from '../src/lib/decision-engine/decisionTree'
import type { EngineColumnSchema, VariableSelection, ResearchIntent, AnalysisTypeId } from '../src/lib/decision-engine/types'

// ── column factory ────────────────────────────────────────────────────────────
function col(
  name: string,
  type: EngineColumnSchema['type'],
  extra: Partial<EngineColumnSchema> = {},
): EngineColumnSchema {
  return { name, label: null, type, null_count: 0, unique_count: 0, ...extra }
}

function vars(overrides: Partial<VariableSelection>): VariableSelection {
  return {
    outcome: null, exposure: null, covariates: [],
    time_variable: null, event_variable: null, group_variable: null, strat_variable: null,
    ...overrides,
  }
}

const N = 200
let passed = 0
const failures: string[] = []

function expectPrimary(
  label: string, intent: ResearchIntent, selection: VariableSelection,
  primary: AnalysisTypeId, mustHaveAlt?: AnalysisTypeId, paired = false,
) {
  const res = decideAnalysisType(intent, selection, N, paired)
  if (res.primary !== primary) {
    failures.push(`${label}: expected primary ${primary}, got ${res.primary}`)
    return
  }
  if (mustHaveAlt && !res.alternatives.some(a => a.id === mustHaveAlt)) {
    failures.push(`${label}: expected ${mustHaveAlt} among alternatives, got [${res.alternatives.map(a => a.id).join(', ')}]`)
    return
  }
  passed++
}

const normalCont  = (n: string) => col(n, 'continuous', { skewness: 0.2 })
const skewedCont  = (n: string) => col(n, 'continuous', { skewness: 2.4 })
const twoGroup    = (n: string) => col(n, 'binary', { unique_count: 2 })
const threeGroup  = (n: string) => col(n, 'categorical', { unique_count: 3 })

// ── compare: continuous outcome by 2 groups ───────────────────────────────────
expectPrimary('compare normal × 2-group', 'compare',
  vars({ outcome: normalCont('sbp'), group_variable: twoGroup('arm') }),
  'independent_t_test', 'mann_whitney')

expectPrimary('compare skewed × 2-group', 'compare',
  vars({ outcome: skewedCont('cost'), group_variable: twoGroup('arm') }),
  'mann_whitney', 'independent_t_test')

// ── compare: continuous outcome by 3 groups ───────────────────────────────────
expectPrimary('compare normal × 3-group', 'compare',
  vars({ outcome: normalCont('sbp'), group_variable: threeGroup('region') }),
  'one_way_anova', 'kruskal_wallis')

expectPrimary('compare skewed × 3-group', 'compare',
  vars({ outcome: skewedCont('los'), group_variable: threeGroup('region') }),
  'kruskal_wallis', 'one_way_anova')

// ── associate: continuous outcome × group exposure ────────────────────────────
expectPrimary('associate skewed × 2-group', 'associate',
  vars({ outcome: skewedCont('cost'), exposure: twoGroup('arm') }),
  'mann_whitney', 'independent_t_test')

expectPrimary('associate skewed × 3-group', 'associate',
  vars({ outcome: skewedCont('los'), exposure: threeGroup('region') }),
  'kruskal_wallis', 'one_way_anova')

// ── associate: continuous × continuous ────────────────────────────────────────
expectPrimary('associate normal × normal', 'associate',
  vars({ outcome: normalCont('age'), exposure: normalCont('sbp') }),
  'pearson_correlation', 'spearman_correlation')

expectPrimary('associate skewed × continuous', 'associate',
  vars({ outcome: skewedCont('income'), exposure: normalCont('age') }),
  'spearman_correlation', 'pearson_correlation')

// ── compare: paired / repeated measurements ──────────────────────────────────
expectPrimary('compare paired normal', 'compare',
  vars({ outcome: normalCont('pre'), exposure: normalCont('post') }),
  'paired_t_test', 'wilcoxon_signed_rank', /* paired */ true)

expectPrimary('compare paired skewed', 'compare',
  vars({ outcome: skewedCont('pre_cost'), exposure: normalCont('post_cost') }),
  'wilcoxon_signed_rank', 'paired_t_test', /* paired */ true)

// ── unknown skew falls back to parametric (no guessing) ───────────────────────
expectPrimary('compare unknown-skew × 2-group falls back to t-test', 'compare',
  vars({ outcome: col('sbp', 'continuous'), group_variable: twoGroup('arm') }),
  'independent_t_test')

// ── report ─────────────────────────────────────────────────────────────────────
if (failures.length > 0) {
  console.error(`\n❌ Decision-tree routing FAILED — ${failures.length} mismatch(es), ${passed} passed:\n`)
  for (const f of failures) console.error('  • ' + f)
  process.exit(1)
}
console.log(`✅ Decision-tree routing: all ${passed} routing assertions correct.`)
