'use client'

import {
  BarChart as ReBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts'
import type { ChartConfig, DataRow, ColumnSchema } from '@/types/database'

interface BarChartProps {
  data: DataRow[]
  config: ChartConfig
  columns: ColumnSchema[]
  width?: number | `${number}%`
  height?: number | `${number}%`
}

const DEFAULT_COLORS = [
  '#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#14b8a6', '#f97316', '#84cc16',
]

function aggregateData(
  rows: DataRow[],
  xCol: string,
  yCol: string | 'COUNT',
  aggregation: string,
  colorCol?: string
): Array<Record<string, unknown>> {
  // Group by xCol (and colorCol if provided)
  const groups = new Map<string, DataRow[]>()

  for (const row of rows) {
    const xVal = row[xCol] != null ? String(row[xCol]) : '(null)'
    groups.set(xVal, [...(groups.get(xVal) ?? []), row])
  }

  if (colorCol && colorCol !== xCol) {
    // Multi-series: group by x, sub-group by color
    const colorValues = [...new Set(rows.map(r => r[colorCol] != null ? String(r[colorCol]) : '(null)'))]
    const result: Array<Record<string, unknown>> = []

    for (const [xVal, xRows] of groups) {
      const entry: Record<string, unknown> = { x: xVal }
      for (const cv of colorValues) {
        const subRows = xRows.filter(r => (r[colorCol] != null ? String(r[colorCol]) : '(null)') === cv)
        if (yCol === 'COUNT') {
          entry[cv] = subRows.length
        } else {
          const nums = subRows.map(r => Number(r[yCol])).filter(n => !isNaN(n))
          entry[cv] = computeAgg(nums, aggregation)
        }
      }
      result.push(entry)
    }
    return result
  }

  // Single series
  return Array.from(groups.entries()).map(([xVal, xRows]) => {
    if (yCol === 'COUNT') {
      return { x: xVal, value: xRows.length }
    }
    const nums = xRows.map(r => Number(r[yCol])).filter(n => !isNaN(n))
    return { x: xVal, value: computeAgg(nums, aggregation) }
  })
}

function computeAgg(nums: number[], aggregation: string): number {
  if (nums.length === 0) return 0
  switch (aggregation) {
    case 'count': return nums.length
    case 'sum': return nums.reduce((a, b) => a + b, 0)
    case 'mean': return nums.reduce((a, b) => a + b, 0) / nums.length
    case 'median': {
      const sorted = [...nums].sort((a, b) => a - b)
      const mid = Math.floor(sorted.length / 2)
      return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
    }
    case 'min': return Math.min(...nums)
    case 'max': return Math.max(...nums)
    default: return nums.reduce((a, b) => a + b, 0) / nums.length
  }
}

export function BarChart({ data, config, columns: _columns, width = ('100%' as `${number}%`), height = 400 }: BarChartProps) {
  if (!config.x_axis) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Select an X axis variable to get started
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
  const yCol = config.y_axis ?? 'COUNT'
  const aggregation = config.aggregation ?? 'count'
  const colorCol = config.color

  const aggregated = aggregateData(data, xCol, yCol, aggregation, colorCol)

  // Sort if needed
  if (config.sort === 'ascending') {
    aggregated.sort((a, b) => {
      const av = colorCol ? 0 : Number(a.value)
      const bv = colorCol ? 0 : Number(b.value)
      return av - bv
    })
  } else if (config.sort === 'descending') {
    aggregated.sort((a, b) => {
      const av = colorCol ? 0 : Number(a.value)
      const bv = colorCol ? 0 : Number(b.value)
      return bv - av
    })
  }

  const colorValues = colorCol
    ? [...new Set(data.map(r => r[colorCol] != null ? String(r[colorCol]) : '(null)'))]
    : []

  const yLabel = yCol === 'COUNT'
    ? 'Count'
    : `${aggregation.charAt(0).toUpperCase() + aggregation.slice(1)} of ${yCol}`

  return (
    <ResponsiveContainer width={width} height={height}>
      <ReBarChart data={aggregated} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis
          dataKey="x"
          label={{ value: config.x_label ?? xCol, position: 'insideBottom', offset: -10 }}
          tick={{ fontSize: 12 }}
          angle={-30}
          textAnchor="end"
          interval={0}
          height={60}
        />
        <YAxis
          label={{ value: config.y_label ?? yLabel, angle: -90, position: 'insideLeft', offset: 10 }}
          scale={config.log_scale_y ? 'log' : 'auto'}
          tick={{ fontSize: 12 }}
        />
        <Tooltip />
        {colorValues.length > 0 && <Legend />}

        {colorValues.length > 0
          ? colorValues.map((cv, i) => (
              <Bar key={cv} dataKey={cv} fill={DEFAULT_COLORS[i % DEFAULT_COLORS.length]} radius={[3, 3, 0, 0]}>
                {config.show_values && <LabelList dataKey={cv} position="top" style={{ fontSize: 10 }} />}
              </Bar>
            ))
          : (
            <Bar dataKey="value" radius={[3, 3, 0, 0]}>
              {aggregated.map((_, i) => (
                <Cell key={i} fill={DEFAULT_COLORS[i % DEFAULT_COLORS.length]} />
              ))}
              {config.show_values && (
                <LabelList dataKey="value" position="top" style={{ fontSize: 10 }} />
              )}
            </Bar>
          )
        }
      </ReBarChart>
    </ResponsiveContainer>
  )
}
