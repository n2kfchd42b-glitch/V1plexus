"use client"

import { Download } from 'lucide-react'
import type { ResultTable } from '@/lib/analysis/types'
import { cn } from '@/lib/utils'

interface Props {
  table: ResultTable
}

function downloadCSV(table: ResultTable) {
  const escape = (v: string | number | null) => {
    const s = v === null ? '' : String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
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

export function CoefficientTable({ table }: Props) {
  return (
    <div className="overflow-x-auto">
      <div className="flex items-center justify-between mb-2">
        {table.title && (
          <h4 className="text-sm font-semibold">{table.title}</h4>
        )}
        <button
          onClick={() => downloadCSV(table)}
          title="Download as CSV"
          className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded hover:bg-muted/50"
        >
          <Download className="h-3 w-3" />
          CSV
        </button>
      </div>
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b-2 border-border">
            {table.headers.map((h, i) => (
              <th
                key={i}
                className={cn(
                  'py-1.5 px-2 font-semibold text-foreground whitespace-nowrap',
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
              className="border-b border-border/40 hover:bg-muted/20 transition-colors"
            >
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className={cn(
                    'py-1.5 px-2 whitespace-nowrap',
                    ci === 0 ? 'font-medium' : 'text-right font-mono'
                  )}
                >
                  {cell === null ? '—' :
                    (cell === '***' || cell === '**' || cell === '*' || cell === '†')
                      ? <span className="text-destructive font-bold">{cell}</span>
                      : String(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {table.footnotes && table.footnotes.length > 0 && (
        <div className="mt-1.5 space-y-0.5">
          {table.footnotes.map((fn, i) => (
            <p key={i} className="text-[11px] text-muted-foreground italic leading-snug">{fn}</p>
          ))}
        </div>
      )}
    </div>
  )
}
