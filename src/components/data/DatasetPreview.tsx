"use client"

import { ScrollArea } from '@/components/ui/scroll-area'

interface DatasetPreviewProps {
  headers: string[]
  rows: (string | number | boolean | null)[][]
  maxRows?: number
}

export function DatasetPreview({ headers, rows, maxRows = 100 }: DatasetPreviewProps) {
  const displayRows = rows.slice(0, maxRows)

  if (headers.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        No data available to preview.
      </div>
    )
  }

  return (
    <ScrollArea className="w-full">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border-collapse">
          <thead>
            <tr className="bg-muted/50">
              <th className="border px-2 py-1.5 text-left text-xs font-medium text-muted-foreground w-10 sticky left-0 bg-muted/50">
                #
              </th>
              {headers.map((h, i) => (
                <th
                  key={i}
                  className="border px-3 py-1.5 text-left text-xs font-medium whitespace-nowrap"
                  title={h}
                >
                  <span className="block max-w-[150px] truncate">{h}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, rowIdx) => (
              <tr key={rowIdx} className="hover:bg-muted/30">
                <td className="border px-2 py-1 text-xs text-muted-foreground text-right sticky left-0 bg-background">
                  {rowIdx + 1}
                </td>
                {row.map((cell, colIdx) => (
                  <td
                    key={colIdx}
                    className="border px-3 py-1 text-xs whitespace-nowrap"
                    title={cell !== null ? String(cell) : ''}
                  >
                    {cell === null ? (
                      <span className="text-muted-foreground/50 italic">null</span>
                    ) : (
                      <span className="block max-w-[200px] truncate">{String(cell)}</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ScrollArea>
  )
}
