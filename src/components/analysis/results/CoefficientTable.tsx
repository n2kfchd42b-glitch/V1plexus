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

const SIG_COLORS: Record<string, string> = {
  '***': 'text-[#003d9b] font-bold',
  '**':  'text-[#003d9b] font-bold',
  '*':   'text-[#0052cc] font-semibold',
  '†':   'text-[#A1A1AA]',
}

export function CoefficientTable({ table }: Props) {
  return (
    <div className="overflow-x-auto">
      {/* Table header */}
      <div className="flex items-center justify-between mb-4 gap-4">
        {table.title && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#0040a2] font-manrope mb-0.5">
              Table
            </p>
            <h4 className="font-manrope font-bold text-sm text-[#18181B]">{table.title}</h4>
          </div>
        )}
        <button
          onClick={() => downloadCSV(table)}
          title="Download as CSV"
          className="ml-auto flex items-center gap-1.5 text-[11px] font-medium text-[#52525B] hover:text-[#18181B] transition-colors px-3 py-1.5 rounded-lg border border-[rgba(195,198,214,0.4)] hover:bg-[#f2f4f6] bg-white flex-shrink-0"
          style={{ boxShadow: '0 4px 12px rgba(0,24,72,0.04)' }}
        >
          <Download className="h-3 w-3" />
          CSV
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ boxShadow: '0 4px 12px rgba(0,24,72,0.04)' }}>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-[#f7f9fb]">
              {table.headers.map((h, i) => (
                <th
                  key={i}
                  className={cn(
                    'py-3 px-5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#A1A1AA] whitespace-nowrap border-b border-[#f2f4f6]',
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
                className="border-b border-[#f2f4f6] last:border-0 transition-colors duration-150 cursor-default"
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,61,155,0.02)')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}
              >
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className={cn(
                      'py-3.5 px-5 whitespace-nowrap',
                      ci === 0
                        ? 'font-semibold text-[#18181B] text-[12px]'
                        : 'text-right font-mono text-[11px] text-[#52525B]'
                    )}
                  >
                    {cell === null ? (
                      <span className="text-[#A1A1AA]">—</span>
                    ) : (SIG_COLORS[String(cell)] !== undefined) ? (
                      <span className={SIG_COLORS[String(cell)]}>
                        {String(cell)}
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
            <p key={i} className="text-[11px] text-[#A1A1AA] italic leading-snug">{fn}</p>
          ))}
        </div>
      )}
    </div>
  )
}
