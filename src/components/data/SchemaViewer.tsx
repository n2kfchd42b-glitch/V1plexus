"use client"

import { Badge } from '@/components/ui/badge'
import type { ColumnSchema } from '@/types/database'

const typeColors: Record<string, string> = {
  number: 'bg-blue-100 text-blue-700 border-blue-200',
  string: 'bg-gray-100 text-gray-700 border-gray-200',
  date: 'bg-purple-100 text-purple-700 border-purple-200',
  boolean: 'bg-green-100 text-green-700 border-green-200',
  unknown: 'bg-yellow-100 text-yellow-700 border-yellow-200',
}

interface SchemaViewerProps {
  schema: ColumnSchema[]
  totalRows: number
}

export function SchemaViewer({ schema, totalRows }: SchemaViewerProps) {
  return (
    <div className="space-y-1">
      {schema.map(col => {
        const nullPct = totalRows > 0 ? ((col.null_count / totalRows) * 100).toFixed(1) : '0'
        return (
          <div key={col.name} className="border rounded-md p-3 text-sm">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="font-medium truncate" title={col.name}>{col.name}</span>
              <Badge className={`text-xs border shrink-0 ${typeColors[col.type] ?? typeColors.unknown}`}>
                {col.type}
              </Badge>
            </div>
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span>{col.unique_count} unique</span>
              <span>{nullPct}% null</span>
              {col.min !== undefined && col.max !== undefined && col.type === 'number' && (
                <span>range: {col.min} – {col.max}</span>
              )}
            </div>
            {col.sample_values.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {col.sample_values.slice(0, 4).map((v, i) => (
                  <span key={i} className="px-1.5 py-0.5 bg-muted rounded text-xs text-muted-foreground truncate max-w-[100px]">
                    {String(v)}
                  </span>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
