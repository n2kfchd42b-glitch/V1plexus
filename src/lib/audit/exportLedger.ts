/**
 * Generates a human-readable research activity log from audit entries.
 * Used by the Timeline export and the Supervisor ledger export.
 */

const ANALYSIS_LABELS: Record<string, string> = {
  simple_regression:   'Linear Regression',
  multiple_regression: 'Multiple Regression',
  logistic_regression: 'Logistic Regression',
  multinomial:         'Multinomial Regression',
  ordinal:             'Ordinal Regression',
  poisson:             'Poisson Regression',
  t_test:              'T-Test',
  anova:               'ANOVA',
  chi_square:          'Chi-Square Test',
  correlation:         'Correlation',
  descriptive:         'Descriptive Statistics',
  frequency:           'Frequency Analysis',
  kaplan_meier:        'Kaplan-Meier',
  cox:                 'Cox Regression',
  pca:                 'PCA',
  factor_analysis:     'Factor Analysis',
  cluster:             'Cluster Analysis',
  meta_analysis:       'Meta-Analysis',
  time_series:         'Time Series',
  spatial:             'Spatial Analysis',
  sample_size:         'Sample Size Calculation',
  outbreak:            'Outbreak Analysis',
}

interface AuditEntry {
  id: string
  timestamp: string
  actor_id: string | null
  action: string
  resource_type: string
  details: Record<string, unknown> | null
  entry_hash: string | null
  project_chain_entry_hash: string | null
}

type BadgeColor = { bg: string; text: string }

function badge(action: string): { label: string; color: BadgeColor } {
  if (action.startsWith('analysis.')) return { label: 'Analysis', color: { bg: '#EFF6FF', text: '#1E40AF' } }
  if (action.startsWith('dataset.'))  return { label: 'Data',     color: { bg: '#F0FDF4', text: '#166534' } }
  if (action.startsWith('output.'))   return { label: 'Report',   color: { bg: '#FFF7ED', text: '#9A3412' } }
  if (action.startsWith('phase.') || action.startsWith('progress.')) return { label: 'Phase', color: { bg: '#ECFDF5', text: '#065F46' } }
  if (action.startsWith('project.'))  return { label: 'Project',  color: { bg: '#F5F3FF', text: '#5B21B6' } }
  if (action.includes('approval') || action.includes('approved')) return { label: 'Approval', color: { bg: '#FFFBEB', text: '#92400E' } }
  return { label: 'Event', color: { bg: '#F4F4F5', text: '#52525B' } }
}

function describeAction(action: string, d: Record<string, unknown>): string {
  if (action === 'analysis.run.saved' || action === 'analysis.run.completed' || action === 'analysis.run') {
    const at = d.analysis_type as string | undefined
    return ANALYSIS_LABELS[at ?? ''] ?? (at?.replace(/_/g, ' ') ?? 'Analysis run')
  }
  if (action === 'dataset.imported' || action === 'dataset.upload') return 'Dataset uploaded'
  if (action === 'dataset.version.committed' || action === 'dataset.version.created') return 'Dataset version saved'
  if (action === 'dataset.rows.dropped') return 'Rows removed from dataset'
  if (action === 'dataset.column.recoded') return 'Variable recoded'
  if (action === 'dataset.imputation.mice') return 'Missing data imputed (MICE)'
  if (action === 'dataset.duplicates.resolved') return 'Duplicate records resolved'
  if (action === 'dataset.approved') return 'Dataset approved'
  if (action === 'dataset.reentry.validated') return 'Double-entry validation passed'
  if (action === 'output.package.generated' || action === 'output.methods.generated') return 'Research record generated'
  if (action === 'output.checklist.generated') return 'Reporting checklist generated'
  if (action === 'phase.scheduled') return `Phase scheduled: ${(d.phase_label as string) ?? (d.phase as string) ?? ''}`
  if (action === 'phase.completed') return `Phase completed: ${(d.phase_label as string) ?? (d.phase as string) ?? ''}`
  if (action === 'phase.note' || action === 'progress.note') return 'Research note added'
  if (action === 'project.created') return 'Project created'
  if (action === 'project.updated') return 'Project updated'
  if (action === 'analysis.assumption.acknowledged') return 'Statistical assumption acknowledged'
  if (action === 'analysis.run.deleted') return 'Analysis run deleted'
  return action.replace(/\./g, ' › ')
}

function renderDetails(action: string, d: Record<string, unknown>): string {
  const lines: string[] = []
  const op = d.operation as Record<string, unknown> | undefined

  // Human summary
  if (d.summary && d.summary !== action) {
    lines.push(`<p class="summary">${esc(String(d.summary))}</p>`)
  }

  // Analysis variables
  if (action.startsWith('analysis.') && op) {
    const vars = op.variables as Record<string, unknown> | undefined
    if (vars) {
      const varLines: string[] = []
      if (vars.outcome)    varLines.push(`<span class="var-chip outcome">Outcome: ${esc(String(vars.outcome))}</span>`)
      if (vars.exposure)   varLines.push(`<span class="var-chip exposure">Exposure: ${esc(String(vars.exposure))}</span>`)
      const covs = vars.covariates
      if (covs) {
        const covList = Array.isArray(covs) ? covs.join(', ') : String(covs)
        if (covList) varLines.push(`<span class="var-chip covariate">Covariates: ${esc(covList)}</span>`)
      }
      if (vars.time)  varLines.push(`<span class="var-chip other">Time: ${esc(String(vars.time))}</span>`)
      if (vars.event) varLines.push(`<span class="var-chip other">Event: ${esc(String(vars.event))}</span>`)
      if (vars.group) varLines.push(`<span class="var-chip other">Group: ${esc(String(vars.group))}</span>`)
      if (varLines.length) lines.push(`<div class="var-chips">${varLines.join('')}</div>`)
    }
    // n_observations
    const n = (op.n_observations ?? (op.config as Record<string, unknown> | undefined)?.n) as number | undefined
    if (n) lines.push(`<p class="detail-row"><span class="label">Observations:</span> ${n.toLocaleString()}</p>`)
  }

  // Dataset operations
  if (action.startsWith('dataset.')) {
    const rb = d.rows_before as number | undefined
    const ra = d.rows_after as number | undefined
    if (rb != null && ra != null) {
      lines.push(`<p class="detail-row"><span class="label">Rows:</span> ${rb.toLocaleString()} → ${ra.toLocaleString()} (${ra - rb > 0 ? '+' : ''}${(ra - rb).toLocaleString()})</p>`)
    }
    const vb = d.version_before as number | undefined
    const va = d.version_after as number | undefined
    if (vb != null && va != null) {
      lines.push(`<p class="detail-row"><span class="label">Version:</span> v${vb} → v${va}</p>`)
    }
    if (op?.columns_imputed) {
      const cols = Array.isArray(op.columns_imputed) ? op.columns_imputed.join(', ') : String(op.columns_imputed)
      lines.push(`<p class="detail-row"><span class="label">Variables imputed:</span> ${esc(cols)}</p>`)
    }
    const colsAffected = d.columns_affected as string[] | undefined
    if (colsAffected?.length) {
      lines.push(`<p class="detail-row"><span class="label">Variables affected:</span> ${esc(colsAffected.join(', '))}</p>`)
    }
    if (op?.method) {
      lines.push(`<p class="detail-row"><span class="label">Method:</span> ${esc(String(op.method))}</p>`)
    }
  }

  // Researcher reasoning / justification
  const reasoning = (d.user_reasoning ?? d.justification) as string | undefined
  if (reasoning) {
    lines.push(`<blockquote class="reasoning">${esc(reasoning)}</blockquote>`)
  }

  // Phase note text
  if ((action === 'phase.note' || action === 'progress.note') && d.summary) {
    lines.push(`<blockquote class="reasoning">${esc(String(d.summary))}</blockquote>`)
  }

  return lines.join('\n')
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const HIDDEN = new Set(['auth.login', 'auth.logout', 'auth.password.changed', 'analysis.run.started', 'analysis.run.failed'])

export function buildResearchLogHtml(
  entries: AuditEntry[],
  meta: { projectId: string; subjectLabel: string; exportedAt: string },
): string {
  const visible = entries.filter(e => !HIDDEN.has(e.action) && !e.action.startsWith('auth.'))

  const cards = visible.map(e => {
    const d = (e.details ?? {}) as Record<string, unknown>
    const { label, color } = badge(e.action)
    const title = describeAction(e.action, d)
    const body  = renderDetails(e.action, d)
    const hash  = e.project_chain_entry_hash ?? e.entry_hash ?? ''
    const ts    = new Date(e.timestamp).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })

    return `
<div class="card">
  <div class="card-header">
    <span class="badge" style="background:${color.bg};color:${color.text}">${label}</span>
    <span class="card-title">${esc(title)}</span>
    <span class="ts">${ts}</span>
  </div>
  ${body ? `<div class="card-body">${body}</div>` : ''}
  <div class="card-footer">
    <span class="hash" title="Chain hash">#${hash.slice(0, 24)}…</span>
    ${e.project_chain_entry_hash ? '<span class="chained">⛓ chained</span>' : ''}
  </div>
</div>`
  }).join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Research Activity Log</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; background: #f9fafb; color: #111827; margin: 0; padding: 32px 24px; }
    .page { max-width: 820px; margin: 0 auto; }
    .page-header { margin-bottom: 32px; }
    h1 { font-size: 22px; font-weight: 700; margin: 0 0 4px; }
    .page-meta { font-size: 12px; color: #6b7280; margin: 0; }
    .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 12px; }
    .card-header { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 8px; }
    .badge { font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 4px; white-space: nowrap; }
    .card-title { font-size: 14px; font-weight: 600; flex: 1; }
    .ts { font-size: 11px; color: #9ca3af; white-space: nowrap; margin-left: auto; }
    .card-body { padding: 2px 0 8px; }
    .summary { font-size: 13px; color: #374151; margin: 0 0 8px; }
    .var-chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0 8px; }
    .var-chip { font-size: 11px; font-weight: 500; padding: 2px 8px; border-radius: 4px; }
    .var-chip.outcome   { background: #eff6ff; color: #1d4ed8; }
    .var-chip.exposure  { background: #fdf2f8; color: #9d174d; }
    .var-chip.covariate { background: #f0fdf4; color: #15803d; }
    .var-chip.other     { background: #f5f3ff; color: #6d28d9; }
    .detail-row { font-size: 12px; color: #4b5563; margin: 3px 0; }
    .label { font-weight: 600; }
    .reasoning { font-size: 12px; color: #374151; background: #f9fafb; border-left: 3px solid #d1d5db; margin: 8px 0 0; padding: 8px 12px; border-radius: 0 4px 4px 0; font-style: italic; }
    .card-footer { display: flex; align-items: center; gap: 10px; margin-top: 10px; padding-top: 8px; border-top: 1px solid #f3f4f6; }
    .hash { font-family: monospace; font-size: 10px; color: #9ca3af; }
    .chained { font-size: 10px; color: #16a34a; }
  </style>
</head>
<body>
<div class="page">
  <div class="page-header">
    <h1>Research Activity Log</h1>
    <p class="page-meta">${esc(meta.subjectLabel)} &nbsp;·&nbsp; ${visible.length} events &nbsp;·&nbsp; Exported ${new Date(meta.exportedAt).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}</p>
  </div>
  ${cards || '<p style="color:#6b7280;font-size:13px">No activity recorded yet.</p>'}
</div>
</body>
</html>`
}
