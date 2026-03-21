'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import type { ChartConfig, DataRow, ColumnSchema } from '@/types/database'

interface HistogramProps {
  data: DataRow[]
  config: ChartConfig
  columns: ColumnSchema[]
  width?: number | `${number}%`
  height?: number | `${number}%`
}

interface Bin {
  label: string
  count: number
  start: number
  end: number
}

function computeBins(values: number[], binCount: number): Bin[] {
  if (values.length === 0) return []
  const min = Math.min(...values)
  const max = Math.max(...values)
  if (min === max) {
    return [{ label: String(min), count: values.length, start: min, end: max }]
  }
  const binWidth = (max - min) / binCount
  const bins: Bin[] = Array.from({ length: binCount }, (_, i) => ({
    label: `${(min + i * binWidth).toFixed(2)}`,
    count: 0,
    start: min + i * binWidth,
    end: min + (i + 1) * binWidth,
  }))

  for (const v of values) {
    const idx = Math.min(Math.floor((v - min) / binWidth), binCount - 1)
    bins[idx].count++
  }

  return bins
}

export function Histogram({ data, config, columns: _columns, width = ('100%' as `${number}%`), height = 400 }: HistogramProps) {
  if (!config.x_axis) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Select a numeric variable for the histogram
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        No data available
      </div>
    )
  }

  const xCol = config.x_axis
  const binCount = config.bin_count ?? 20
  const values = data.map(r => Number(r[xCol])).filter(n => !isNaN(n))

  if (values.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        No numeric values found in column &quot;{xCol}&quot;
      </div>
    )
  }

  const bins = computeBins(values, binCount)

  return (
    <ResponsiveContainer width={width} height={height}>
      <BarChart data={bins} barCategoryGap={1} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis
          dataKey="label"
          label={{ value: config.x_label ?? xCol, position: 'insideBottom', offset: -10 }}
          tick={{ fontSize: 11 }}
          interval={Math.floor(binCount / 8)}
          height={60}
        />
        <YAxis
          label={{ value: config.y_label ?? 'Count', angle: -90, position: 'insideLeft', offset: 10 }}
          tick={{ fontSize: 12 }}
        />
        <Tooltip
          formatter={(value) => [value, 'Count']}
          labelFormatter={(label, payload) => {
            if (payload && payload[0]) {
              const bin = payload[0].payload as Bin
              return `[${bin.start.toFixed(2)}, ${bin.end.toFixed(2)})`
            }
            return label
          }}
        />
        <Bar dataKey="count" radius={[2, 2, 0, 0]}>
          {bins.map((_, i) => (
            <Cell key={i} fill="#6366f1" opacity={0.85} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
