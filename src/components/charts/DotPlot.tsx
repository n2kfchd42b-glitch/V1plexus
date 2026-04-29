'use client'

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import type { ChartConfig, DataRow, ColumnSchema } from '@/types/database'

interface DotPlotProps {
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

interface DotPoint { x: number; y: number; cat: string }

export function DotPlot({ data, config, columns: _columns, width = '100%' as `${number}%`, height = 400 }: DotPlotProps) {
  if (!config.y_axis) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Select a numeric Y axis to render the dot plot
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
  const colors = PALETTES[config.palette ?? 'default']

  if (!xCol) {
    // Single group — all dots at x=0
    const points: DotPoint[] = data
      .map(row => {
        const y = Number(row[yCol])
        return isNaN(y) ? null : { x: 0, y, cat: yCol }
      })
      .filter((p): p is DotPoint => p !== null)

    return (
      <ResponsiveContainer width={width} height={height}>
        <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis
            dataKey="x"
            type="number"
            domain={[-1, 1]}
            ticks={[0]}
            tickFormatter={() => yCol}
            tick={{ fontSize: 12 }}
          />
          <YAxis
            dataKey="y"
            type="number"
            name={yCol}
            label={{ value: config.y_label ?? yCol, angle: -90, position: 'insideLeft', offset: 10 }}
            tick={{ fontSize: 12 }}
          />
          <Tooltip />
          <Scatter data={points} fill={colors[0]} opacity={0.55} />
        </ScatterChart>
      </ResponsiveContainer>
    )
  }

  const cleanData = data.filter(r => r[xCol] != null && r[xCol] !== '')
  const categories = [...new Set(cleanData.map(r => String(r[xCol])))]
  const catIndex = Object.fromEntries(categories.map((c, i) => [c, i]))

  const allPoints: DotPoint[] = cleanData
    .map(row => {
      const cat = String(row[xCol])
      const y = Number(row[yCol])
      return isNaN(y) ? null : { x: catIndex[cat], y, cat }
    })
    .filter((p): p is DotPoint => p !== null)

  // Separate points by category for per-group coloring
  const seriesData = categories.map((cat, i) => ({
    cat,
    color: colors[i % colors.length],
    points: allPoints.filter(p => p.cat === cat),
  }))

  const ticks = categories.map((_, i) => i)

  return (
    <ResponsiveContainer width={width} height={height}>
      <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis
          dataKey="x"
          type="number"
          domain={[-0.5, categories.length - 0.5]}
          ticks={ticks}
          tickFormatter={v => categories[v as number] ?? ''}
          tick={{ fontSize: 11 }}
          interval={0}
          label={{ value: config.x_label ?? xCol, position: 'insideBottom', offset: -10 }}
        />
        <YAxis
          dataKey="y"
          type="number"
          name={yCol}
          label={{ value: config.y_label ?? yCol, angle: -90, position: 'insideLeft', offset: 10 }}
          tick={{ fontSize: 12 }}
        />
        <Tooltip
          content={({ payload }) => {
            if (!payload?.length) return null
            const { cat, y } = payload[0].payload as DotPoint
            return (
              <div className="rounded-lg border bg-white px-3 py-2 text-xs shadow-md" style={{ fontFamily: 'Manrope, sans-serif' }}>
                <div className="font-semibold">{cat}</div>
                <div>{yCol}: <span className="font-medium">{y}</span></div>
              </div>
            )
          }}
        />
        {seriesData.map(s => (
          <Scatter key={s.cat} data={s.points} opacity={0.6}>
            {s.points.map((_p, i) => (
              <Cell key={i} fill={s.color} />
            ))}
          </Scatter>
        ))}
        {categories.map((_, i) =>
          i > 0 ? <ReferenceLine key={i} x={i - 0.5} stroke="#e5e7eb" strokeWidth={1} /> : null
        )}
      </ScatterChart>
    </ResponsiveContainer>
  )
}
