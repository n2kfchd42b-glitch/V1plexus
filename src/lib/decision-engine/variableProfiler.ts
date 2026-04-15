import type { EngineColumnSchema, VariableType } from './types'
import type { ColumnSchema, DatasetColumn } from '@/types/database'

// ─── Normalise raw ColumnType from database to engine VariableType ────────────

export function normaliseType(raw: string): VariableType {
  const t = (raw ?? '').toLowerCase()
  if (t === 'binary' || t === 'boolean' || t === 'bool') return 'binary'
  if (
    t === 'continuous' ||
    t === 'numeric' ||
    t === 'float' ||
    t === 'integer' ||
    t === 'int' ||
    t === 'number' ||
    t === 'decimal'
  ) return 'continuous'
  if (t === 'categorical' || t === 'nominal' || t === 'ordinal') return 'categorical'
  if (t === 'date' || t === 'datetime' || t === 'timestamp') return 'date'
  if (t === 'id' || t === 'identifier') return 'id'
  if (t === 'text' || t === 'string') return 'text'
  return 'text'
}

// ─── Build EngineColumnSchema from database ColumnSchema (schema_info) ────────

export function profileVariables(schema_info: ColumnSchema[]): EngineColumnSchema[] {
  return schema_info.map(col => ({
    name: col.name,
    label: null,
    type: normaliseType(col.type),
    null_count: col.null_count ?? 0,
    unique_count: col.unique_count ?? 0,
    min: col.min ?? undefined,
    max: col.max ?? undefined,
    mean: col.mean ?? undefined,
    sample_values: (col.sample_values ?? []).map(v => String(v)),
  }))
}

// ─── Build EngineColumnSchema from DatasetColumn (loaded in AnalysisHub) ─────
// DatasetColumn is the in-memory representation after CSV is parsed.
// unique_values / missing come from the parsed result.

export function profileFromDatasetColumns(
  columns: DatasetColumn[],
  row_count: number,
): EngineColumnSchema[] {
  return columns.map(col => ({
    name: col.name,
    label: null,
    type: normaliseType(col.type),
    null_count: col.missing ?? 0,
    unique_count: col.unique_values ?? 0,
    min: undefined,
    max: undefined,
    mean: undefined,
    sample_values: (col.sample_values ?? []).map(v => String(v)),
  }))
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function completenessPercent(col: EngineColumnSchema, row_count: number): number {
  if (row_count === 0) return 0
  return Math.round(((row_count - col.null_count) / row_count) * 100)
}

export function estimateCompleteCases(
  selected: EngineColumnSchema[],
  row_count: number,
): number {
  if (selected.length === 0) return row_count
  const minCompleteness = Math.min(
    ...selected.map(col => (row_count - col.null_count) / row_count),
  )
  return Math.round(row_count * minCompleteness)
}

export function getSelectableVariables(schema: EngineColumnSchema[]): EngineColumnSchema[] {
  return schema.filter(col => col.type !== 'id' && col.type !== 'text')
}
