import type { AnalysisResult } from '@/lib/analysis/types'

// ── Key findings per analysis type ──────────────────────
// Extracts the handful of headline numbers worth showing as summary chips for a
// given analysis result. Pulls from result.summary first, falling back to known
// result tables. Shared by AnalysisHub and the ResultBlock canvas renderer.

export type Finding = { label: string; value: string }

export function getKeyFindings(result: AnalysisResult, analysisType: string): Finding[] {
  const s = result.summary as Record<string, unknown>
  const tables = result.tables ?? []

  const get = (key: string): string | null =>
    s[key] !== undefined && s[key] !== null && s[key] !== '' ? String(s[key]) : null

  const fromTable = (tableId: string, headerKw: string, rowIdx = 0): string | null => {
    const t = tables.find(t => t.id === tableId || t.title?.toLowerCase().includes(tableId))
    if (!t || !t.rows[rowIdx]) return null
    const colIdx = t.headers.findIndex(h => h.toLowerCase().includes(headerKw.toLowerCase()))
    if (colIdx < 0) return null
    const v = t.rows[rowIdx][colIdx]
    return v !== null && v !== undefined ? String(v) : null
  }

  const findings: Finding[] = []
  const add = (label: string, value: string | null) => {
    if (value !== null && findings.length < 6) findings.push({ label, value })
  }

  switch (analysisType) {
    case 'descriptive': {
      add('N', get('n'))
      const nv = get('numericVars'); const cv = get('catVars')
      if (nv !== null) add('Numeric Vars', nv)
      if (cv !== null) add('Cat Vars', cv)
      const nt = tables.find(t => t.id === 'numeric_summary')
      if (nt && nt.rows.length > 0) {
        const r = nt.rows[0]
        if (r[3] !== null) add('Mean', String(r[3]))
        if (r[4] !== null) add('SD', String(r[4]))
      }
      break
    }
    case 'frequency': {
      add('N', get('n')); add('Variable', get('variable')); add('Categories', get('categories'))
      const ft = tables[0]
      if (ft && ft.rows.length > 0) {
        const topRow = ft.rows.reduce((best, row) => Number(row[1]) > Number(best[1] ?? 0) ? row : best, ft.rows[0])
        if (topRow[0] !== null) add('Mode', String(topRow[0]))
      }
      break
    }
    case 'chi_square':
      add('N', get('n')); add('χ²', get('chiSq') ?? get('chi2'))
      add('p-value', get('pValue')); add("Cramér's V", get('cramersV') ?? get('v'))
      break
    case 't_test': {
      const tt = tables[0]
      if (tt) {
        const hi = (kw: string) => tt.headers.findIndex(h => h.toLowerCase().includes(kw))
        const r = tt.rows[0]
        if (r) {
          const nIdx = hi('n'); const meanIdx = hi('mean'); const tIdx = hi('t'); const pIdx = hi('p'); const dIdx = hi('cohen')
          if (nIdx >= 0) add('N', String(r[nIdx]))
          if (meanIdx >= 0) add('Mean', String(r[meanIdx]))
          if (tIdx >= 0) add('t', String(r[tIdx]))
          if (pIdx >= 0) add('p-value', String(r[pIdx]))
          if (dIdx >= 0) add("Cohen's d", String(r[dIdx]))
        }
      }
      if (findings.length === 0) { add('Test', get('testType')); add('Variable', get('variable')) }
      break
    }
    case 'anova':
      add('N', get('n')); add('F', get('fStat')); add('p-value', get('pValue')); add('η²', get('etaSq') ?? get('etaSquared'))
      break
    case 'correlation': {
      add('Variables', get('variables')); add('Method', get('method'))
      const ct = tables[0]
      if (ct && ct.rows.length > 0 && ct.rows[0].length >= 2) {
        const rVal = ct.rows[0][1]
        if (rVal !== null) add('r', String(rVal))
        const pRow = ct.rows.find(row => String(row[0]).toLowerCase().includes('p-val'))
        if (pRow && pRow[1] !== null) add('p-value', String(pRow[1]))
      }
      break
    }
    case 'simple_regression':
      add('N', get('n')); add('R²', get('r2') ?? get('rSquared')); add('p-value', get('pValue'))
      add('β', fromTable('coefficients', 'estimate', 1) ?? fromTable('coeff', 'b', 1))
      break
    case 'multiple_regression':
      add('N', get('n')); add('R²', get('r2') ?? get('rSquared')); add('Adj R²', get('adjR2') ?? get('adjustedR2')); add('p-value', get('pValue'))
      break
    case 'logistic_regression':
      add('N', get('n')); add('Events', get('events')); add('AUC', get('auc')); add('Nagelkerke R²', get('nagelkerkeR2'))
      break
    case 'multinomial_regression':
      add('N', get('n')); add('Categories', get('categories')); add('Reference', get('reference'))
      break
    case 'ordinal_regression':
      add('N', get('n')); add('AIC', get('aic')); add('p-value', get('pValue')); add('Pseudo R²', get('pseudoR2') ?? get('mcfadden'))
      break
    case 'poisson_regression':
    case 'negbinomial_regression':
      add('N', get('n')); add('AIC', get('aic')); add('Deviance', get('deviance')); add('p-value', get('pValue'))
      break
    case 'kaplan_meier':
      add('N Total', get('n')); add('Events', get('events')); add('Groups', get('groups')); add('Log-rank p', get('logRankP'))
      break
    case 'cox_regression':
      add('N', get('n')); add('Events', get('events')); add('C-statistic', get('concordance')); add('LR p-value', get('lrP'))
      break
    case 'time_series':
      add('N', get('n')); add('Time Points', get('timePoints')); add('Classifications', get('classifications'))
      break
    case 'pca':
      add('N', get('n')); add('Components', get('nComp') ?? get('p')); add('PC1 Var %', get('varExplained1')); add('PC2 Var %', get('varExplained2'))
      break
    case 'factor_analysis':
      add('N', get('n')); add('Factors', get('nFactors') ?? get('factors')); add('KMO', get('kmo')); add('Total Var %', get('variance') ?? get('totalVariance'))
      break
    case 'cluster_analysis':
      add('N', get('n')); add('Clusters', get('nClusters') ?? get('k')); add('Silhouette', get('avgSilhouette') ?? get('silhouette')); add('WCSS', get('wcss'))
      break
    case 'meta_analysis':
      add('Studies', get('k')); add('Effect Size', get('summaryES')); add('I²', get('I2') ?? get('i2')); add('p-value', get('pValue'))
      break
    case 'sample_size':
      add('Design', get('design')); add('N per Group', get('nPerGroup')); add('Total N', get('totalN') ?? get('finalN')); add('Power', get('power'))
      break
    default: {
      const keys = Object.keys(s).filter(k => k !== 'error').slice(0, 6)
      for (const k of keys) add(formatKey(k), get(k))
    }
  }

  return findings
}

export function formatKey(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim().replace(/^./, c => c.toUpperCase())
}
