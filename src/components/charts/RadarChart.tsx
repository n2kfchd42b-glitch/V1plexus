'use client'

import {
  RadarChart as ReRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { ChartConfig, DataRow, ColumnSchema } from '@/types/database'

interface RadarChartProps {
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

export function RadarChart({ data, config, columns: _columns, width = '100%' as `${number}%`, height = 400 }: RadarChartProps) {
  if (!config.x_axis || !config.y_axis) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Select a category (X) and a numeric value (Y) to render the radar chart
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
  const colors = PALETTES[config.palette ?? 'default']

  if (colorCol) {
    const categories = [...new Set(data.map(r => r[xCol] != null ? String(r[xCol]) : '(null)'))]
    const seriesValues = [...new Set(data.map(r => r[colorCol] != null ? String(r[colorCol]) : '(null)'))]

    const radarData = categories.map(cat => {
      const entry: Record<string, unknown> = { subject: cat }
      for (const sv of seriesValues) {
        const matching = data.filter(r =>
          (r[xCol] != null ? String(r[xCol]) : '(null)') === cat &&
          (r[colorCol] != null ? String(r[colorCol]) : '(null)') === sv
        )
        const nums = matching.map(r => Number(r[yCol])).filter(n => !isNaN(n))
        entry[sv] = nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 0
      }
      return entry
    })

    return (
      <ResponsiveContainer width={width} height={height}>
        <ReRadarChart data={radarData} margin={{ top: 10, right: 40, left: 40, bottom: 10 }}>
          <PolarGrid />
          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12, fontFamily: 'Manrope, sans-serif' }} />
          <PolarRadiusAxis tick={{ fontSize: 10 }} />
          <Tooltip />
          <Legend />
          {seriesValues.map((sv, i) => (
            <Radar
              key={sv}
              name={sv}
              dataKey={sv}
              stroke={colors[i % colors.length]}
              fill={colors[i % colors.length]}
              fillOpacity={0.25}
            />
          ))}
        </ReRadarChart>
      </ResponsiveContainer>
    )
  }

  const categories = [...new Set(data.map(r => r[xCol] != null ? String(r[xCol]) : '(null)'))]
  const radarData = categories.map(cat => {
    const rows = data.filter(r => (r[xCol] != null ? String(r[xCol]) : '(null)') === cat)
    const nums = rows.map(r => Number(r[yCol])).filter(n => !isNaN(n))
    const value = nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 0
    return { subject: cat, value }
  })

  return (
    <ResponsiveContainer width={width} height={height}>
      <ReRadarChart data={radarData} margin={{ top: 10, right: 40, left: 40, bottom: 10 }}>
        <PolarGrid />
        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12, fontFamily: 'Manrope, sans-serif' }} />
        <PolarRadiusAxis tick={{ fontSize: 10 }} />
        <Tooltip />
        <Radar
          name={yCol}
          dataKey="value"
          stroke={colors[0]}
          fill={colors[0]}
          fillOpacity={0.3}
        />
      </ReRadarChart>
    </ResponsiveContainer>
  )
}
