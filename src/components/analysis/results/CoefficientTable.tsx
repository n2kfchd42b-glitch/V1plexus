"use client"

import { Download } from 'lucide-react'
import type { ResultTable } from '@/lib/analysis/types'
import { isSigMarker, sigMarkerClass, SIG_FOOTNOTE, buildFootnote } from '@/lib/analysis/formatStats'
import { cn } from '@/lib/utils'

interface Props {
  table: ResultTable
  tableNumber?: number   // e.g. 1 → "Table 1."
}

function downloadCSV(table: ResultTable) {
  const escape = (v: string | number | null) => {
    const s = v === null ? '' : String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s
  }
  const rows = [table.headers, ...table.rows]
  const csv = rows.map(row => row.map(escape).join(',')).join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${table.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Detect whether any row in the table contains significance markers
function hasSigColumn(table: ResultTable): boolean {
  return table.rows.some(row =>
    row.some(cell => cell !== null && isSigMarker(String(cell)))
  )
}

export function CoefficientTable({ table, tableNumber }: Props) {
  const showSigFootnote = hasSigColumn(table)

  const allFootnotes = buildFootnote([
    ...(table.footnotes ?? []),
    showSigFootnote ? SIG_FOOTNOTE : null,
  ])

  return (
    <div className="overflow-x-auto">

      {/* Caption — journal style: "Table N. Title" */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          {table.title && (
            <p className="text-[12px] font-semibold text-[var(--text-primary)] leading-snug font-manrope">
              {tableNumber != null && (
                <span className="text-[var(--accent-primary)] mr-1">
                  Table {tableNumber}.
                </span>
              )}
              {table.title}
            </p>
          )}
        </div>
        <button
          onClick={() => downloadCSV(table)}
          title="Download as CSV"
          className="flex-shrink-0 flex items-center gap-1.5 text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors px-2.5 py-1.5 rounded border border-[var(--border-default)] hover:bg-[var(--bg-surface-hover)] bg-[var(--bg-surface)]"
        >
          <Download className="h-3 w-3" />
          CSV
        </button>
      </div>

      {/* Table */}
      <div className="rounded-lg overflow-hidden border border-[var(--border-default)]">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-[var(--bg-app)]">
              {table.headers.map((h, i) => (
                <th
                  key={i}
                  className={cn(
                    'py-2.5 px-4 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)] border-b border-[var(--border-default)] whitespace-nowrap',
                    i > 0 ? 'text-right' : 'text-left'
                  )}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, ri) => (
              <tr
                key={ri}
                className="border-b border-[var(--border-row)] last:border-0 hover:bg-[var(--bg-row-hover)] transition-colors duration-100"
              >
                {row.map((cell, ci) => {
                  const str = cell === null ? null : String(cell)
                  const isSig = str !== null && isSigMarker(str)

                  return (
                    <td
                      key={ci}
                      className={cn(
                        'py-3 px-4 whitespace-nowrap',
                        ci === 0
                          ? 'font-medium text-[var(--text-primary)] text-[12px]'
                          : 'text-right font-mono text-[11px] tabular-nums text-[var(--text-secondary)]'
                      )}
                    >
                      {cell === null ? (
                        <span className="text-[var(--text-tertiary)]">—</span>
                      ) : isSig ? (
                        <span className={sigMarkerClass(str!)}>
                          {str}
                        </span>
                      ) : str}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footnotes — always show sig key when stars appear */}
      {allFootnotes && (
        <p className="mt-2 px-1 text-[10px] text-[var(--text-tertiary)] leading-relaxed">
          {allFootnotes}
        </p>
      )}
    </div>
  )
}
