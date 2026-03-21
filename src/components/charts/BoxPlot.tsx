'use client'

import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ErrorBar,
  Scatter,
} from 'recharts'
import type { ChartConfig, DataRow, ColumnSchema } from '@/types/database'

interface BoxPlotProps {
  data: DataRow[]
  config: ChartConfig
  columns: ColumnSchema[]
  width?: number | `${number}%`
  height?: number | `${number}%`
}

interface BoxStats {
  x: string
  min: number
  q1: number
  median: number
  q3: number
  max: number
  iqr: number
  whiskerLow: number
  whiskerHigh: number
  outliers: number[]
  // For recharts bar rendering: bar starts at q1, height = q3-q1
  barBase: number
  barHeight: number
  // Error bars from median to whiskers
  medianLow: number
  medianHigh: number
}

function computeQuantile(sorted: number[], p: number): number {
  const idx = p * (sorted.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}

function computeBoxStats(values: number[], label: string): BoxStats {
  const sorted = [...values].sort((a, b) => a - b)
  const q1 = computeQuantile(sorted, 0.25)
  const median = computeQuantile(sorted, 0.5)
  const q3 = computeQuantile(sorted, 0.75)
  const iqr = q3 - q1
  const whiskerLow = Math.max(sorted[0], q1 - 1.5 * iqr)
  const whiskerHigh = Math.min(sorted[sorted.length - 1], q3 + 1.5 * iqr)
  const outliers = sorted.filter(v => v < whiskerLow || v > whiskerHigh)
  return {
    x: label,
    min: sorted[0],
    q1,
    median,
    q3,
    max: sorted[sorted.length - 1],
    iqr,
    whiskerLow,
    whiskerHigh,
    outliers,
    barBase: q1,
    barHeight: q3 - q1,
    medianLow: median - whiskerLow,
    medianHigh: whiskerHigh - median,
  }
}

const DEFAULT_COLORS = [
  '#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#14b8a6', '#f97316', '#84cc16',
]

interface CustomBoxTooltipProps {
  active?: boolean
  payload?: Array<{ payload: BoxStats }>
}

function CustomBoxTooltip({ active, payload }: CustomBoxTooltipProps) {
  if (!active || !payload || !payload[0]) return null
  const d = payload[0].payload
  return (
    <div className="bg-background border border-border rounded p-2 text-xs shadow-md">
      <div className="font-medium mb-1">{d.x}</div>
      <div>Max: {d.max.toFixed(2)}</div>
      <div>Q3: {d.q3.toFixed(2)}</div>
      <div>Median: {d.median.toFixed(2)}</div>
      <div>Q1: {d.q1.toFixed(2)}</div>
      <div>Min: {d.min.toFixed(2)}</div>
      {d.outliers.length > 0 && <div>Outliers: {d.outliers.length}</div>}
    </div>
  )
}

export function BoxPlot({ data, config, columns: _columns, width = ('100%' as `${number}%`), height = 400 }: BoxPlotProps) {
  if (!config.y_axis) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Select a numeric Y axis variable for the box plot
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

  const yCol = config.y_axis
  const xCol = config.x_axis

  let boxData: BoxStats[] = []

  if (xCol) {
    // Group by x column
    const groups = new Map<string, number[]>()
    for (const row of data) {
      const xVal = row[xCol] != null ? String(row[xCol]) : '(null)'
      const yVal = Number(row[yCol])
      if (!isNaN(yVal)) {
        const arr = groups.get(xVal) ?? []
        arr.push(yVal)
        groups.set(xVal, arr)
      }
    }
    boxData = Array.from(groups.entries())
      .filter(([, vals]) => vals.length >= 4)
      .map(([label, vals]) => computeBoxStats(vals, label))
  } else {
    // Single box for entire column
    const values = data.map(r => Number(r[yCol])).filter(n => !isNaN(n))
    if (values.length < 4) {
      return (
        <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
          Not enough numeric values in &quot;{yCol}&quot; (need at least 4)
        </div>
      )
    }
    boxData = [computeBoxStats(values, yCol)]
  }

  if (boxData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        No groups with enough data to render box plots
      </div>
    )
  }

  // Build outlier scatter data
  const outlierPoints = boxData.flatMap(d =>
    d.outliers.map(v => ({ x: d.x, y: v }))
  )

  return (
    <ResponsiveContainer width={width} height={height}>
      <ComposedChart
        data={boxData}
        margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
      >
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis
          dataKey="x"
          label={{ value: config.x_label ?? (xCol ?? ''), position: 'insideBottom', offset: -10 }}
          tick={{ fontSize: 12 }}
          height={60}
        />
        <YAxis
          label={{ value: config.y_label ?? yCol, angle: -90, position: 'insideLeft', offset: 10 }}
          tick={{ fontSize: 12 }}
        />
        <Tooltip content={<CustomBoxTooltip />} />

        {/* IQR box: starts at q1, height = iqr */}
        <Bar dataKey="barHeight" stackId="box" fill="transparent" stroke="none" isAnimationActive={false}>
          {boxData.map((_, i) => (
            <Cell key={i} fill={DEFAULT_COLORS[i % DEFAULT_COLORS.length]} fillOpacity={0.4} />
          ))}
        </Bar>

        {/* Whisker bars via ErrorBar on a zero-height bar at median */}
        <Bar
          dataKey="median"
          stackId="whisker"
          fill="transparent"
          stroke="none"
          isAnimationActive={false}
          barSize={20}
        >
          {boxData.map((_, i) => (
            <Cell key={i} fill="transparent" />
          ))}
          <ErrorBar dataKey="medianLow" width={8} strokeWidth={2} stroke={DEFAULT_COLORS[0]} direction="y" />
          <ErrorBar dataKey="medianHigh" width={8} strokeWidth={2} stroke={DEFAULT_COLORS[0]} direction="y" />
        </Bar>

        {/* Outliers */}
        {outlierPoints.length > 0 && (
          <Scatter
            data={outlierPoints}
            dataKey="y"
            fill="#ef4444"
            opacity={0.6}
            shape="circle"
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  )
}
