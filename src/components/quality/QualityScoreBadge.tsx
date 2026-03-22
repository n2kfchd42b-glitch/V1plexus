'use client'

import { Shield } from 'lucide-react'

interface QualityScoreBadgeProps {
  score: number
  size?: 'sm' | 'md'
}

export function QualityScoreBadge({ score, size = 'sm' }: QualityScoreBadgeProps) {
  const cls =
    score >= 90 ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
    score >= 70 ? 'bg-amber-100 text-amber-700 border-amber-200' :
    'bg-red-100 text-red-700 border-red-200'

  if (size === 'md') {
    return (
      <span className={`inline-flex items-center gap-1.5 font-medium px-2.5 py-1 rounded-full border text-sm ${cls}`}>
        <Shield className="h-3.5 w-3.5" />
        {Math.round(score)}/100
      </span>
    )
  }

  return (
    <span className={`inline-flex items-center gap-1 font-medium px-1.5 py-0.5 rounded-full border text-[11px] ${cls}`}>
      <Shield className="h-3 w-3" />
      {Math.round(score)}
    </span>
  )
}
