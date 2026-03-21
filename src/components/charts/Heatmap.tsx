'use client'

import { useMemo } from 'react'
import type { ChartConfig, DataRow, ColumnSchema } from '@/types/database'

interface HeatmapProps {
  data: DataRow[]
  config: ChartConfig
  columns: ColumnSchema[]
  width?: number | string
  height?: number | string
}

function pearsonCorrelation(xs: number[], ys: number[]): number {
  const n = xs.length
  if (n < 2) return 0
  const meanX = xs.reduce((a, b) => a + b, 0) / n
  const meanY = ys.reduce((a, b) => a + b, 0) / n
  let num = 0, dx2 = 0, dy2 = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX
    const dy = ys[i] - meanY
    num += dx * dy
    dx2 += dx * dx
    dy2 += dy * dy
  }
  const denom = Math.sqrt(dx2 * dy2)
  return denom === 0 ? 0 : num / denom
}

function corrColor(r: number): string {
  // Red for negative, blue for positive, white near zero
  const abs = Math.abs(r)
  if (r > 0) {
    const g = Math.round(255 - abs * 200)
    return `rgb(${g}, ${g}, 255)`
  } else {
    const g = Math.round(255 - abs * 200)
    return `rgb(255, ${g}, ${g})`
  }
}

export function Heatmap({ data, columns, config }: HeatmapProps) {
  const numericCols = useMemo(
    () => columns.filter(c => c.type === 'number' || c.type === 'integer' || c.type === 'decimal').map(c => c.name),
    [columns]
  )

  const matrix = useMemo(() => {
    if (numericCols.length < 2 || data.length === 0) return null

    // Precompute numeric arrays per column (filter nulls pairwise below)
    const colVectors: Record<string, number[]> = {}
    for (const col of numericCols) {
      colVectors[col] = data.map(r => Number(r[col]))
    }

    const result: number[][] = numericCols.map(colA =>
      numericCols.map(colB => {
        if (colA === colB) return 1
        const paired = data
          .map(r => ({ a: Number(r[colA]), b: Number(r[colB]) }))
          .filter(p => !isNaN(p.a) && !isNaN(p.b))
        return pearsonCorrelation(paired.map(p => p.a), paired.map(p => p.b))
      })
    )

    // Suppress lint warning about unused colVectors
    void colVectors

    return result
  }, [data, numericCols])

  if (numericCols.length < 2) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        At least 2 numeric columns are required for a correlation heatmap
      </div>
    )
  }

  if (!matrix || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        No data available
      </div>
    )
  }

  const cellSize = Math.max(32, Math.min(64, Math.floor(480 / numericCols.length)))
  const labelWidth = 96
  const title = config.title ?? 'Correlation Matrix'

  return (
    <div className="overflow-auto">
      {title && <div className="text-center text-sm font-medium mb-3 text-foreground">{title}</div>}
      <div style={{ display: 'inline-block', userSelect: 'none' }}>
        {/* Column labels across top */}
        <div style={{ display: 'flex', paddingLeft: labelWidth }}>
          {numericCols.map(col => (
            <div
              key={col}
              style={{
                width: cellSize,
                fontSize: 10,
                textAlign: 'center',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                paddingBottom: 4,
                color: 'var(--muted-foreground, #888)',
                transform: 'rotate(-30deg)',
                transformOrigin: 'bottom center',
                height: 40,
              }}
              title={col}
            >
              {col}
            </div>
          ))}
        </div>

        {/* Rows */}
        {numericCols.map((rowCol, ri) => (
          <div key={rowCol} style={{ display: 'flex', alignItems: 'center' }}>
            {/* Row label */}
            <div
              style={{
                width: labelWidth,
                fontSize: 11,
                textAlign: 'right',
                paddingRight: 6,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                color: 'var(--muted-foreground, #888)',
              }}
              title={rowCol}
            >
              {rowCol}
            </div>

            {/* Cells */}
            {numericCols.map((colCol, ci) => {
              const r = matrix[ri][ci]
              const bg = corrColor(r)
              const textColor = Math.abs(r) > 0.5 ? '#fff' : '#333'
              return (
                <div
                  key={colCol}
                  title={`${rowCol} × ${colCol}: ${r.toFixed(3)}`}
                  style={{
                    width: cellSize,
                    height: cellSize,
                    background: bg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    color: textColor,
                    border: '1px solid rgba(128,128,128,0.1)',
                    cursor: 'default',
                    fontWeight: ri === ci ? 600 : 400,
                  }}
                >
                  {r.toFixed(2)}
                </div>
              )
            })}
          </div>
        ))}

        {/* Legend */}
        <div style={{ paddingLeft: labelWidth, paddingTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 10, color: 'var(--muted-foreground, #888)' }}>-1</span>
          <div
            style={{
              width: 120,
              height: 8,
              background: 'linear-gradient(to right, rgb(55,55,255), rgb(255,255,255), rgb(255,55,55))',
              borderRadius: 4,
            }}
          />
          <span style={{ fontSize: 10, color: 'var(--muted-foreground, #888)' }}>+1</span>
        </div>
      </div>
    </div>
  )
}
