import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { EnumeratorMetric, EnumeratorFlagStatus } from '@/types/qualityIntelligence'

interface EnumeratorQualityPanelProps {
  metrics: Record<string, EnumeratorMetric> | null
  isLoading?: boolean
}

export function EnumeratorQualityPanel({ metrics, isLoading }: EnumeratorQualityPanelProps) {
  if (isLoading) {
    return <div className="text-center py-8 text-gray-600">Loading enumerator metrics...</div>
  }

  if (!metrics || Object.keys(metrics).length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-sm text-gray-600">No enumerator metrics available for this dataset.</div>
        </CardContent>
      </Card>
    )
  }

  const getFlagBadgeVariant = (status: EnumeratorFlagStatus): 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' => {
    switch (status) {
      case 'clean':
        return 'success'
      case 'review':
        return 'warning'
      case 'investigate':
        return 'destructive'
    }
  }

  const enumerators = Object.entries(metrics).sort((a, b) => {
    // Sort by flag status (investigate first) then by record count
    const flagOrder: Record<EnumeratorFlagStatus, number> = { investigate: 0, review: 1, clean: 2 }
    const flagDiff = flagOrder[a[1].flag_status] - flagOrder[b[1].flag_status]
    return flagDiff !== 0 ? flagDiff : b[1].record_count - a[1].record_count
  })

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left font-semibold text-gray-900">Enumerator</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Records</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Missingness</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Outliers</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Response Score</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Completion (min)</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {enumerators.map(([enumeratorId, metric]: [string, EnumeratorMetric]) => (
                <tr key={enumeratorId} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-900">{enumeratorId}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{metric.record_count}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={metric.overall_missingness_rate > 0.1 ? 'text-red-600 font-semibold' : 'text-gray-600'}>
                      {(metric.overall_missingness_rate * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={metric.outlier_rate > 0.05 ? 'text-amber-600 font-semibold' : 'text-gray-600'}>
                      {(metric.outlier_rate * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {(metric.response_pattern_score * 100).toFixed(0)}%
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {metric.avg_completion_time_mins !== null ? (
                      <>
                        <span className={metric.fast_completion_flag ? 'text-red-600 font-semibold' : ''}>
                          {metric.avg_completion_time_mins.toFixed(0)}
                        </span>
                        {metric.fast_completion_flag && <span className="ml-1 text-xs text-red-600">⚡</span>}
                      </>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={getFlagBadgeVariant(metric.flag_status)}>
                      {metric.flag_status.toUpperCase()}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* High Missingness Columns Detail */}
      {enumerators.some(([, m]) => m.high_missingness_columns.length > 0) && (
        <div className="border border-amber-200 rounded-lg p-4 bg-amber-50">
          <h3 className="font-semibold text-amber-900 mb-3">High Missingness Columns by Enumerator</h3>
          <div className="space-y-2">
            {enumerators
              .filter(([, m]: [string, EnumeratorMetric]) => m.high_missingness_columns.length > 0)
              .map(([enumeratorId, metric]: [string, EnumeratorMetric]) => (
                <div key={enumeratorId} className="text-sm text-amber-800">
                  <strong className="font-mono">{enumeratorId}:</strong>
                  {' '}
                  {metric.high_missingness_columns.map(col => (
                    <span key={col.column} className="inline-block mr-3">
                      {col.column} ({(col.missing_rate * 100).toFixed(0)}%)
                    </span>
                  ))}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Flag Reasons Detail */}
      {enumerators.some(([, m]) => m.flag_reasons.length > 0) && (
        <div className="border border-red-200 rounded-lg p-4 bg-red-50">
          <h3 className="font-semibold text-red-900 mb-3">Flagged Enumerators - Reasons</h3>
          <div className="space-y-3">
            {enumerators
              .filter(([, m]: [string, EnumeratorMetric]) => m.flag_reasons.length > 0)
              .map(([enumeratorId, metric]: [string, EnumeratorMetric]) => (
                <div key={enumeratorId} className="text-sm">
                  <div className="font-mono font-semibold text-red-900 mb-1">{enumeratorId}</div>
                  <ul className="list-disc list-inside space-y-1 text-red-800 ml-2">
                    {metric.flag_reasons.map((reason: string, idx: number) => (
                      <li key={idx}>{reason}</li>
                    ))}
                  </ul>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
