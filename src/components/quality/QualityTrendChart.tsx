'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { DataQualityScore } from '@/types/database'

interface QualityTrendChartProps {
  scores: DataQualityScore[]
}

export function QualityTrendChart({ scores }: QualityTrendChartProps) {
  if (scores.length < 2) return null

  const data = scores
    .slice()
    .reverse()
    .map((s, i) => ({
      version: `v${i + 1}`,
      score: Math.round(s.overall_score),
    }))

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      <h4 className="text-sm font-medium text-gray-700 mb-3">Quality Trend</h4>
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
          <XAxis dataKey="version" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={30} />
          <Tooltip
            contentStyle={{ fontSize: 12, border: '1px solid #E5E7EB', borderRadius: 8 }}
            formatter={(v) => [`${v}/100`, 'Score']}
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke="#10B981"
            strokeWidth={2}
            dot={{ fill: '#10B981', r: 4 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
