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
      {/* Table Header */}
      <div className="flex items-center justify-between mb-4">
        {table.title && (
          <h4 className="text-sm font-bold text-foreground">{table.title}</h4>
        )}
        <button
          onClick={() => downloadCSV(table)}
          title="Download as CSV"
          className="ml-auto flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg border hover:bg-muted/30"
        >
          <Download className="h-3 w-3" />
          CSV
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50">
              {table.headers.map((h, i) => (
                <th
                  key={i}
                  className={cn(
                    'py-3 px-4 font-bold text-[10px] uppercase tracking-widest text-muted-foreground whitespace-nowrap border-b-2 border-slate-200',
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
                className="group border-b border-slate-100 last:border-0 hover:bg-blue-50/30 transition-colors cursor-default"
              >
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className={cn(
                      'py-3 px-4 whitespace-nowrap',
                      ci === 0 ? 'font-semibold text-foreground' : 'text-right font-mono text-muted-foreground'
                    )}
                  >
                    {cell === null ? (
                      <span className="text-muted-foreground/40">—</span>
                    ) : (cell === '***' || cell === '**' || cell === '*' || cell === '†') ? (
                      <span className={cn(
                        'font-bold',
                        cell === '***' ? 'text-red-600' :
                        cell === '**' ? 'text-orange-600' :
                        cell === '*' ? 'text-amber-600' :
                        'text-muted-foreground'
                      )}>
                        {cell}
                      </span>
                    ) : String(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footnotes */}
      {table.footnotes && table.footnotes.length > 0 && (
        <div className="mt-3 px-1 space-y-1">
          {table.footnotes.map((fn, i) => (
            <p key={i} className="text-[11px] text-muted-foreground italic leading-snug">{fn}</p>
          ))}
        </div>
      )}
    </div>
  )
}
