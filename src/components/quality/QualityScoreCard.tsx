'use client'

import { Shield } from 'lucide-react'
import type { DataQualityScore } from '@/types/database'

interface QualityScoreCardProps {
  score: DataQualityScore
}

export function QualityScoreCard({ score }: QualityScoreCardProps) {
  const overall = Math.round(score.overall_score)
  const barColor = overall >= 90 ? 'bg-emerald-500' : overall >= 70 ? 'bg-amber-500' : 'bg-red-500'
  const labelColor = overall >= 90 ? 'text-emerald-600' : overall >= 70 ? 'text-amber-600' : 'text-red-600'

  const dimensions = [
    { label: 'Completeness', value: score.completeness },
    { label: 'Validity', value: score.validity },
    { label: 'Uniqueness', value: score.uniqueness },
    { label: 'Consistency', value: score.consistency },
  ].filter(d => d.value !== null && d.value !== undefined)

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white space-y-4">
      <div className="flex items-center gap-3">
        <div className={`flex items-center justify-center h-12 w-12 rounded-full border-2 ${overall >= 90 ? 'border-emerald-400' : overall >= 70 ? 'border-amber-400' : 'border-red-400'}`}>
          <Shield className={`h-5 w-5 ${labelColor}`} />
        </div>
        <div>
          <div className={`text-2xl font-bold ${labelColor}`}>{overall}<span className="text-base font-normal text-gray-400">/100</span></div>
          <p className="text-xs text-gray-500">Overall quality score</p>
        </div>
        <div className="ml-auto text-right">
          <div className="text-sm font-medium text-red-600">{score.errors_count} errors</div>
          <div className="text-sm font-medium text-amber-600">{score.warnings_count} warnings</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${overall}%` }} />
      </div>

      {/* Dimension breakdown */}
      {dimensions.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {dimensions.map(d => (
            <div key={d.label} className="flex items-center justify-between text-xs text-gray-600 p-2 bg-gray-50 rounded">
              <span>{d.label}</span>
              <span className="font-medium">{Math.round(d.value!)}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
