'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts'

interface TrendDataPoint {
  period: string
  publications: number
  datasets: number
  analyses: number
}

interface OutputTrendChartProps {
  data?: TrendDataPoint[]
}

const SAMPLE_DATA: TrendDataPoint[] = [
  { period: '2024-Q1', publications: 3, datasets: 8,  analyses: 22 },
  { period: '2024-Q2', publications: 5, datasets: 12, analyses: 31 },
  { period: '2024-Q3', publications: 4, datasets: 15, analyses: 28 },
  { period: '2024-Q4', publications: 6, datasets: 18, analyses: 44 },
  { period: '2025-Q1', publications: 4, datasets: 14, analyses: 35 },
  { period: '2025-Q2', publications: 7, datasets: 20, analyses: 52 },
  { period: '2025-Q3', publications: 5, datasets: 17, analyses: 41 },
  { period: '2025-Q4', publications: 8, datasets: 22, analyses: 58 },
  { period: '2026-Q1', publications: 4, datasets: 9,  analyses: 23 },
]

export function OutputTrendChart({ data }: OutputTrendChartProps) {
  const chartData = data ?? SAMPLE_DATA

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={chartData} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
        <XAxis
          dataKey="period"
          tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
        <Line
          type="monotone"
          dataKey="publications"
          stroke="#3B82F6"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
          name="Publications"
        />
        <Line
          type="monotone"
          dataKey="datasets"
          stroke="#10B981"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
          name="Datasets"
        />
        <Line
          type="monotone"
          dataKey="analyses"
          stroke="#8B5CF6"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
          name="Analyses"
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
