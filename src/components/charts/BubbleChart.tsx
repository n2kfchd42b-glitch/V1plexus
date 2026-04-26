'use client'

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import type { ChartConfig, DataRow, ColumnSchema } from '@/types/database'

interface BubbleChartProps {
  data: DataRow[]
  config: ChartConfig
  columns: ColumnSchema[]
  width?: number | `${number}%`
  height?: number | `${number}%`
}

const PALETTES: Record<string, string[]> = {
  default: ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#f97316', '#84cc16'],
  ggplot:  ['#F8766D', '#7CAE00', '#00BFC4', '#C77CFF', '#FF7F00', '#A3A500', '#00B0F6', '#E76BF3'],
  tableau: ['#4E79A7', '#F28E2B', '#E15759', '#76B7B2', '#59A14F', '#EDC948', '#B07AA1', '#FF9DA7'],
  cool:    ['#00BFC4', '#619CFF', '#5E81F4', '#00A9FF', '#00C5CD', '#4682B4', '#6A5ACD', '#00BFFF'],
}

interface BubblePoint { x: number; y: number; z: number }

export function BubbleChart({ data, config, columns: _columns, width = '100%' as `${number}%`, height = 400 }: BubbleChartProps) {
  if (!config.x_axis || !config.y_axis) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Select numeric X and Y axes to render the bubble chart
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
  const sizeCol = config.size
  const colorCol = config.color
  const colors = PALETTES[config.palette ?? 'default']

  const parsePoint = (row: DataRow): BubblePoint | null => {
    const x = Number(row[xCol])
    const y = Number(row[yCol])
    if (isNaN(x) || isNaN(y)) return null
    const rawZ = sizeCol != null ? Number(row[sizeCol]) : 1
    return { x, y, z: isNaN(rawZ) || rawZ <= 0 ? 1 : rawZ }
  }

  if (colorCol) {
    const groups = [...new Set(data.map(r => r[colorCol] != null ? String(r[colorCol]) : '(null)'))]
    const seriesData = groups.map(g => ({
      name: g,
      points: data
        .filter(r => (r[colorCol] != null ? String(r[colorCol]) : '(null)') === g)
        .map(parsePoint)
        .filter((p): p is BubblePoint => p !== null),
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
          <ZAxis dataKey="z" range={[40, 800]} name={sizeCol ?? 'size'} />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} />
          <Legend />
          {seriesData.map((s, i) => (
            <Scatter key={s.name} name={s.name} data={s.points} fill={colors[i % colors.length]} opacity={0.65} />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    )
  }

  const points = data.map(parsePoint).filter((p): p is BubblePoint => p !== null)
  const singleColor = colors[0]

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
        <ZAxis dataKey="z" range={[40, 800]} name={sizeCol ?? 'size'} />
        <Tooltip cursor={{ strokeDasharray: '3 3' }} />
        <Scatter data={points} opacity={0.65}>
          {points.map((_p, i) => (
            <Cell key={i} fill={singleColor} />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  )
}
