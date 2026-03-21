'use client'

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import type { ChartConfig, DataRow, ColumnSchema } from '@/types/database'

interface ScatterPlotProps {
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

interface ScatterPoint {
  x: number
  y: number
  label?: string
}

function linearRegression(points: ScatterPoint[]): { slope: number; intercept: number } {
  const n = points.length
  if (n < 2) return { slope: 0, intercept: 0 }
  const sumX = points.reduce((a, p) => a + p.x, 0)
  const sumY = points.reduce((a, p) => a + p.y, 0)
  const sumXY = points.reduce((a, p) => a + p.x * p.y, 0)
  const sumX2 = points.reduce((a, p) => a + p.x * p.x, 0)
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  const intercept = (sumY - slope * sumX) / n
  return { slope, intercept }
}

export function ScatterPlot({ data, config, columns: _columns, width = ('100%' as `${number}%`), height = 400 }: ScatterPlotProps) {
  if (!config.x_axis || !config.y_axis) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Select numeric X and Y axis variables to render the scatter plot
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
  const colorCol = config.color

  // Parse data points
  const parsePoint = (row: DataRow): ScatterPoint | null => {
    const x = Number(row[xCol])
    const y = Number(row[yCol])
    if (isNaN(x) || isNaN(y)) return null
    return { x, y }
  }

  if (colorCol) {
    // Multi-series by color
    const colorValues = [...new Set(data.map(r => r[colorCol] != null ? String(r[colorCol]) : '(null)'))]
    const seriesData = colorValues.map(cv => ({
      name: cv,
      points: data
        .filter(r => (r[colorCol] != null ? String(r[colorCol]) : '(null)') === cv)
        .map(parsePoint)
        .filter((p): p is ScatterPoint => p !== null),
    }))

    return (
      <ResponsiveContainer width={width} height={height}>
        <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis
            dataKey="x"
            type="number"
            name={xCol}
            label={{ value: config.x_label ?? xCol, position: 'insideBottom', offset: -10 }}
            scale={config.log_scale_x ? 'log' : 'auto'}
            tick={{ fontSize: 12 }}
          />
          <YAxis
            dataKey="y"
            type="number"
            name={yCol}
            label={{ value: config.y_label ?? yCol, angle: -90, position: 'insideLeft', offset: 10 }}
            scale={config.log_scale_y ? 'log' : 'auto'}
            tick={{ fontSize: 12 }}
          />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} />
          <Legend />
          {seriesData.map((s, i) => (
            <Scatter
              key={s.name}
              name={s.name}
              data={s.points}
              fill={DEFAULT_COLORS[i % DEFAULT_COLORS.length]}
              opacity={0.7}
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    )
  }

  // Single series
  const points = data.map(parsePoint).filter((p): p is ScatterPoint => p !== null)
  const { slope, intercept } = config.trend_line ? linearRegression(points) : { slope: 0, intercept: 0 }
  const xVals = points.map(p => p.x)
  const xMin = Math.min(...xVals)
  const xMax = Math.max(...xVals)

  return (
    <ResponsiveContainer width={width} height={height}>
      <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis
          dataKey="x"
          type="number"
          name={xCol}
          label={{ value: config.x_label ?? xCol, position: 'insideBottom', offset: -10 }}
          scale={config.log_scale_x ? 'log' : 'auto'}
          tick={{ fontSize: 12 }}
        />
        <YAxis
          dataKey="y"
          type="number"
          name={yCol}
          label={{ value: config.y_label ?? yCol, angle: -90, position: 'insideLeft', offset: 10 }}
          scale={config.log_scale_y ? 'log' : 'auto'}
          tick={{ fontSize: 12 }}
        />
        <Tooltip cursor={{ strokeDasharray: '3 3' }} />
        <Scatter data={points} fill={DEFAULT_COLORS[0]} opacity={0.7} />
        {config.trend_line && points.length > 1 && (
          <ReferenceLine
            segment={[
              { x: xMin, y: slope * xMin + intercept },
              { x: xMax, y: slope * xMax + intercept },
            ]}
            stroke="#ef4444"
            strokeDasharray="6 3"
            strokeWidth={1.5}
            label={{ value: 'Trend', position: 'right', fill: '#ef4444', fontSize: 11 }}
          />
        )}
      </ScatterChart>
    </ResponsiveContainer>
  )
}
