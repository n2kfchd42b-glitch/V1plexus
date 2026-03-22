import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import type { ColumnSchema, ColumnType, DataRow, ParsedDataset } from '@/types/database'

// ─── Type detection ──────────────────────────────────────────────────────────

function detectType(values: (string | number | boolean | null | undefined)[]): ColumnType {
  const nonNull = values.filter(v => v !== null && v !== undefined && v !== '')
  if (nonNull.length === 0) return 'text'

  // Boolean check
  const boolSet = new Set(['true', 'false', '0', '1', 'yes', 'no', 'y', 'n'])
  if (nonNull.every(v => boolSet.has(String(v).toLowerCase()))) return 'boolean'

  // Integer check
  if (nonNull.every(v => !isNaN(Number(v)) && Number.isInteger(Number(v)))) return 'integer'

  // Decimal check
  if (nonNull.every(v => !isNaN(Number(v)))) return 'decimal'

  // Date check
  const datePatterns = [
    /^\d{4}-\d{2}-\d{2}$/,
    /^\d{2}\/\d{2}\/\d{4}$/,
    /^\d{2}-\d{2}-\d{4}$/,
  ]
  if (nonNull.every(v => datePatterns.some(p => p.test(String(v))))) return 'date'

  // Categorical: <= 20 unique values and total > 10
  const unique = new Set(nonNull.map(v => String(v)))
  if (unique.size <= 20 && nonNull.length > 10) return 'categorical'

  return 'text'
}

function coerceValue(value: string | number | boolean | null | undefined, type: ColumnType): string | number | null {
  if (value === null || value === undefined || value === '') return null

  switch (type) {
    case 'integer':
    case 'decimal':
    case 'number': {
      const n = Number(value)
      return isNaN(n) ? null : n
    }
    // boolean, categorical, text, date — always preserve the original string
    default:
      return String(value)
  }
}

// ─── Schema computation ───────────────────────────────────────────────────────

export function computeColumnSchema(name: string, values: (string | number | boolean | null)[]): ColumnSchema {
  const type = detectType(values)
  const nonNull = values.filter(v => v !== null && v !== undefined && v !== '') as (string | number | boolean)[]
  const null_count = values.length - nonNull.length
  const unique_count = new Set(values.map(v => String(v))).size

  const schema: ColumnSchema = {
    name,
    type,
    null_count,
    unique_count,
    sample_values: values.slice(0, 5),
  }

  if (type === 'integer' || type === 'decimal' || type === 'number') {
    const nums = nonNull.map(Number).filter(n => !isNaN(n))
    if (nums.length > 0) {
      schema.min = Math.min(...nums)
      schema.max = Math.max(...nums)
      schema.mean = nums.reduce((a, b) => a + b, 0) / nums.length
      const sorted = [...nums].sort((a, b) => a - b)
      const mid = Math.floor(sorted.length / 2)
      schema.median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
    }
  } else if (type === 'categorical' || type === 'text' || type === 'boolean') {
    const counts: Record<string, number> = {}
    nonNull.forEach(v => {
      const k = String(v)
      counts[k] = (counts[k] || 0) + 1
    })
    schema.value_counts = counts
    // mode
    let maxCount = 0
    for (const [k, c] of Object.entries(counts)) {
      if (c > maxCount) { maxCount = c; schema.mode = k }
    }
  }

  return schema
}

// ─── CSV parsing ─────────────────────────────────────────────────────────────

export async function parseCSV(file: File): Promise<ParsedDataset> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      complete: (results) => {
        const rawRows = results.data as Record<string, string>[]
        if (rawRows.length === 0) {
          reject(new Error('CSV file is empty'))
          return
        }

        const columns_names = Object.keys(rawRows[0])
        const columns: ColumnSchema[] = columns_names.map(col => {
          const values = rawRows.map(r => r[col] ?? null)
          return computeColumnSchema(col, values)
        })

        const rows: DataRow[] = rawRows.map(r => {
          const row: DataRow = {}
          columns.forEach(col => {
            row[col.name] = coerceValue(r[col.name], col.type)
          })
          return row
        })

        resolve({
          rows,
          columns,
          row_count: rows.length,
          column_count: columns.length,
        })
      },
      error: (error) => reject(error),
    })
  })
}

// ─── Excel parsing ────────────────────────────────────────────────────────────

export async function parseExcel(file: File): Promise<ParsedDataset> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: null }) as Record<string, unknown>[]

  if (rawRows.length === 0) {
    throw new Error('Excel file is empty or has no data')
  }

  const column_names = Object.keys(rawRows[0])
  const columns: ColumnSchema[] = column_names.map(col => {
    const values = rawRows.map(r => {
      const v = r[col]
      if (v === null || v === undefined) return null
      if (v instanceof Date) return v.toISOString().split('T')[0]
      return v as string | number | boolean
    })
    return computeColumnSchema(col, values)
  })

  const rows: DataRow[] = rawRows.map(r => {
    const row: DataRow = {}
    columns.forEach(col => {
      const v = r[col.name]
      if (v instanceof Date) {
        row[col.name] = v.toISOString().split('T')[0]
      } else {
        row[col.name] = coerceValue(v as string | number | boolean | null, col.type)
      }
    })
    return row
  })

  return {
    rows,
    columns,
    row_count: rows.length,
    column_count: columns.length,
  }
}

// ─── TSV parsing (reuse CSV with tab delimiter) ───────────────────────────────

export async function parseTSV(file: File): Promise<ParsedDataset> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      delimiter: '\t',
      complete: (results) => {
        const rawRows = results.data as Record<string, string>[]
        if (rawRows.length === 0) { reject(new Error('TSV file is empty')); return }
        const column_names = Object.keys(rawRows[0])
        const columns: ColumnSchema[] = column_names.map(col =>
          computeColumnSchema(col, rawRows.map(r => r[col] ?? null))
        )
        const rows: DataRow[] = rawRows.map(r => {
          const row: DataRow = {}
          columns.forEach(col => { row[col.name] = coerceValue(r[col.name], col.type) })
          return row
        })
        resolve({ rows, columns, row_count: rows.length, column_count: columns.length })
      },
      error: reject,
    })
  })
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function parseFile(file: File): Promise<ParsedDataset> {
  const ext = file.name.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'csv':
      return parseCSV(file)
    case 'tsv':
    case 'txt':
      return parseTSV(file)
    case 'xlsx':
    case 'xls':
    case 'ods':
      return parseExcel(file)
    default:
      // Try CSV as fallback
      return parseCSV(file)
  }
}

// ─── JSON serialization ───────────────────────────────────────────────────────

export function rowsToCSV(rows: DataRow[], columns: string[]): string {
  return Papa.unparse({ fields: columns, data: rows.map(r => columns.map(c => r[c] ?? '')) })
}

export function rowsToJSON(rows: DataRow[]): string {
  return JSON.stringify(rows)
}

// ─── File hash (SHA-256) ──────────────────────────────────────────────────────

export async function hashFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}
