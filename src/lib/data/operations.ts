import type { CleaningOperation, DataRow, FilterOperator, ColumnSchema } from '@/types/database'
import { computeColumnSchema } from './parser'

// ─── Apply a single cleaning operation to rows ────────────────────────────────

export function applyOperation(rows: DataRow[], columns: ColumnSchema[], op: CleaningOperation): {
  rows: DataRow[]
  columns: ColumnSchema[]
  affected_rows: number
} {
  let newRows = [...rows]
  let newColumns = [...columns]

  switch (op.type) {
    case 'rename_column': {
      newColumns = columns.map(c => c.name === op.column ? { ...c, name: op.new_name } : c)
      newRows = rows.map(r => {
        const newRow = { ...r }
        newRow[op.new_name] = newRow[op.column]
        delete newRow[op.column]
        return newRow
      })
      return { rows: newRows, columns: newColumns, affected_rows: rows.length }
    }

    case 'retype_column': {
      newColumns = columns.map(c => c.name === op.column ? { ...c, type: op.new_type } : c)
      newRows = rows.map(r => ({
        ...r,
        [op.column]: coerceValue(r[op.column], op.new_type),
      }))
      return { rows: newRows, columns: newColumns, affected_rows: rows.length }
    }

    case 'delete_column': {
      newColumns = columns.filter(c => c.name !== op.column)
      newRows = rows.map(r => {
        const newRow = { ...r }
        delete newRow[op.column]
        return newRow
      })
      return { rows: newRows, columns: newColumns, affected_rows: rows.length }
    }

    case 'reorder_columns': {
      newColumns = op.order.map(name => columns.find(c => c.name === name)!).filter(Boolean)
      return { rows, columns: newColumns, affected_rows: 0 }
    }

    case 'drop_missing': {
      const before = rows.length
      newRows = rows.filter(r => {
        return op.columns.every(col => r[col] !== null && r[col] !== undefined && r[col] !== '')
      })
      return { rows: newRows, columns, affected_rows: before - newRows.length }
    }

    case 'fill_missing': {
      let fillValue: string | number | boolean | null = op.value ?? null
      if (op.strategy !== 'value') {
        const values = rows.map(r => r[op.column]).filter(v => v !== null && v !== undefined) as number[]
        if (op.strategy === 'mean' && values.length > 0) {
          fillValue = values.reduce((a, b) => Number(a) + Number(b), 0) / values.length
        } else if (op.strategy === 'median' && values.length > 0) {
          const sorted = [...values].sort((a, b) => Number(a) - Number(b))
          const mid = Math.floor(sorted.length / 2)
          fillValue = sorted.length % 2 === 0 ? (Number(sorted[mid - 1]) + Number(sorted[mid])) / 2 : Number(sorted[mid])
        } else if (op.strategy === 'mode') {
          const counts: Record<string, number> = {}
          rows.forEach(r => {
            if (r[op.column] !== null) {
              const k = String(r[op.column])
              counts[k] = (counts[k] || 0) + 1
            }
          })
          let maxCount = 0
          for (const [k, c] of Object.entries(counts)) {
            if (c > maxCount) { maxCount = c; fillValue = k }
          }
        } else if (op.strategy === 'forward_fill') {
          let last: string | number | boolean | null = null
          newRows = rows.map(r => {
            if (r[op.column] !== null && r[op.column] !== undefined) {
              last = r[op.column]
              return r
            }
            return { ...r, [op.column]: last }
          })
          const count = rows.filter(r => r[op.column] === null).length
          return { rows: newRows, columns, affected_rows: count }
        } else if (op.strategy === 'backward_fill') {
          let last: string | number | boolean | null = null
          newRows = [...rows].reverse().map(r => {
            if (r[op.column] !== null && r[op.column] !== undefined) {
              last = r[op.column]
              return r
            }
            return { ...r, [op.column]: last }
          }).reverse()
          const count = rows.filter(r => r[op.column] === null).length
          return { rows: newRows, columns, affected_rows: count }
        }
      }

      let affected = 0
      newRows = rows.map(r => {
        if (r[op.column] === null || r[op.column] === undefined || r[op.column] === '') {
          affected++
          return { ...r, [op.column]: fillValue }
        }
        return r
      })
      return { rows: newRows, columns, affected_rows: affected }
    }

    case 'filter_rows': {
      const before = rows.length
      if (op.keep) {
        newRows = rows.filter(r => testCondition(r[op.column], op.operator, op.value))
      } else {
        newRows = rows.filter(r => !testCondition(r[op.column], op.operator, op.value))
      }
      return { rows: newRows, columns, affected_rows: before - newRows.length }
    }

    case 'remove_duplicates': {
      const before = rows.length
      const seen = new Set<string>()
      newRows = rows.filter(r => {
        const key = op.columns.map(c => String(r[c])).join('__')
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      return { rows: newRows, columns, affected_rows: before - newRows.length }
    }

    case 'sort_rows': {
      newRows = [...rows].sort((a, b) => {
        const va = a[op.column]
        const vb = b[op.column]
        if (va === null) return 1
        if (vb === null) return -1
        if (typeof va === 'number' && typeof vb === 'number') {
          return op.direction === 'asc' ? va - vb : vb - va
        }
        const sa = String(va)
        const sb = String(vb)
        return op.direction === 'asc' ? sa.localeCompare(sb) : sb.localeCompare(sa)
      })
      return { rows: newRows, columns, affected_rows: 0 }
    }

    case 'computed_column': {
      try {
        newRows = rows.map(r => ({
          ...r,
          [op.name]: evalFormula(op.formula, r),
        }))
        const values = newRows.map(r => r[op.name])
        const newCol = computeColumnSchema(op.name, values)
        newColumns = [...columns, { ...newCol, type: op.column_type }]
      } catch {
        return { rows, columns, affected_rows: 0 }
      }
      return { rows: newRows, columns: newColumns, affected_rows: rows.length }
    }

    case 'recode_values': {
      let affected = 0
      const targetCol = op.output_column?.trim() || op.column
      const isNewCol = targetCol !== op.column
      newRows = rows.map(r => {
        const k = String(r[op.column])
        if (k in op.mapping) {
          affected++
          return { ...r, [targetCol]: op.mapping[k] }
        }
        return isNewCol ? { ...r, [targetCol]: r[op.column] } : r
      })
      if (isNewCol) {
        const vals = newRows.map(r => r[targetCol])
        newColumns = [...columns, computeColumnSchema(targetCol, vals)]
      }
      return { rows: newRows, columns: newColumns, affected_rows: affected }
    }

    case 'bin_numeric': {
      const newColSchema = computeColumnSchema(op.new_column, [])
      newColumns = [...columns, { ...newColSchema, type: 'categorical' as const }]
      newRows = rows.map(r => {
        const v = Number(r[op.column])
        let label: string | null = null
        for (const bin of op.bins) {
          const aboveMin = bin.min === null || v >= bin.min
          const belowMax = bin.max === null || v < bin.max
          if (aboveMin && belowMax) { label = bin.label; break }
        }
        return { ...r, [op.new_column]: label }
      })
      return { rows: newRows, columns: newColumns, affected_rows: rows.length }
    }

    case 'split_column': {
      const parts_count = op.new_columns.length
      newRows = rows.map(r => {
        const val = r[op.column] === null ? '' : String(r[op.column])
        const parts = val.split(op.delimiter)
        const newRow = { ...r }
        op.new_columns.forEach((name, i) => {
          newRow[name] = parts[i]?.trim() ?? null
        })
        if (!op.keep_original) delete newRow[op.column]
        return newRow
      })
      const newColSchemas = op.new_columns.map(name =>
        computeColumnSchema(name, newRows.map(r => r[name]))
      )
      newColumns = op.keep_original
        ? [...columns, ...newColSchemas]
        : [...columns.filter(c => c.name !== op.column), ...newColSchemas]
      return { rows: newRows, columns: newColumns, affected_rows: rows.length }
    }

    case 'replace_column': {
      const targetCol = op.new_column?.trim() || op.column
      const isNewCol = targetCol !== op.column
      newRows = rows.map(r => ({ ...r, [targetCol]: op.replace_value }))
      if (isNewCol) {
        newColumns = [...columns, computeColumnSchema(targetCol, newRows.map(r => r[targetCol]))]
      }
      return { rows: newRows, columns: newColumns, affected_rows: rows.length }
    }

    case 'standardize_text': {
      let affected = 0
      newRows = rows.map(r => {
        if (r[op.column] === null) return r
        let v = String(r[op.column])
        const original = v
        if (op.operations.includes('trim')) v = v.trim()
        if (op.operations.includes('lowercase')) v = v.toLowerCase()
        if (op.operations.includes('uppercase')) v = v.toUpperCase()
        if (op.operations.includes('titlecase')) v = v.replace(/\b\w/g, l => l.toUpperCase())
        if (op.operations.includes('remove_special')) v = v.replace(/[^a-zA-Z0-9\s]/g, '')
        if (v !== original) affected++
        return { ...r, [op.column]: v }
      })
      return { rows: newRows, columns, affected_rows: affected }
    }

    default:
      return { rows, columns, affected_rows: 0 }
  }
}

// ─── Apply multiple operations in sequence ────────────────────────────────────

export function applyOperations(
  rows: DataRow[],
  columns: ColumnSchema[],
  operations: CleaningOperation[]
): { rows: DataRow[]; columns: ColumnSchema[] } {
  let currentRows = rows
  let currentColumns = columns
  for (const op of operations) {
    const result = applyOperation(currentRows, currentColumns, op)
    currentRows = result.rows
    currentColumns = result.columns
  }
  return { rows: currentRows, columns: currentColumns }
}

// ─── Helper: test a filter condition ─────────────────────────────────────────

function testCondition(
  value: string | number | boolean | null,
  operator: FilterOperator,
  target: string | number | boolean | null
): boolean {
  if (operator === 'is_null') return value === null || value === undefined || value === ''
  if (operator === 'is_not_null') return value !== null && value !== undefined && value !== ''
  if (value === null || value === undefined) return false

  const sv = String(value).toLowerCase()
  const st = String(target ?? '').toLowerCase()

  switch (operator) {
    case '=': return sv === st
    case '!=': return sv !== st
    case '>': return Number(value) > Number(target)
    case '>=': return Number(value) >= Number(target)
    case '<': return Number(value) < Number(target)
    case '<=': return Number(value) <= Number(target)
    case 'contains': return sv.includes(st)
    case 'not_contains': return !sv.includes(st)
    case 'starts_with': return sv.startsWith(st)
    case 'ends_with': return sv.endsWith(st)
    default: return false
  }
}

// ─── Helper: coerce value to type ─────────────────────────────────────────────

function coerceValue(value: string | number | boolean | null, type: string): string | number | boolean | null {
  if (value === null || value === undefined) return null
  switch (type) {
    case 'integer': { const n = parseInt(String(value)); return isNaN(n) ? null : n }
    case 'decimal': { const n = parseFloat(String(value)); return isNaN(n) ? null : n }
    case 'number': { const n = Number(value); return isNaN(n) ? null : n }
    case 'boolean': {
      const s = String(value).toLowerCase()
      return s === 'true' || s === '1' || s === 'yes' || s === 'y'
    }
    case 'text':
    case 'categorical':
      return String(value)
    default: return value
  }
}

// ─── Simple formula evaluator ─────────────────────────────────────────────────

export function evalFormula(formula: string, row: DataRow): string | number | boolean | null {
  // Replace column references with values
  // Column references are wrapped in backticks or just used as identifiers
  let expr = formula

  // Replace column names (longest first to avoid partial matches)
  const colNames = Object.keys(row).sort((a, b) => b.length - a.length)
  for (const col of colNames) {
    const val = row[col]
    const safeVal = val === null ? 'null' : typeof val === 'string' ? JSON.stringify(val) : String(val)
    expr = expr.replace(new RegExp(`\\b${col.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'), safeVal)
  }

  // Support basic IF function
  expr = expr.replace(/IF\s*\((.+?),\s*(.+?),\s*(.+?)\)/gi, '($1 ? $2 : $3)')

  // Support CONCAT
  expr = expr.replace(/CONCAT\s*\((.+?)\)/gi, '[$1].join("")')

  try {
    // Use Function constructor for safe(ish) evaluation
    // eslint-disable-next-line no-new-func
    const result = new Function(`return ${expr}`)()
    return result ?? null
  } catch {
    return null
  }
}

// ─── Duplicate Detection ──────────────────────────────────────────────────────

export interface DuplicateGroup {
  idValue: string
  rows: { originalIndex: number; data: DataRow }[]
  diffColumns: string[]    // columns that differ between the rows in this group
}

export interface NearDuplicateGroup {
  ids: [string, string]
  rows: { originalIndex: number; data: DataRow; idValue: string }[]
  editDistance: number
  similarity: number
}

export interface DuplicateReport {
  idColumn: string
  duplicateGroups: DuplicateGroup[]
  nearDuplicateGroups: NearDuplicateGroup[]
  totalDuplicateRows: number    // extra rows that keep-first would remove
  totalAffectedRows: number     // all rows inside a duplicate group
  percentAffected: number
}

const ID_COLUMN_PRIORITY = [
  'id', 'patient_id', 'subject_id', 'record_id', 'participant_id',
  'study_id', 'sample_id', 'case_id', 'respondent_id', 'pid', 'sid',
]

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1])
  return dp[m][n]
}

export function detectDuplicates(rows: DataRow[], idColumnHint?: string): DuplicateReport {
  const empty: DuplicateReport = {
    idColumn: '', duplicateGroups: [], nearDuplicateGroups: [],
    totalDuplicateRows: 0, totalAffectedRows: 0, percentAffected: 0,
  }
  if (rows.length === 0) return empty

  const cols = Object.keys(rows[0])

  // Auto-detect ID column
  let idColumn = idColumnHint ?? ''
  if (!idColumn) {
    for (const name of ID_COLUMN_PRIORITY) {
      const match = cols.find(c => c.toLowerCase() === name)
      if (match) { idColumn = match; break }
    }
  }
  if (!idColumn) {
    idColumn = cols.find(c => c.toLowerCase().includes('id')) ?? cols[0]
  }
  if (!idColumn) return empty

  // Group rows by ID
  const groups = new Map<string, { originalIndex: number; data: DataRow }[]>()
  rows.forEach((row, i) => {
    const key = String(row[idColumn] ?? '')
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push({ originalIndex: i, data: row })
  })

  // Exact duplicate groups (>1 row per ID)
  const duplicateGroups: DuplicateGroup[] = []
  for (const [idValue, groupRows] of groups) {
    if (groupRows.length <= 1) continue
    const diffColumns: string[] = []
    for (const col of cols) {
      if (col === idColumn) continue
      const vals = new Set(groupRows.map(r => String(r.data[col] ?? '')))
      if (vals.size > 1) diffColumns.push(col)
    }
    duplicateGroups.push({ idValue, rows: groupRows, diffColumns })
  }

  // Near-duplicate detection — only for reasonably sized datasets
  const nearDuplicateGroups: NearDuplicateGroup[] = []
  const uniqueIds = Array.from(groups.keys()).filter(id => id.length >= 3)
  if (rows.length <= 5000) {
    const seen = new Set<string>()
    for (let i = 0; i < uniqueIds.length; i++) {
      for (let j = i + 1; j < uniqueIds.length; j++) {
        const a = uniqueIds[i], b = uniqueIds[j]
        const dist = levenshtein(a, b)
        const maxLen = Math.max(a.length, b.length)
        const similarity = 1 - dist / maxLen
        if (dist <= 2 && similarity >= 0.7) {
          const key = [a, b].sort().join('\x00')
          if (!seen.has(key)) {
            seen.add(key)
            nearDuplicateGroups.push({
              ids: [a, b],
              rows: [
                ...(groups.get(a) ?? []).map(r => ({ ...r, idValue: a })),
                ...(groups.get(b) ?? []).map(r => ({ ...r, idValue: b })),
              ],
              editDistance: dist,
              similarity,
            })
          }
        }
      }
    }
  }

  const totalAffectedRows = duplicateGroups.reduce((s, g) => s + g.rows.length, 0)
  const totalDuplicateRows = duplicateGroups.reduce((s, g) => s + g.rows.length - 1, 0)

  return {
    idColumn,
    duplicateGroups,
    nearDuplicateGroups,
    totalDuplicateRows,
    totalAffectedRows,
    percentAffected: rows.length > 0 ? (totalAffectedRows / rows.length) * 100 : 0,
  }
}

export type DuplicateAction = 'keep_first' | 'keep_last' | 'renumber' | 'keep_all'

export interface DuplicateResolution {
  action: DuplicateAction
  reason?: string
}

export function applyDuplicateResolutions(
  rows: DataRow[],
  report: DuplicateReport,
  resolutions: Map<string, DuplicateResolution>,
  defaultAction: DuplicateAction,
  renumberSuffix: string   // e.g. '_visit', '_dup', '_'
): DataRow[] {
  const removeIndices = new Set<number>()
  const renumberMap = new Map<number, string>()

  for (const group of report.duplicateGroups) {
    const action = resolutions.get(group.idValue)?.action ?? defaultAction
    if (action === 'keep_first') {
      group.rows.slice(1).forEach(r => removeIndices.add(r.originalIndex))
    } else if (action === 'keep_last') {
      group.rows.slice(0, -1).forEach(r => removeIndices.add(r.originalIndex))
    } else if (action === 'renumber') {
      group.rows.forEach((r, i) =>
        renumberMap.set(r.originalIndex, `${group.idValue}${renumberSuffix}${i + 1}`)
      )
    }
    // keep_all: do nothing
  }

  return rows
    .map((row, i): DataRow => renumberMap.has(i) ? { ...row, [report.idColumn]: renumberMap.get(i) as string } : row)
    .filter((_, i) => !removeIndices.has(i))
}

// ─── Smart chart suggestions ──────────────────────────────────────────────────

export function suggestChartType(selectedColumns: ColumnSchema[]): {
  chart_type: string
  reason: string
} {
  const numeric = selectedColumns.filter(c => c.type === 'integer' || c.type === 'decimal' || c.type === 'number')
  const categorical = selectedColumns.filter(c => c.type === 'categorical' || c.type === 'text' || c.type === 'boolean')
  const dates = selectedColumns.filter(c => c.type === 'date')

  if (selectedColumns.length === 1) {
    if (numeric.length === 1) return { chart_type: 'histogram', reason: 'Show distribution of one numeric variable' }
    if (categorical.length === 1) return { chart_type: 'bar', reason: 'Show frequency counts for categories' }
  }

  if (selectedColumns.length === 2) {
    if (dates.length === 1 && numeric.length === 1) return { chart_type: 'line', reason: 'Show trend over time' }
    if (numeric.length === 2) return { chart_type: 'scatter', reason: 'Show relationship between two numeric variables' }
    if (numeric.length === 1 && categorical.length === 1) return { chart_type: 'box', reason: 'Compare distribution across groups' }
    if (categorical.length === 2) return { chart_type: 'bar', reason: 'Show grouped frequency counts' }
  }

  if (selectedColumns.length >= 3) {
    if (numeric.length >= 3) return { chart_type: 'heatmap', reason: 'Show correlations across multiple numeric variables' }
    if (numeric.length === 1 && categorical.length === 2) return { chart_type: 'box', reason: 'Compare distribution across two grouping factors' }
    if (numeric.length === 2 && categorical.length === 1) return { chart_type: 'scatter', reason: 'Show relationship with color grouping' }
  }

  return { chart_type: 'bar', reason: 'Default chart for exploring data' }
}

// ─── Dataset merge ────────────────────────────────────────────────────────────

export function mergeDatasets(
  leftRows: DataRow[],
  rightRows: DataRow[],
  leftKey: string,
  rightKey: string,
  joinType: 'left' | 'inner' | 'full_outer',
  leftColumns: string[],
  rightColumns: string[]
): { rows: DataRow[]; stats: { matched: number; unmatched_left: number; unmatched_right: number } } {
  const rightIndex = new Map<string, DataRow[]>()
  rightRows.forEach(r => {
    const k = String(r[rightKey] ?? '')
    if (!rightIndex.has(k)) rightIndex.set(k, [])
    rightIndex.get(k)!.push(r)
  })

  const result: DataRow[] = []
  const matchedRightKeys = new Set<string>()
  let matched = 0
  let unmatched_left = 0

  for (const leftRow of leftRows) {
    const k = String(leftRow[leftKey] ?? '')
    const rightMatches = rightIndex.get(k) ?? []

    if (rightMatches.length > 0) {
      for (const rightRow of rightMatches) {
        matched++
        matchedRightKeys.add(k)
        const merged: DataRow = {}
        leftColumns.forEach(c => { merged[c] = leftRow[c] ?? null })
        rightColumns.forEach(c => { if (c !== rightKey) merged[c] = rightRow[c] ?? null })
        result.push(merged)
      }
    } else if (joinType === 'left' || joinType === 'full_outer') {
      unmatched_left++
      const merged: DataRow = {}
      leftColumns.forEach(c => { merged[c] = leftRow[c] ?? null })
      rightColumns.forEach(c => { if (c !== rightKey) merged[c] = null })
      result.push(merged)
    }
  }

  let unmatched_right = 0
  if (joinType === 'full_outer') {
    for (const rightRow of rightRows) {
      const k = String(rightRow[rightKey] ?? '')
      if (!matchedRightKeys.has(k)) {
        unmatched_right++
        const merged: DataRow = {}
        leftColumns.forEach(c => { merged[c] = null })
        rightColumns.forEach(c => { if (c !== rightKey) merged[c] = rightRow[c] ?? null })
        result.push(merged)
      }
    }
  }

  return { rows: result, stats: { matched, unmatched_left, unmatched_right } }
}

// ─── Dataset append (stack vertically) ───────────────────────────────────────

export function appendDatasets(
  baseRows: DataRow[],
  appendRows: DataRow[],
  columnMapping: Record<string, string> // appendColumn -> baseColumn
): DataRow[] {
  const mapped = appendRows.map(r => {
    const newRow: DataRow = {}
    for (const [appendCol, baseCol] of Object.entries(columnMapping)) {
      newRow[baseCol] = r[appendCol] ?? null
    }
    return newRow
  })
  return [...baseRows, ...mapped]
}
