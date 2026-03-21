"use client"

import type { ResultTable } from '@/lib/analysis/types'
import { cn } from '@/lib/utils'

interface Props {
  table: ResultTable
}

export function CoefficientTable({ table }: Props) {
  return (
    <div className="overflow-x-auto">
      {table.title && (
        <h4 className="text-sm font-semibold mb-2">{table.title}</h4>
      )}
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-border">
            {table.headers.map((h, i) => (
              <th key={i} className={cn('py-1.5 px-2 text-left font-medium text-muted-foreground whitespace-nowrap', i > 0 && 'text-right')}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, ri) => (
            <tr key={ri} className={cn('border-b border-border/50 hover:bg-muted/20 transition-colors', ri === table.rows.length - 1 && table.rows.length > 2 ? 'font-semibold bg-muted/30' : '')}>
              {row.map((cell, ci) => (
                <td key={ci} className={cn('py-1.5 px-2 whitespace-nowrap', ci > 0 ? 'text-right font-mono' : 'font-medium')}>
                  {cell === null ? '—' : cell === '***' || cell === '**' || cell === '*' || cell === '†'
                    ? <span className="text-destructive font-bold">{cell}</span>
                    : String(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {table.footnotes?.map((fn, i) => (
        <p key={i} className="text-[11px] text-muted-foreground mt-1 italic">{fn}</p>
      ))}
    </div>
  )
}
