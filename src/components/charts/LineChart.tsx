'use client'

import {
  LineChart as ReLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import type { ChartConfig, DataRow, ColumnSchema } from '@/types/database'

interface LineChartProps {
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

function aggregateForLine(
  rows: DataRow[],
  xCol: string,
  yCol: string,
  aggregation: string,
  colorCol?: string
): Array<Record<string, unknown>> {
  const cleanRows = rows.filter(r => r[xCol] != null && r[xCol] !== '')
  const groups = new Map<string, DataRow[]>()
  for (const row of cleanRows) {
    const xVal = String(row[xCol])
    groups.set(xVal, [...(groups.get(xVal) ?? []), row])
  }

  const keys = [...groups.keys()].sort((a, b) => {
    const na = Number(a), nb = Number(b)
    if (!isNaN(na) && !isNaN(nb)) return na - nb
    return a.localeCompare(b)
  })

  if (colorCol && colorCol !== xCol) {
    const colorValues = [...new Set(cleanRows.map(r => r[colorCol] != null ? String(r[colorCol]) : '(null)'))]
    return keys.map(xVal => {
      const xRows = groups.get(xVal) ?? []
      const entry: Record<string, unknown> = { x: xVal }
      for (const cv of colorValues) {
        const subRows = xRows.filter(r => (r[colorCol] != null ? String(r[colorCol]) : '(null)') === cv)
        const nums = subRows.map(r => Number(r[yCol])).filter(n => !isNaN(n))
        entry[cv] = computeAgg(nums, aggregation)
      }
      return entry
    })
  }

  return keys.map(xVal => {
    const xRows = groups.get(xVal) ?? []
    const nums = xRows.map(r => Number(r[yCol])).filter(n => !isNaN(n))
    return { x: xVal, value: computeAgg(nums, aggregation) }
  })
}

export function LineChart({ data, config, columns: _columns, width = ('100%' as `${number}%`), height = 400 }: LineChartProps) {
  if (!config.x_axis || !config.y_axis) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Select X and Y axis variables to render the line chart
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
  const yCol = config.y_axis
  const aggregation = config.aggregation ?? 'mean'
  const colorCol = config.color

  const aggregated = aggregateForLine(data, xCol, yCol, aggregation, colorCol)
  const colorValues = colorCol
    ? [...new Set(data.map(r => r[colorCol] != null ? String(r[colorCol]) : '(null)'))]
    : []

  const yLabel = `${aggregation.charAt(0).toUpperCase() + aggregation.slice(1)} of ${yCol}`

  // Compute trend line if requested (linear regression on single series)
  let trendSlope = 0
  let trendIntercept = 0
  if (config.trend_line && colorValues.length === 0) {
    const points = aggregated.map((d, i) => ({ x: i, y: Number(d.value) })).filter(p => !isNaN(p.y))
    if (points.length > 1) {
      const n = points.length
      const sumX = points.reduce((a, p) => a + p.x, 0)
      const sumY = points.reduce((a, p) => a + p.y, 0)
      const sumXY = points.reduce((a, p) => a + p.x * p.y, 0)
      const sumX2 = points.reduce((a, p) => a + p.x * p.x, 0)
      trendSlope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
      trendIntercept = (sumY - trendSlope * sumX) / n
    }
  }

  return (
    <ResponsiveContainer width={width} height={height}>
      <ReLineChart data={aggregated} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
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
              <Line
                key={cv}
                type="monotone"
                dataKey={cv}
                stroke={DEFAULT_COLORS[i % DEFAULT_COLORS.length]}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            ))
          : (
            <Line
              type="monotone"
              dataKey="value"
              stroke={DEFAULT_COLORS[0]}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          )
        }

        {config.trend_line && colorValues.length === 0 && aggregated.length > 1 && (
          <ReferenceLine
            segment={[
              { x: aggregated[0].x as string, y: trendIntercept },
              { x: aggregated[aggregated.length - 1].x as string, y: trendSlope * (aggregated.length - 1) + trendIntercept },
            ]}
            stroke="#ef4444"
            strokeDasharray="6 3"
            strokeWidth={1.5}
            label={{ value: 'Trend', position: 'right', fill: '#ef4444', fontSize: 11 }}
          />
        )}
      </ReLineChart>
    </ResponsiveContainer>
  )
}
