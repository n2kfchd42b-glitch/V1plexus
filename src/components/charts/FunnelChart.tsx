'use client'

import {
  FunnelChart as ReFunnelChart,
  Funnel,
  LabelList,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import type { ChartConfig, DataRow, ColumnSchema } from '@/types/database'

interface FunnelChartProps {
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

export function FunnelChart({ data, config, columns: _columns, width = '100%' as `${number}%`, height = 400 }: FunnelChartProps) {
  if (!config.x_axis) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Select a category column (stages) to render the funnel chart
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

  const groups = new Map<string, number>()
  for (const row of data) {
    const key = row[xCol] != null ? String(row[xCol]) : '(null)'
    const val = yCol != null ? Number(row[yCol]) : 1
    groups.set(key, (groups.get(key) ?? 0) + (isNaN(val) ? 0 : Math.abs(val)))
  }

  const funnelData = Array.from(groups.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, value], i) => ({ name, value, fill: colors[i % colors.length] }))

  return (
    <ResponsiveContainer width={width} height={height}>
      <ReFunnelChart>
        <Tooltip formatter={(v: unknown) => [Number(v).toLocaleString()]} />
        <Funnel dataKey="value" data={funnelData} isAnimationActive>
          {funnelData.map((entry, i) => (
            <Cell key={entry.name} fill={colors[i % colors.length]} />
          ))}
          <LabelList
            position="right"
            fill="#555"
            stroke="none"
            dataKey="name"
            style={{ fontFamily: 'Manrope, sans-serif', fontSize: 12 }}
          />
        </Funnel>
      </ReFunnelChart>
    </ResponsiveContainer>
  )
}
