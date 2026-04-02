import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { WaveConsistencyReport, Inconsistency, DistributionShift } from '@/types/qualityIntelligence'

interface WaveConsistencyPanelProps {
  report: WaveConsistencyReport
  isLoading?: boolean
}

export function WaveConsistencyPanel({ report, isLoading }: WaveConsistencyPanelProps) {
  if (isLoading) {
    return <div className="text-center py-8 text-gray-600">Loading wave comparison...</div>
  }

  const consistencyStatusVariant = (score: number): 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' => {
    if (score >= 80) return 'success'
    if (score >= 60) return 'warning'
    return 'destructive'
  }

  const getInconsistencySeverityColor = (severity: 'critical' | 'warning') => {
    return severity === 'critical' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
  }

  const getInconsistencySeverityTextColor = (severity: 'critical' | 'warning') => {
    return severity === 'critical' ? 'text-red-900' : 'text-amber-900'
  }

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>Wave Consistency Analysis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-gray-600 uppercase tracking-wide font-semibold">Wave A Participants</div>
              <div className="text-2xl font-bold mt-1">{report.participants_wave_a}</div>
            </div>
            <div>
              <div className="text-xs text-gray-600 uppercase tracking-wide font-semibold">Wave B Participants</div>
              <div className="text-2xl font-bold mt-1">{report.participants_wave_b}</div>
            </div>
            <div>
              <div className="text-xs text-gray-600 uppercase tracking-wide font-semibold">Matched</div>
              <div className="text-2xl font-bold mt-1 text-green-600">{report.matched_participants}</div>
            </div>
            <div>
              <div className="text-xs text-gray-600 uppercase tracking-wide font-semibold">Consistency Score</div>
              <div className="mt-1">
                <Badge variant={consistencyStatusVariant(report.consistency_score)}>
                  {report.consistency_score.toFixed(0)}/100
                </Badge>
              </div>
            </div>
          </div>

          {/* Participant Matching Summary */}
          <div className="border-t border-gray-200 pt-4 grid grid-cols-3 gap-4 text-sm text-gray-600">
            <div>
              <div className="font-semibold text-gray-900">Only in Wave A</div>
              <div className="text-lg font-bold text-amber-600 mt-1">{report.only_in_wave_a}</div>
            </div>
            <div>
              <div className="font-semibold text-gray-900">Matching Rate</div>
              <div className="text-lg font-bold text-green-600 mt-1">
                {((report.matched_participants / Math.max(report.participants_wave_a, report.participants_wave_b)) * 100).toFixed(1)}%
              </div>
            </div>
            <div>
              <div className="font-semibold text-gray-900">Only in Wave B</div>
              <div className="text-lg font-bold text-amber-600 mt-1">{report.only_in_wave_b}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Inconsistencies */}
      {report.inconsistencies.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-900">Inconsistencies Detected</h3>
          {report.inconsistencies.map((inconsistency: Inconsistency, idx: number) => (
            <div key={idx} className={`border rounded-lg p-4 ${getInconsistencySeverityColor(inconsistency.severity)}`}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className={`font-semibold ${getInconsistencySeverityTextColor(inconsistency.severity)}`}>
                    {inconsistency.variable}
                  </h4>
                  <p className={`text-sm mt-1 ${getInconsistencySeverityTextColor(inconsistency.severity)}`}>
                    {inconsistency.message}
                  </p>
                </div>
                <Badge variant={inconsistency.severity === 'critical' ? 'destructive' : 'warning'}>
                  {inconsistency.count} cases
                </Badge>
              </div>

              {/* Examples */}
              {inconsistency.examples.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="text-xs font-semibold text-gray-700 mb-2">Examples:</div>
                  <div className="space-y-2 text-xs">
                    {inconsistency.examples.slice(0, 3).map((ex: typeof inconsistency.examples[0], exIdx: number) => (
                      <div key={exIdx} className="font-mono bg-white bg-opacity-50 p-2 rounded">
                        <div className="font-semibold text-gray-900">ID: {ex.participant_id}</div>
                        <div className="text-gray-700">Wave A: {String(ex.wave_a_value)}</div>
                        <div className="text-gray-700">Wave B: {String(ex.wave_b_value)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Distribution Shifts */}
      {Object.keys(report.distribution_shifts).length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-900">Distribution Shifts (Kolmogorov-Smirnov Test)</h3>
          <Card>
            <CardContent className="pt-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-3 text-left font-semibold text-gray-900">Variable</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-600">Statistic</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-600">P-Value</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Significant?</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Interpretation</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(report.distribution_shifts).map(([variable, shift]: [string, DistributionShift]) => (
                    <tr key={variable} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs text-gray-900">{variable}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{shift.statistic.toFixed(4)}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{shift.p_value.toFixed(4)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={shift.significant ? 'destructive' : 'success'}>
                          {shift.significant ? 'YES' : 'NO'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{shift.interpretation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Metadata */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-1 text-xs text-gray-600">
            <p><strong>Computed:</strong> {new Date(report.computed_at).toLocaleString()}</p>
            <p><strong>Participant ID Column:</strong> <code>{report.participant_id_column}</code></p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
