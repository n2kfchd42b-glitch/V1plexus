"use client"

import { ScrollArea } from '@/components/ui/scroll-area'

interface OutputTableProps {
  headers: string[]
  rows: (string | number | null)[][]
  title?: string | null
}

export function OutputTable({ headers, rows, title }: OutputTableProps) {
  return (
    <div className="space-y-1">
      {title && <p className="text-sm font-medium">{title}</p>}
      <ScrollArea className="w-full">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted/50">
                {headers.map((h, i) => (
                  <th key={i} className="border px-3 py-1.5 text-left text-xs font-medium whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className="hover:bg-muted/30">
                  {row.map((cell, ci) => (
                    <td key={ci} className="border px-3 py-1 text-xs whitespace-nowrap">
                      {cell === null ? <span className="text-muted-foreground/50 italic">null</span> : String(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ScrollArea>
    </div>
  )
}
