import type { AnalysisResult } from './analysis/types'
import type { AnalysisType } from '@/types/database'

// ─── Variable data shapes (Table 1) ──────────────────────────────────────────

export interface ContVar {
  name: string
  n: number
  missing: number
  mean: string
  sd: string
  median: string
  iqr: string
  type: 'continuous'
}

export interface CatVar {
  name: string
  n: number
  missing: number
  categories: { label: string; count: number; pct: string }[]
  type: 'categorical'
}

export type TableVar = ContVar | CatVar

export type FormatOption = 'mean_sd' | 'median_iqr'

// ─── Regression (Table 2) ─────────────────────────────────────────────────────

export interface RegressionRow {
  variable: string
  crude?: string   // "1.23 (1.05–1.45)"
  crude_p?: string
  adj?: string     // "1.18 (1.02–1.37)"
  adj_p?: string
  sig: string
}

// ─── Survival (Table 3) ──────────────────────────────────────────────────────

export interface SurvivalSummaryRow {
  group?: string
  n: number
  events: number
  eventPct: string
  medianSurvival: string
  ci: string
}

// ─── Stratified column (for multi-run Table 1) ───────────────────────────────

export interface StratifiedColumn {
  label: string
  n: number
  variables: TableVar[]
}

// ─── Spec types ───────────────────────────────────────────────────────────────

export interface Table1Spec {
  specType: 'table1'
  title: string
  footnote: string
  format: FormatOption
  // Simple (single run)
  totalN?: number
  variables?: TableVar[]
  // Stratified (multi-run)
  stratified?: boolean
  columns?: StratifiedColumn[]
}

export interface Table2Spec {
  specType: 'table2'
  title: string
  effectLabel: string
  footnote: string
  rows: RegressionRow[]
  showCrude: boolean
  showAdjusted: boolean
}

export interface Table3Spec {
  specType: 'table3'
  title: string
  footnote: string
  rows: SurvivalSummaryRow[]
  timeUnit: string
  eventLabel: string
}

// Legacy format (no specType) — existing saved tables
export interface LegacyTableSpec {
  specType?: undefined
  title: string
  totalN: number
  footnote: string
  variables: TableVar[]
  format: FormatOption
}

export type GeneratedTableSpec = Table1Spec | Table2Spec | Table3Spec
export type AnyTableSpec = GeneratedTableSpec | LegacyTableSpec

// ─── Analysis type categories ─────────────────────────────────────────────────

export const REGRESSION_TYPES = new Set<AnalysisType>([
  'simple_regression', 'multiple_regression', 'logistic_regression',
  'multinomial_regression', 'ordinal_regression', 'poisson_regression',
  'negbinomial_regression', 'cox_regression',
])

export const SURVIVAL_TYPES = new Set<AnalysisType>([
  'kaplan_meier', 'cox_regression',
])

export function getTableTemplate(type: AnalysisType): 'table1' | 'table2' | 'table3' | 'generic' {
  if (type === 'descriptive') return 'table1'
  if (REGRESSION_TYPES.has(type)) return 'table2'
  if (type === 'kaplan_meier') return 'table3'
  return 'generic'
}

// ─── Parse descriptive result (Table 1) ──────────────────────────────────────

export function parseDescriptiveResult(result: AnalysisResult): {
  continuous: ContVar[]
  categorical: CatVar[]
  totalN: number
} {
  const continuous: ContVar[] = []
  const categorical: CatVar[] = []
  const totalN = (result.summary?.n as number) ?? 0

  const numericTable = result.tables.find(t => t.id === 'numeric_summary')
  if (numericTable) {
    const seenContNames = new Set<string>()
    for (const row of numericTable.rows) {
      const contName = String(row[0] ?? '').trim()
      if (!contName || seenContNames.has(contName)) continue
      seenContNames.add(contName)
      continuous.push({
        name: contName,
        n: Number(row[1] ?? 0),
        missing: Number(row[2] ?? 0),
        mean: String(row[3] ?? ''),
        sd: String(row[4] ?? ''),
        median: String(row[5] ?? ''),
        iqr: String(row[6] ?? ''),
        type: 'continuous',
      })
    }
  }

  const catTable = result.tables.find(t => t.id === 'categorical_summary')
  if (catTable) {
    const seenCatNames = new Set<string>()
    for (const row of catTable.rows) {
      const varName = String(row[0] ?? '').trim()
      if (!varName || seenCatNames.has(varName)) continue
      seenCatNames.add(varName)
      const n = Number(row[1] ?? 0)
      const missing = Number(row[2] ?? 0)

      const barChart = result.charts.find(
        c => (c as { type: string; title: string }).title === `Frequency: ${varName}`
      ) as { data: { value: string | number; count: number; percent: string | number }[] } | undefined

      let categories: { label: string; count: number; pct: string }[] = []
      if (barChart && Array.isArray(barChart.data)) {
        categories = barChart.data.map(d => ({
          label: String(d.value),
          count: Number(d.count),
          pct: String(d.percent),
        }))
      }

      categorical.push({ name: varName, n, missing, categories, type: 'categorical' })
    }
  }

  return { continuous, categorical, totalN }
}

// ─── Parse regression result (Table 2) ───────────────────────────────────────

export function parseRegressionResult(result: AnalysisResult): {
  rows: RegressionRow[]
  effectLabel: string
  hasCrude: boolean
  hasAdjusted: boolean
} {
  // Primary table: 'results' has crude/adjusted columns (logistic, cox, poisson, negbinomial)
  // Fallback: 'coefs' table has β coefficients (linear regression)
  const resultsTable =
    result.tables.find(t => t.id === 'results') ??
    result.tables.find(t => t.id === 'coefs' || t.id === 'coefficients') ??
    result.tables.find(t => !t.advanced && t.rows.length > 0)

  if (!resultsTable) return { rows: [], effectLabel: 'Estimate', hasCrude: false, hasAdjusted: false }

  const headers = resultsTable.headers

  // Detect effect label from header text
  let effectLabel = 'Estimate'
  if (headers.some(h => h.includes('OR'))) effectLabel = 'OR'
  else if (headers.some(h => h.includes('HR'))) effectLabel = 'HR'
  else if (headers.some(h => h.includes('IRR'))) effectLabel = 'IRR'
  else if (headers.some(h => h === 'B' || h === 'β' || h === 'b')) effectLabel = 'β'

  const hasCrude = headers.some(h => /crude/i.test(h))
  const hasAdjusted = headers.some(h => /adj/i.test(h))

  const sigIdx = headers.length - 1  // Sig is always last

  let rows: RegressionRow[]

  if (hasCrude || hasAdjusted) {
    // Format: ['Variable', 'Crude X (95% CI)', 'p', 'Adjusted X (95% CI)', 'p', 'Sig']
    rows = resultsTable.rows.map(row => ({
      variable: String(row[0] ?? ''),
      crude: hasCrude ? String(row[1] ?? '') : undefined,
      crude_p: hasCrude ? String(row[2] ?? '') : undefined,
      adj: hasAdjusted ? String(row[hasCrude ? 3 : 1] ?? '') : undefined,
      adj_p: hasAdjusted ? String(row[hasCrude ? 4 : 2] ?? '') : undefined,
      sig: String(row[sigIdx] ?? ''),
    }))
  } else {
    // Linear regression: ['', 'B', 'SE', 't', 'p-value', '95% CI', 'Sig']
    const bIdx = headers.findIndex(h => h === 'B' || h === 'β' || h === 'b')
    const pIdx = headers.findIndex(h => /p-value|p value|p$/i.test(h))
    const ciIdx = headers.findIndex(h => /\d+%\s*ci|ci$/i.test(h))

    rows = resultsTable.rows.map(row => {
      const bVal = bIdx >= 1 ? String(row[bIdx] ?? '') : ''
      const ciVal = ciIdx >= 1 ? ` ${String(row[ciIdx] ?? '')}` : ''
      return {
        variable: String(row[0] ?? ''),
        adj: `${bVal}${ciVal}`.trim(),
        adj_p: pIdx >= 1 ? String(row[pIdx] ?? '') : undefined,
        sig: String(row[sigIdx] ?? ''),
      }
    })
    return { rows, effectLabel: effectLabel === 'Estimate' ? 'β' : effectLabel, hasCrude: false, hasAdjusted: false }
  }

  return { rows, effectLabel, hasCrude, hasAdjusted }
}

// ─── Parse survival result (Table 3) ─────────────────────────────────────────

export function parseSurvivalResult(result: AnalysisResult): {
  rows: SurvivalSummaryRow[]
  timeUnit: string
  eventLabel: string
} {
  const summary = result.summary as Record<string, unknown>

  // Try to find a summary table
  const summaryTable = result.tables.find(t =>
    t.id === 'survival_summary' || t.id === 'km_summary' || t.id === 'group_summary'
  )

  if (summaryTable) {
    const rows: SurvivalSummaryRow[] = summaryTable.rows.map(row => ({
      group: String(row[0] ?? ''),
      n: Number(row[1] ?? 0),
      events: Number(row[2] ?? 0),
      eventPct: String(row[3] ?? '—'),
      medianSurvival: String(row[4] ?? 'NR'),
      ci: String(row[5] ?? '—'),
    }))
    return {
      rows,
      timeUnit: String(summary.timeUnit ?? 'months'),
      eventLabel: String(summary.eventLabel ?? 'Event'),
    }
  }

  // Fallback: build from summary object
  const n = Number(summary.n ?? 0)
  const events = Number(summary.events ?? 0)
  return {
    rows: [{
      n,
      events,
      eventPct: n > 0 ? `${((events / n) * 100).toFixed(1)}%` : '—',
      medianSurvival: summary.medianSurvival != null ? String(summary.medianSurvival) : 'NR',
      ci: '—',
    }],
    timeUnit: String(summary.timeUnit ?? 'months'),
    eventLabel: String(summary.eventLabel ?? 'Event'),
  }
}

// ─── Format helpers ───────────────────────────────────────────────────────────

export function formatContValue(v: ContVar, format: FormatOption): string {
  if (format === 'mean_sd') return `${v.mean} (${v.sd})`
  return `${v.median} [${v.iqr}]`
}

export function generateFootnote(
  hasContinuous: boolean,
  format: FormatOption,
  hasCategorical: boolean,
): string {
  const parts: string[] = []
  if (hasContinuous) parts.push(format === 'mean_sd' ? 'Mean (SD)' : 'Median [IQR]')
  if (hasCategorical) parts.push('n (%)')
  return parts.join('; ')
}

// ─── Auto table numbering ─────────────────────────────────────────────────────

export async function getNextTableNumber(
  projectId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
): Promise<number> {
  const { data } = await supabase
    .from('documents')
    .select('title')
    .eq('project_id', projectId)
    .ilike('title', 'Table %')

  const nums = ((data as { title: string }[]) ?? []).flatMap(d => {
    const m = d.title.match(/^Table\s+(\d+)/i)
    return m ? [parseInt(m[1], 10)] : []
  })

  return nums.length > 0 ? Math.max(...nums) + 1 : 1
}

// ─── Convert spec → TipTap-native table JSON ─────────────────────────────────

function cell(text: string, isHeader = false): Record<string, unknown> {
  const type = isHeader ? 'tableHeader' : 'tableCell'
  return {
    type,
    attrs: { colspan: 1, rowspan: 1, colwidth: null },
    content: [{ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] }],
  }
}

function headerRow(headers: string[]): Record<string, unknown> {
  return { type: 'tableRow', content: headers.map(h => cell(h, true)) }
}

function dataRow(cells: string[]): Record<string, unknown> {
  return { type: 'tableRow', content: cells.map(c => cell(c)) }
}

export function specToTipTapNodes(spec: AnyTableSpec): Record<string, unknown>[] {
  const nodes: Record<string, unknown>[] = []

  // Title paragraph (bold)
  if (spec.title) {
    nodes.push({
      type: 'paragraph',
      content: [{ type: 'text', marks: [{ type: 'bold' }], text: spec.title }],
    })
  }

  const rows: Record<string, unknown>[] = []

  if (!spec.specType || spec.specType === 'table1') {
    // Table 1: baseline characteristics
    const s = spec as Table1Spec | LegacyTableSpec
    const format = s.format ?? 'mean_sd'
    const totalN = s.totalN ?? 0

    if ('stratified' in s && s.stratified && 'columns' in s && s.columns && s.columns.length > 0) {
      const cols = s.columns as StratifiedColumn[]
      const headers = ['Variable', ...cols.map(c => `${c.label} (N=${c.n})`)]
      rows.push(headerRow(headers))
      cols[0]?.variables.forEach(v => {
        if (v.type === 'continuous') {
          const rowCells = [v.name, ...cols.map(c => {
            const found = c.variables.find(cv => cv.name === v.name && cv.type === 'continuous') as ContVar | undefined
            return found ? formatContValue(found, format) : '—'
          })]
          rows.push(dataRow(rowCells))
        } else {
          const cv = v as CatVar
          rows.push(dataRow([cv.name, ...cols.map(() => '')]))
          cv.categories.forEach(cat => {
            const catCells = [` ${cat.label}`, ...cols.map(c => {
              const found = c.variables.find(cv2 => cv2.name === cv.name && cv2.type === 'categorical') as CatVar | undefined
              const fc = found?.categories.find(cc => cc.label === cat.label)
              return fc ? `${fc.count} (${fc.pct}%)` : '—'
            })]
            rows.push(dataRow(catCells))
          })
        }
      })
    } else {
      const variables = (s as { variables?: TableVar[] }).variables ?? []
      rows.push(headerRow(['Variable', `Total (N=${totalN})`]))
      variables.forEach(v => {
        if (v.type === 'continuous') {
          rows.push(dataRow([v.name, formatContValue(v as ContVar, format)]))
        } else {
          const cv = v as CatVar
          rows.push(dataRow([cv.name, '']))
          cv.categories.forEach(cat => {
            rows.push(dataRow([` ${cat.label}`, `${cat.count} (${cat.pct}%)`]))
          })
        }
      })
    }
  } else if (spec.specType === 'table2') {
    const s = spec as Table2Spec
    const headers = ['Variable']
    if (s.showCrude) headers.push(`Crude ${s.effectLabel}`, 'P value')
    if (s.showAdjusted) headers.push(`Adj. ${s.effectLabel}`, 'P value')
    rows.push(headerRow(headers))
    s.rows.forEach(r => {
      if (!r.variable) return
      const cells: string[] = [r.variable]
      if (s.showCrude) cells.push(r.crude ?? '—', r.crude_p ?? '—')
      if (s.showAdjusted) cells.push(r.adj ?? '—', r.adj_p ?? '—')
      rows.push(dataRow(cells))
    })
  } else if (spec.specType === 'table3') {
    const s = spec as Table3Spec
    rows.push(headerRow(['Group', 'N', 'Events', `Median survival (${s.timeUnit})`, '95% CI']))
    s.rows.forEach(r => {
      rows.push(dataRow([r.group ?? '—', String(r.n), `${r.events} (${r.eventPct}%)`, r.medianSurvival, r.ci]))
    })
  }

  if (rows.length > 0) {
    nodes.push({ type: 'table', content: rows })
  }

  // Footnote
  if (spec.footnote) {
    nodes.push({
      type: 'paragraph',
      content: [{ type: 'text', marks: [{ type: 'italic' }], text: spec.footnote }],
    })
  }

  return nodes
}

// ─── Insert table into existing document ─────────────────────────────────────

export async function insertTableIntoDocument(
  documentId: string,
  spec: AnyTableSpec,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
): Promise<void> {
  const { data: doc, error: fetchErr } = await supabase
    .from('documents')
    .select('content, word_count')
    .eq('id', documentId)
    .single()

  if (fetchErr || !doc) throw new Error(fetchErr?.message ?? 'Document not found')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing = (doc.content as any) ?? { type: 'doc', content: [] }
  const newNodes = specToTipTapNodes(spec)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const content = Array.isArray((existing as any).content)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? { ...existing, content: [...(existing as any).content, ...newNodes] }
    : { type: 'doc', content: newNodes }

  const { error: updateErr } = await supabase
    .from('documents')
    .update({ content, updated_at: new Date().toISOString() })
    .eq('id', documentId)

  if (updateErr) throw new Error(updateErr.message)
}
