import type { ColumnSchema } from '@/types/database'

function detectType(values: (string | number | boolean | null)[]): ColumnSchema['type'] {
  const nonNull = values.filter(v => v !== null && v !== '' && v !== undefined)
  if (nonNull.length === 0) return 'unknown'

  const numericCount = nonNull.filter(v => !isNaN(Number(v)) && v !== '').length
  if (numericCount / nonNull.length > 0.8) return 'number'

  const dateCount = nonNull.filter(v => {
    const d = new Date(String(v))
    return !isNaN(d.getTime()) && String(v).length > 4
  }).length
  if (dateCount / nonNull.length > 0.8) return 'date'

  const boolCount = nonNull.filter(v =>
    ['true', 'false', 'yes', 'no', '0', '1'].includes(String(v).toLowerCase())
  ).length
  if (boolCount / nonNull.length > 0.9) return 'boolean'

  return 'string'
}

export interface ParsedData {
  headers: string[]
  rows: (string | number | boolean | null)[][]
  schema: ColumnSchema[]
  rowCount: number
}

export function buildSchema(
  headers: string[],
  rows: (string | number | boolean | null)[][]
): ColumnSchema[] {
  return headers.map((name, colIdx) => {
    const values = rows.map(row => {
      const v = row[colIdx]
      return v === '' || v === undefined ? null : v
    })
    const nonNull = values.filter(v => v !== null)
    const type = detectType(values)
    const uniqueSet = new Set(nonNull.map(String))
    const numericVals = type === 'number' ? nonNull.map(Number) : []

    return {
      name,
      type,
      null_count: values.length - nonNull.length,
      unique_count: uniqueSet.size,
      total_count: values.length,
      min: numericVals.length ? Math.min(...numericVals) : (typeof nonNull[0] === 'string' || typeof nonNull[0] === 'number' ? nonNull[0] as string | number : undefined),
      max: numericVals.length ? Math.max(...numericVals) : (typeof nonNull[nonNull.length - 1] === 'string' || typeof nonNull[nonNull.length - 1] === 'number' ? nonNull[nonNull.length - 1] as string | number : undefined),
      sample_values: nonNull.slice(0, 5) as (string | number | boolean | null)[],
    }
  })
}

export async function parseCSV(file: File): Promise<ParsedData> {
  const Papa = (await import('papaparse')).default
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (result) => {
        const headers = result.meta.fields ?? []
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rows = (result.data as any[]).map(row =>
          headers.map(h => {
            const v = row[h]
            return v === null || v === undefined || v === '' ? null : v
          })
        )
        const schema = buildSchema(headers, rows)
        resolve({ headers, rows, schema, rowCount: rows.length })
      },
      error: reject,
    })
  })
}

export async function parseExcel(file: File): Promise<ParsedData> {
  const XLSX = await import('xlsx')
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const raw = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
  }) as unknown as (string | number | boolean | null)[][]

  if (raw.length === 0) return { headers: [], rows: [], schema: [], rowCount: 0 }

  const headers = raw[0].map(h => String(h ?? ''))
  const rows = raw.slice(1)
  const schema = buildSchema(headers, rows)
  return { headers, rows, schema, rowCount: rows.length }
}

export async function computeFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function parseFile(file: File): Promise<ParsedData> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.csv') || file.type === 'text/csv') {
    return parseCSV(file)
  }
  if (name.endsWith('.xlsx') || name.endsWith('.xls') || file.type.includes('spreadsheet') || file.type.includes('excel')) {
    return parseExcel(file)
  }
  // SPSS and others: just return metadata-only parse
  return { headers: [], rows: [], schema: [], rowCount: 0 }
}
