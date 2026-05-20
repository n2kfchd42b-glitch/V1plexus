import type { AuditLog } from '@/types/database'

// ── Actions hidden from the researcher timeline ────────────────────────────
const HIDDEN_ACTIONS = new Set([
  'auth.login',
  'auth.logout',
  'auth.password.changed',
  'analysis.run.started',
  'analysis.run.failed',
])

export function isVisible(action: string): boolean {
  if (HIDDEN_ACTIONS.has(action)) return false
  // Hide auth prefix entirely
  if (action.startsWith('auth.')) return false
  return true
}

// ── Pretty labels ──────────────────────────────────────────────────────────

const ANALYSIS_TYPE_LABELS: Record<string, string> = {
  simple_regression:    'Linear Regression',
  multiple_regression:  'Multiple Regression',
  logistic_regression:  'Logistic Regression',
  multinomial:          'Multinomial Regression',
  ordinal:              'Ordinal Regression',
  poisson:              'Poisson Regression',
  t_test:               'T-Test',
  anova:                'ANOVA',
  chi_square:           'Chi-Square Test',
  correlation:          'Correlation',
  descriptive:          'Descriptive Statistics',
  frequency:            'Frequency Analysis',
  kaplan_meier:         'Kaplan-Meier',
  cox:                  'Cox Regression',
  pca:                  'PCA',
  factor_analysis:      'Factor Analysis',
  cluster:              'Cluster Analysis',
  meta_analysis:        'Meta-Analysis',
  time_series:          'Time Series',
  spatial:              'Spatial Analysis',
  sample_size:          'Sample Size Calculation',
  outbreak:             'Outbreak Analysis',
}

export interface TimelineEntryMeta {
  typeLabel: string   // short badge text  e.g. "Analysis"
  title: string       // main description  e.g. "Logistic Regression run"
  subtitle: string    // secondary line    e.g. "ghana_survey_v3.csv"
}

export function describeEntry(log: AuditLog): TimelineEntryMeta {
  const d = log.details ?? {}
  const action = log.action

  // Dataset events
  if (action === 'dataset.imported' || action === 'dataset.upload') {
    return {
      typeLabel: 'Data',
      title: 'Dataset uploaded',
      subtitle: (d.filename as string) || (d.name as string) || log.resource_type,
    }
  }
  if (action === 'dataset.version.committed' || action === 'dataset.version.created') {
    const vb = d.version_before as number | undefined
    const va = d.version_after as number | undefined
    return {
      typeLabel: 'Data',
      title: 'Dataset version saved',
      subtitle: vb != null && va != null ? `v${vb} → v${va}` : (d.summary as string) || '',
    }
  }
  if (action === 'dataset.rows.dropped') {
    const rb = d.rows_before as number | undefined
    const ra = d.rows_after as number | undefined
    return {
      typeLabel: 'Data',
      title: 'Rows removed',
      subtitle: rb != null && ra != null ? `${rb} → ${ra} rows` : (d.summary as string) || '',
    }
  }
  if (action === 'dataset.column.recoded') {
    const cols = d.columns_affected as string[] | undefined
    return {
      typeLabel: 'Data',
      title: 'Variable recoded',
      subtitle: cols?.join(', ') || (d.summary as string) || '',
    }
  }
  if (action === 'dataset.imputation.mice') {
    return {
      typeLabel: 'Data',
      title: 'Missing data imputed (MICE)',
      subtitle: (d.summary as string) || '',
    }
  }
  if (action === 'dataset.duplicates.resolved') {
    return {
      typeLabel: 'Data',
      title: 'Duplicates resolved',
      subtitle: (d.summary as string) || '',
    }
  }
  if (action === 'dataset.approved') {
    return { typeLabel: 'Data', title: 'Dataset approved', subtitle: (d.summary as string) || '' }
  }
  if (action === 'dataset.reentry.validated') {
    return { typeLabel: 'Data', title: 'Double-entry validated', subtitle: (d.summary as string) || '' }
  }
  if (action.startsWith('dataset.')) {
    return {
      typeLabel: 'Data',
      title: action.replace('dataset.', '').replace(/\./g, ' ').replace(/_/g, ' '),
      subtitle: (d.summary as string) || '',
    }
  }

  // Analysis events
  if (action === 'analysis.run.completed' || action === 'analysis.run.saved' || action === 'analysis.run') {
    const at = (d.analysis_type as string) ?? ''
    return {
      typeLabel: 'Analysis',
      title: ANALYSIS_TYPE_LABELS[at] ?? at.replace(/_/g, ' ') ?? 'Analysis run',
      subtitle: (d.dataset_name as string) || (d.summary as string) || '',
    }
  }
  if (action === 'analysis.assumption.acknowledged') {
    return { typeLabel: 'Analysis', title: 'Assumption acknowledged', subtitle: (d.summary as string) || '' }
  }
  if (action.startsWith('analysis.')) {
    return {
      typeLabel: 'Analysis',
      title: action.replace('analysis.', '').replace(/\./g, ' ').replace(/_/g, ' '),
      subtitle: (d.summary as string) || '',
    }
  }

  // Output events
  if (action === 'output.package.generated' || action === 'output.methods.generated') {
    return { typeLabel: 'Report', title: 'Research record generated', subtitle: (d.summary as string) || '' }
  }
  if (action === 'output.checklist.generated') {
    return { typeLabel: 'Report', title: 'Reporting checklist generated', subtitle: (d.summary as string) || '' }
  }
  if (action.startsWith('output.')) {
    return { typeLabel: 'Report', title: action.replace('output.', '').replace(/\./g, ' '), subtitle: '' }
  }

  // Phase schedule events (from PhaseRoadmap — researcher-set dates and notes)
  if (action === 'phase.scheduled') {
    const label = (d.phase_label as string) || (d.phase as string) || ''
    const start = d.start_date as string | null
    const end   = d.end_date   as string | null
    return {
      typeLabel: 'Phase',
      title:     `${label} scheduled`,
      subtitle:  start && end ? `${start} → ${end}` : (d.summary as string) || '',
    }
  }
  if (action === 'phase.completed') {
    const label = (d.phase_label as string) || (d.phase as string) || ''
    return { typeLabel: 'Phase', title: `${label} marked complete`, subtitle: '' }
  }
  if (action === 'phase.reopened') {
    const label = (d.phase_label as string) || (d.phase as string) || ''
    return { typeLabel: 'Phase', title: `${label} reopened`, subtitle: '' }
  }
  if (action === 'phase.note' || action === 'progress.note') {
    const label = (d.phase_label as string) || (d.phase as string) || ''
    const text  = (d.summary as string) || ''
    return {
      typeLabel: 'Note',
      title:     label ? `Note — ${label}` : 'Research note',
      subtitle:  text.length > 80 ? text.slice(0, 80) + '…' : text,
    }
  }

  // Project events
  if (action === 'project.created') {
    return { typeLabel: 'Project', title: 'Project created', subtitle: (d.summary as string) || '' }
  }
  if (action === 'project.updated') {
    return { typeLabel: 'Project', title: 'Project updated', subtitle: (d.summary as string) || '' }
  }
  if (action.startsWith('project.')) {
    return {
      typeLabel: 'Project',
      title: action.replace('project.', '').replace(/\./g, ' ').replace(/_/g, ' '),
      subtitle: (d.summary as string) || '',
    }
  }

  // Fallback
  return {
    typeLabel: log.resource_type?.replace(/_/g, ' ') ?? 'Event',
    title: action.replace(/\./g, ' ').replace(/_/g, ' '),
    subtitle: (d.summary as string) || '',
  }
}

// ── Badge colours ──────────────────────────────────────────────────────────

export function typeBadgeClass(typeLabel: string): string {
  switch (typeLabel) {
    case 'Analysis': return 'bg-[#EFF6FF] text-[#1E40AF]'
    case 'Data':     return 'bg-[#F0FDF4] text-[#166534]'
    case 'Report':   return 'bg-[#FFF7ED] text-[#9A3412]'
    case 'Project':  return 'bg-[#F5F3FF] text-[#5B21B6]'
    case 'Phase':    return 'bg-[#ECFDF5] text-[#065F46]'
    case 'Note':     return 'bg-[#FFFBEB] text-[#92400E]'
    default:         return 'bg-[#F4F4F5] text-[#52525B]'
  }
}

// ── Group entries by calendar day ──────────────────────────────────────────

export interface DayGroup {
  label: string      // "April 10, 2026"
  isoDate: string    // "2026-04-10"
  entries: AuditLog[]
}

export function groupByDay(entries: AuditLog[]): DayGroup[] {
  const map = new Map<string, AuditLog[]>()

  for (const e of entries) {
    const d = new Date(e.timestamp)
    const iso = d.toISOString().slice(0, 10)
    if (!map.has(iso)) map.set(iso, [])
    map.get(iso)!.push(e)
  }

  const today     = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

  return Array.from(map.entries()).map(([iso, entries]) => {
    let label: string
    if (iso === today)     label = 'Today'
    else if (iso === yesterday) label = 'Yesterday'
    else label = new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    })
    return { label, isoDate: iso, entries }
  })
}

// ── Format time  ───────────────────────────────────────────────────────────

export function fmtTime(ts: string): string {
  return new Date(ts).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
}
