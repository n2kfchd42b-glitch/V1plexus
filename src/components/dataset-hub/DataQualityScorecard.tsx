import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { QualityReport, ReadinessStatus } from '@/types/qualityIntelligence'

interface DataQualityScorecardProps {
  report: QualityReport
  isLoading?: boolean
  onRecompute?: () => Promise<void>
}

export function DataQualityScorecard({ report, isLoading, onRecompute }: DataQualityScorecardProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-amber-600'
    return 'text-red-600'
  }

  const getReadinessBadgeVariant = (status: ReadinessStatus): 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' => {
    switch (status) {
      case 'ready':
        return 'success'
      case 'caution':
        return 'warning'
      case 'not_ready':
        return 'destructive'
    }
  }

  const criticalFlags = report.flags.filter(f => f.severity === 'critical')
  const warningFlags = report.flags.filter(f => f.severity === 'warning')

  return (
    <div className="space-y-6">
      {/* Overall Score Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-sm">Data Quality Score</CardTitle>
              <p className="text-3xl font-bold mt-2">
                <span className={getScoreColor(report.overall_score)}>
                  {report.overall_score}
                </span>
                <span className="text-gray-400 text-lg">/100</span>
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge variant={getReadinessBadgeVariant(report.readiness_status)}>
                {report.readiness_status.toUpperCase()}
              </Badge>
              {onRecompute && (
                <button
                  onClick={onRecompute}
                  disabled={isLoading}
                  className="text-xs text-gray-600 hover:text-gray-900 disabled:opacity-50"
                >
                  {isLoading ? 'Recomputing...' : 'Recompute'}
                </button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">{report.readiness_summary}</p>
        </CardContent>
      </Card>

      {/* Critical Alerts */}
      {criticalFlags.length > 0 && (
        <div className="border border-red-200 bg-red-50 rounded-lg p-4">
          <div className="font-semibold text-red-900 mb-2">Critical Issues Detected</div>
          <ul className="space-y-1">
            {criticalFlags.map((flag: typeof criticalFlags[0], idx: number) => (
              <li key={idx} className="text-sm text-red-800">
                <strong>{flag.variable || flag.category}:</strong> {flag.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Warning Alerts */}
      {warningFlags.length > 0 && (
        <div className="border border-amber-200 bg-amber-50 rounded-lg p-4">
          <div className="font-semibold text-amber-900 mb-2">Warnings</div>
          <ul className="space-y-1">
            {warningFlags.map((flag: typeof warningFlags[0], idx: number) => (
              <li key={idx} className="text-sm text-amber-800">
                <strong>{flag.variable || flag.category}:</strong> {flag.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Dimension Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(report.dimensions).map(([dimKey, dimension]: [string, typeof report.dimensions[keyof typeof report.dimensions]]) => (
          <Card key={dimKey}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="capitalize text-base">
                  {dimKey.replace(/_/g, ' ')}
                </CardTitle>
                <span className="text-lg font-bold">
                  {dimension.score}/{dimension.max_score}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Progress bar */}
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${(dimension.score / dimension.max_score) * 100}%` }}
                />
              </div>
              {dimension.findings.length > 0 && (
                <ul className="text-xs text-gray-600 space-y-1">
                  {dimension.findings.map((finding: string, idx: number) => (
                    <li key={idx}>• {finding}</li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Metadata */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-1 text-xs text-gray-600">
            <p><strong>Computed:</strong> {new Date(report.computed_at).toLocaleString()}</p>
            <p><strong>Algorithm Version:</strong> {report.algorithm_version}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
