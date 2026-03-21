'use client'

import {
  PieChart as RePieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { ChartConfig, DataRow, ColumnSchema, ChartType } from '@/types/database'

interface PieChartProps {
  data: DataRow[]
  config: ChartConfig
  columns: ColumnSchema[]
  chartType?: ChartType
  width?: number | `${number}%`
  height?: number | `${number}%`
}

const DEFAULT_COLORS = [
  '#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#14b8a6', '#f97316', '#84cc16',
  '#a78bfa', '#34d399', '#fbbf24', '#f87171', '#60a5fa',
]

interface PieEntry {
  name: string
  value: number
}

function computeAgg(nums: number[], aggregation: string): number {
  if (nums.length === 0) return 0
  switch (aggregation) {
    case 'count': return nums.length
    case 'sum': return nums.reduce((a, b) => a + b, 0)
    case 'mean': return nums.reduce((a, b) => a + b, 0) / nums.length
    case 'min': return Math.min(...nums)
    case 'max': return Math.max(...nums)
    default: return nums.length
  }
}

interface CustomLabelProps {
  cx?: number
  cy?: number
  midAngle?: number
  innerRadius?: number
  outerRadius?: number
  percent?: number
  name?: string
}

function renderCustomLabel({ cx = 0, cy = 0, midAngle = 0, innerRadius = 0, outerRadius = 0, percent = 0 }: CustomLabelProps) {
  if (percent < 0.04) return null
  const RADIAN = Math.PI / 180
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={500}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

export function PieChart({ data, config, columns: _columns, chartType = 'pie', width = ('100%' as `${number}%`), height = 400 }: PieChartProps) {
  if (!config.x_axis) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Select a categorical variable (X axis) for the pie chart
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
  const aggregation = config.aggregation ?? 'count'

  // Group by x column
  const groups = new Map<string, DataRow[]>()
  for (const row of data) {
    const xVal = row[xCol] != null ? String(row[xCol]) : '(null)'
    const arr = groups.get(xVal) ?? []
    arr.push(row)
    groups.set(xVal, arr)
  }

  const pieData: PieEntry[] = Array.from(groups.entries()).map(([name, rows]) => {
    let value: number
    if (!yCol || aggregation === 'count') {
      value = rows.length
    } else {
      const nums = rows.map(r => Number(r[yCol])).filter(n => !isNaN(n))
      value = computeAgg(nums, aggregation)
    }
    return { name, value: Math.max(0, value) }
  }).filter(d => d.value > 0)

  // Sort descending by value
  pieData.sort((a, b) => b.value - a.value)

  const isDonut = chartType === 'donut'
  const innerRadius = isDonut ? '40%' : 0

  return (
    <ResponsiveContainer width={width} height={height}>
      <RePieChart>
        <Pie
          data={pieData}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius="70%"
          innerRadius={innerRadius}
          labelLine={false}
          label={renderCustomLabel}
        >
          {pieData.map((_, i) => (
            <Cell key={i} fill={DEFAULT_COLORS[i % DEFAULT_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value, name) => [typeof value === 'number' ? value.toLocaleString() : value, name]}
        />
        <Legend
          layout="vertical"
          align="right"
          verticalAlign="middle"
          iconType="circle"
          formatter={(value) => <span style={{ fontSize: 12 }}>{value}</span>}
        />
      </RePieChart>
    </ResponsiveContainer>
  )
}
