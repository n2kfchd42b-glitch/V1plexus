// UI-layer formatting for statistical output.
// Import only from this file in display components — never import analysis engine internals into the UI.

// ── Statistical key display names ─────────────────────────────────────────────

const KEY_MAP: Record<string, string> = {
  n:            'N',
  nobs:         'N',
  n_obs:        'N',
  nrow:         'N',
  cases:        'N',
  ncases:       'N',
  ntotal:       'N',
  r2:           'R²',
  rsquared:     'R²',
  r_squared:    'R²',
  adjr2:        'Adj. R²',
  adj_r2:       'Adj. R²',
  pvalue:       'P value',
  p_value:      'P value',
  p:            'P value',
  pval:         'P value',
  prob:         'P value',
  df:           'df',
  df1:          'df₁',
  df2:          'df₂',
  dferror:      'df (error)',
  fstat:        'F statistic',
  f_stat:       'F statistic',
  fvalue:       'F statistic',
  f:            'F statistic',
  tstat:        't statistic',
  t_stat:       't statistic',
  tvalue:       't statistic',
  chi2:         'χ²',
  chisq:        'χ²',
  chi_square:   'χ²',
  chi_sq:       'χ²',
  auc:          'AUC',
  mean:         'Mean',
  sd:           'SD',
  se:           'SE',
  sem:          'SE of mean',
  median:       'Median',
  iqr:          'IQR',
  hr:           'Hazard ratio',
  or:           'Odds ratio',
  irr:          'Rate ratio',
  rr:           'Risk ratio',
  rd:           'Risk difference',
  cramersv:     "Cramér's V",
  cramers_v:    "Cramér's V",
  effectsize:   'Effect size',
  effect_size:  'Effect size',
  cohensd:      "Cohen's d",
  cohens_d:     "Cohen's d",
  eta2:         'η²',
  eta_squared:  'η²',
  omega2:       'ω²',
  power:        'Power',
  alpha:        'α',
  beta:         'β (power)',
  tau2:         'τ²',
  i2:           'I²',
  aic:          'AIC',
  bic:          'BIC',
  loglik:       'Log-likelihood',
  rmse:         'RMSE',
  mae:          'MAE',
  sensitivity:  'Sensitivity',
  specificity:  'Specificity',
  ppv:          'PPV',
  npv:          'NPV',
  k:            'k (studies)',
  missing:      'Missing',
}

export function formatStatKey(key: string): string {
  const normalised = key.toLowerCase().replace(/[_\s-]/g, '')
  if (KEY_MAP[normalised]) return KEY_MAP[normalised]
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .trim()
    .replace(/^./, c => c.toUpperCase())
}

// ── P-value detection ──────────────────────────────────────────────────────────

export function isPValueKey(key: string): boolean {
  const k = key.toLowerCase().replace(/[_\s-]/g, '')
  return (
    k === 'p' ||
    k === 'pvalue' ||
    k === 'pval' ||
    k === 'prob' ||
    k.startsWith('p(') ||
    (k.startsWith('p') && k.endsWith('value'))
  )
}

// ── Significance markers ───────────────────────────────────────────────────────

export function isSigMarker(val: string): boolean {
  return /^[*†]+$/.test(val.trim())
}

export function sigMarkerClass(marker: string): string {
  const m = marker.trim()
  if (m === '***' || m === '**') return 'text-[var(--accent-primary)] font-bold tabular-nums'
  if (m === '*')                  return 'text-[var(--accent-blue)] font-semibold tabular-nums'
  if (m === '†')                  return 'text-[var(--text-tertiary)] tabular-nums'
  return ''
}

// ── P-value formatting ────────────────────────────────────────────────────────

export function formatPValue(p: number | null | undefined): string {
  if (p === null || p === undefined || isNaN(p as number)) return '—'
  if (p < 0.001) return '<0.001'
  return (p as number).toFixed(3)
}

export function pValueBadge(key: string, val: unknown): { label: string; sig: string } | null {
  if (!isPValueKey(key)) return null
  const num = Number(val)
  if (isNaN(num)) return null
  if (num < 0.001) return { label: '<0.001', sig: '***' }
  if (num < 0.01)  return { label: num.toFixed(3), sig: '**' }
  if (num < 0.05)  return { label: num.toFixed(3), sig: '*' }
  if (num < 0.10)  return { label: num.toFixed(3), sig: '†' }
  return { label: num.toFixed(3), sig: 'ns' }
}

// ── Number formatting ──────────────────────────────────────────────────────────

export function formatStatValue(val: unknown, decimals = 3): string {
  if (val === null || val === undefined) return '—'
  if (typeof val === 'number') {
    if (!isFinite(val)) return '—'
    if (Number.isInteger(val) && Math.abs(val) >= 1) return val.toLocaleString()
    if (Math.abs(val) < 0.0001 && val !== 0) return val.toExponential(2)
    return val.toFixed(decimals)
  }
  return String(val)
}

// ── Standard footnote builders ────────────────────────────────────────────────

export const SIG_FOOTNOTE = '*** p<0.001  ** p<0.01  * p<0.05  † p<0.10'

export function buildFootnote(parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join('  ·  ')
}
