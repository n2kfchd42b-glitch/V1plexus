/**
 * Portfolio Activity Section
 * Shows research activity visualization including heatmap, analysis types, and geographic focus
 */

'use client'

import React, { useMemo } from 'react'
import type { ActivitySummary } from '@/types/portfolio'

interface ActivitySectionProps {
  activity: ActivitySummary
  isOwner: boolean
}

export function ActivitySection({ activity, isOwner }: ActivitySectionProps) {
  // Generate heatmap grid - 52 weeks × 7 days = 364 grid cells
  const heatmapData = useMemo(() => {
    const cells: Array<{ day: string; count: number }> = []
    const today = new Date()
    const oneYearAgo = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000)

    // Create map of dates to activity counts from activity.daily_activity
    const activityMap = new Map(
      (activity.daily_activity || []).map((item) => [item.date, item.count])
    )

    // Generate cells from one year ago to today
    for (let d = new Date(oneYearAgo); d <= today; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0]
      cells.push({
        day: dateStr,
        count: activityMap.get(dateStr) || 0,
      })
    }

    return cells
  }, [activity.daily_activity])

  const getHeatmapColor = (count: number): string => {
    if (count === 0) return '#fafafa'
    if (count === 1) return '#c7e9c0'
    if (count === 2) return '#86c5b0'
    if (count === 3) return '#41ab9d'
    return '#005a87'
  }

  const getAnalysisTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      descriptive: 'Descriptive',
      comparative: 'Comparative',
      inferential: 'Inferential',
      predictive: 'Predictive',
      causal: 'Causal Inference',
      qualitative: 'Qualitative',
      mixed: 'Mixed Methods',
      other: 'Other',
    }
    return labels[type] || type
  }

  return (
    <div className="mt-16 border-t border-surface-container pt-16">
      <h2 className="text-2xl font-bold tracking-tight text-on-surface mb-8">
        Research Activity
      </h2>

      {/* Activity Heatmap */}
      {heatmapData.length > 0 && (
        <div className="mb-12">
          <p className="text-sm font-semibold text-on-surface-variant mb-4">
            Analyses over the past 12 months
          </p>
          <div
            className="inline-grid gap-1"
            style={{
              gridTemplateColumns: 'repeat(52, minmax(0, 1fr))',
              gridTemplateRows: 'repeat(7, minmax(0, 1fr))',
            }}
          >
            {heatmapData.map((cell, idx) => (
              <div
                key={idx}
                className="w-3 h-3 rounded-sm transition-all hover:ring-2 hover:ring-primary hover:scale-125 cursor-pointer"
                style={{
                  backgroundColor: getHeatmapColor(cell.count),
                  boxShadow:
                    cell.count > 0
                      ? `0 0 0 1px rgba(0, 61, 155, 0.1)`
                      : 'none',
                }}
                title={`${cell.count} analyses on ${cell.day}`}
              />
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2">
            <span className="text-xs text-on-surface-variant">Less</span>
            <div className="flex gap-1">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="w-3 h-3 rounded-sm"
                  style={{
                    backgroundColor: getHeatmapColor(i),
                    border: i > 0 ? '1px solid rgba(0, 61, 155, 0.1)' : 'none',
                  }}
                />
              ))}
            </div>
            <span className="text-xs text-on-surface-variant">More</span>
          </div>
        </div>
      )}

      {/* Analysis Types Breakdown */}
      {(activity.analysis_types || []).length > 0 && (
        <div className="mb-12">
          <p className="text-sm font-semibold text-on-surface-variant mb-4">
            Analysis types conducted
          </p>
          <div className="space-y-3">
            {activity.analysis_types
              .sort((a, b) => b.count - a.count)
              .map((item) => {
                const percentage = Math.round(
                  (item.count /
                    activity.analysis_types.reduce((sum, t) => sum + t.count, 0)) *
                    100
                )
                return (
                  <div key={item.type}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-sm text-on-surface">
                        {getAnalysisTypeLabel(item.type)}
                      </label>
                      <span className="text-xs font-mono text-on-surface-variant">
                        {item.count}
                      </span>
                    </div>
                    <div className="h-2 bg-surface-container rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* Geographic Focus */}
      {(activity.geographic_focus || []).length > 0 && (
        <div>
          <p className="text-sm font-semibold text-on-surface-variant mb-4">
            Geographic focus
          </p>
          <div className="flex flex-wrap gap-2">
            {activity.geographic_focus.map((region) => (
              <div
                key={region}
                className="px-3 py-1 bg-primary-container text-primary text-xs font-semibold rounded-full"
              >
                {region}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
