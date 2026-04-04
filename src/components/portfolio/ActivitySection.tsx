/**
 * Portfolio Activity Section
 */

'use client'

import React, { useMemo } from 'react'
import type { ActivitySummary } from '@/types/portfolio'

interface ActivitySectionProps {
  activity: ActivitySummary
  isOwner: boolean
}

export function ActivitySection({ activity, isOwner }: ActivitySectionProps) {
  const heatmapData = useMemo(() => {
    const cells: Array<{ day: string; count: number }> = []
    const today = new Date()
    const oneYearAgo = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000)
    const activityMap = new Map(
      (activity.daily_activity || []).map((item) => [item.date, item.count])
    )
    for (let d = new Date(oneYearAgo); d <= today; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0]
      cells.push({ day: dateStr, count: activityMap.get(dateStr) || 0 })
    }
    return cells
  }, [activity.daily_activity])

  const getHeatmapColor = (count: number) => {
    if (count === 0) return '#f1f5f9'
    if (count === 1) return '#bfdbfe'
    if (count === 2) return '#60a5fa'
    if (count === 3) return '#2563eb'
    return '#1e40af'
  }

  const getAnalysisTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      descriptive: 'Descriptive', comparative: 'Comparative',
      inferential: 'Inferential', predictive: 'Predictive',
      causal: 'Causal Inference', qualitative: 'Qualitative',
      mixed: 'Mixed Methods', other: 'Other',
    }
    return labels[type] || type
  }

  const hasContent =
    heatmapData.length > 0 ||
    (activity.analysis_types || []).length > 0 ||
    (activity.geographic_focus || []).length > 0

  if (!hasContent) return null

  return (
    <section className="mb-8">
      <h2 className="text-base font-bold text-slate-900 mb-4">Research Activity</h2>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-6">
        {/* Heatmap */}
        {heatmapData.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Analyses — past 12 months
            </p>
            <div
              className="inline-grid gap-[3px]"
              style={{
                gridTemplateColumns: 'repeat(52, minmax(0, 1fr))',
                gridTemplateRows: 'repeat(7, minmax(0, 1fr))',
              }}
            >
              {heatmapData.map((cell, idx) => (
                <div
                  key={idx}
                  className="w-2.5 h-2.5 rounded-[2px] transition-transform hover:scale-125 cursor-default"
                  style={{ backgroundColor: getHeatmapColor(cell.count) }}
                  title={`${cell.count} ${cell.count === 1 ? 'analysis' : 'analyses'} on ${cell.day}`}
                />
              ))}
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <span className="text-xs text-slate-400">Less</span>
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="w-2.5 h-2.5 rounded-[2px]"
                  style={{ backgroundColor: getHeatmapColor(i) }}
                />
              ))}
              <span className="text-xs text-slate-400">More</span>
            </div>
          </div>
        )}

        {/* Analysis type breakdown */}
        {(activity.analysis_types || []).length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Analysis types
            </p>
            <div className="space-y-2">
              {activity.analysis_types
                .sort((a, b) => b.count - a.count)
                .map((item) => {
                  const total = activity.analysis_types.reduce((s, t) => s + t.count, 0)
                  const pct = Math.round((item.count / total) * 100)
                  return (
                    <div key={item.type}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-slate-600">{getAnalysisTypeLabel(item.type)}</span>
                        <span className="text-xs font-mono text-slate-400">{item.count}</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-clinical-blue transition-all rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        )}

        {/* Geographic focus */}
        {(activity.geographic_focus || []).length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Geographic focus
            </p>
            <div className="flex flex-wrap gap-1.5">
              {activity.geographic_focus.map((region) => (
                <span
                  key={region}
                  className="px-2.5 py-1 text-xs font-medium text-clinical-blue bg-blue-50 border border-blue-100 rounded-md"
                >
                  {region}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
