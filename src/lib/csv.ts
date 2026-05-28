/**
 * Small, dependency-free CSV parser for admin-controlled input (roster uploads).
 *
 * Handles:
 *  - UTF-8 BOM
 *  - CRLF / LF / CR line endings
 *  - Quoted fields with embedded commas, newlines, and escaped quotes ("")
 *  - Trailing empty lines
 *
 * Returns rows of arrays (raw cells). Caller maps via header row.
 */
export function parseCsv(input: string): string[][] {
  let s = input
  if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1) // strip BOM

  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0

  while (i < s.length) {
    const c = s[i]

    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      field += c
      i++
      continue
    }

    if (c === '"') { inQuotes = true; i++; continue }
    if (c === ',') { row.push(field); field = ''; i++; continue }
    if (c === '\r') {
      row.push(field); field = ''
      rows.push(row); row = []
      // Swallow LF in CRLF
      if (s[i + 1] === '\n') i += 2; else i++
      continue
    }
    if (c === '\n') {
      row.push(field); field = ''
      rows.push(row); row = []
      i++
      continue
    }
    field += c
    i++
  }

  // Flush trailing cell / row
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  // Drop fully-empty trailing rows
  while (rows.length > 0 && rows[rows.length - 1].every((c) => c.trim() === '')) {
    rows.pop()
  }

  return rows
}

/**
 * Map a CSV header → first matching index (case-insensitive, trims spaces and
 * dashes/underscores). Aliases let the same column be written in several ways
 * — `matric_number`, `matric number`, `MatriculationNumber` all match.
 */
export function indexHeader(header: string[], aliases: string[]): number {
  const norm = (s: string) => s.toLowerCase().replace(/[\s_-]/g, '')
  const target = aliases.map(norm)
  for (let i = 0; i < header.length; i++) {
    if (target.includes(norm(header[i] ?? ''))) return i
  }
  return -1
}
