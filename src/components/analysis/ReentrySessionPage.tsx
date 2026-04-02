import React, { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type {
  ReentrySession,
  Discrepancy,
  DiscrepancyStatus,
} from '@/types/analysisIntegrity'

interface ReentrySessionPageProps {
  session: ReentrySession
  onRefresh: () => Promise<void>
  onCompare?: () => Promise<void>
  onResolve?: (
    resolutions: Array<{
      discrepancyId: string
      status: DiscrepancyStatus
      resolvedValue: string | null
      resolutionNote: string
    }>
  ) => Promise<void>
  onValidate?: () => Promise<void>
}

export function ReentrySessionPage({
  session,
  onRefresh,
  onCompare,
  onResolve,
  onValidate,
}: ReentrySessionPageProps) {
  const [discrepancies, setDiscrepancies] = useState<Discrepancy[]>([])
  const [selectedStatus, setSelectedStatus] = useState<DiscrepancyStatus | 'all'>(
    'all'
  )
  const [selectedColumn, setSelectedColumn] = useState<string | 'all'>('all')
  const [resolutions, setResolutions] = useState<
    Record<
      string,
      {
        status: DiscrepancyStatus
        resolvedValue: string | null
        resolutionNote: string
      }
    >
  >({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (session.status === 'discrepancies_found') {
      fetchDiscrepancies()
    }
  }, [session])

  const fetchDiscrepancies = async () => {
    try {
      const params = new URLSearchParams()
      if (selectedStatus !== 'all') params.append('status', selectedStatus)
      if (selectedColumn !== 'all') params.append('column_name', selectedColumn)

      const response = await fetch(
        `/api/datasets/${session.dataset_id}/reentry/${session.id}/discrepancies?${params}`,
        { method: 'GET' }
      )

      if (!response.ok) throw new Error('Failed to fetch discrepancies')

      const data = await response.json()
      setDiscrepancies(data)
    } catch (error) {
      console.error('Error fetching discrepancies:', error)
    }
  }

  // Group by column for sidebar filtering
  const columnGroups = useMemo(() => {
    const groups = new Map<
      string,
      { count: number; discrepancies: Discrepancy[] }
    >()

    discrepancies.forEach((d) => {
      if (!groups.has(d.column_name)) {
        groups.set(d.column_name, { count: 0, discrepancies: [] })
      }
      const group = groups.get(d.column_name)!
      group.count++
      group.discrepancies.push(d)
    })

    return groups
  }, [discrepancies])

  // Filter discrepancies based on selections
  const filteredDiscrepancies = useMemo(() => {
    return discrepancies.filter((d) => {
      const statusMatch =
        selectedStatus === 'all' || d.status === selectedStatus
      const columnMatch =
        selectedColumn === 'all' || d.column_name === selectedColumn
      return statusMatch && columnMatch
    })
  }, [discrepancies, selectedStatus, selectedColumn])

  const handleResolveChange = (
    discrepancyId: string,
    field: 'status' | 'resolvedValue' | 'resolutionNote',
    value: any
  ) => {
    setResolutions((prev) => ({
      ...prev,
      [discrepancyId]: {
        ...prev[discrepancyId],
        [field]: value,
      },
    }))
  }

  const allResolutionsProvided = filteredDiscrepancies.every((d) => {
    const res = resolutions[d.id]
    return (
      res &&
      res.status !== 'pending' &&
      res.resolutionNote &&
      res.resolutionNote.length > 0
    )
  })

  const handleSaveResolutions = async () => {
    if (!onResolve) return

    setLoading(true)
    try {
      const resolutionArray = Object.entries(resolutions)
        .filter(([, res]) => res.status !== 'pending')
        .map(([discrepancyId, res]) => ({
          discrepancyId,
          status: res.status,
          resolvedValue: res.resolvedValue,
          resolutionNote: res.resolutionNote,
        }))

      await onResolve(resolutionArray)
      await onRefresh()
    } finally {
      setLoading(false)
    }
  }

  // PENDING STATE: Waiting for re-entry
  if (session.status === 'pending') {
    return (
      <div className="space-y-6">
        <Card className="bg-blue-50 border border-blue-200">
          <CardContent className="pt-6 pb-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">⏳</span>
              </div>
              <div className="flex-1">
                <h2 className="font-bold text-sm mb-1">
                  Awaiting blind re-entry
                </h2>
                <p className="text-xs text-blue-900 mb-4 leading-relaxed">
                  Data re-entry is assigned to{' '}
                  <strong>{session.reentry_assigned_to}</strong>. They will
                  independently enter the data without access to the original
                  values.
                </p>
                <p className="text-xs text-blue-700 mb-3">
                  Original version: <code className="text-xs font-mono bg-blue-100 px-2 py-1 rounded">{session.original_version_id.slice(0, 8)}</code>
                </p>
                {session.columns_to_validate && (
                  <p className="text-xs text-blue-700">
                    Columns to validate: <strong>{session.columns_to_validate.join(', ')}</strong>
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Button onClick={onRefresh} variant="outline" className="w-full">
          Refresh Status
        </Button>
      </div>
    )
  }

  // REENTRY_SUBMITTED STATE: Trigger comparison
  if (session.status === 'reentry_submitted') {
    return (
      <Card>
        <CardContent className="pt-8 pb-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
              <span className="text-2xl">↔</span>
            </div>
          </div>
          <h2 className="font-bold text-lg mb-2">Ready to compare</h2>
          <p className="text-sm text-gray-600 mb-6">
            Re-entered data received. Click below to compare against original.
          </p>
          <Button onClick={onCompare} className="w-full">
            Compare Datasets →
          </Button>
        </CardContent>
      </Card>
    )
  }

  // COMPARING STATE: In progress
  if (session.status === 'comparing') {
    return (
      <Card>
        <CardContent className="pt-8 pb-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center animate-spin">
              <span className="text-2xl">⚙</span>
            </div>
          </div>
          <h2 className="font-bold text-lg mb-2">Comparing datasets</h2>
          <p className="text-sm text-gray-600">Please wait...</p>
        </CardContent>
      </Card>
    )
  }

  // DISCREPANCIES_FOUND STATE: Resolution table
  if (session.status === 'discrepancies_found') {
    return (
      <div className="space-y-6">
        {/* Header with stats */}
        <Card>
          <CardContent className="pt-6 pb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-bold text-lg">
                  Discrepancies Found and Requiring Resolution
                </h2>
                <p className="text-xs text-gray-600 mt-1">
                  Overall agreement:{' '}
                  <strong>
                    {session.comparison_result
                      ?.overall_agreement_pct.toFixed(1)}
                    %
                  </strong>
                </p>
              </div>
              <Badge variant="warning" className="text-sm">
                {discrepancies.length} discrepancies
              </Badge>
            </div>

            {/* Filters */}
            <div className="flex gap-3 mt-4">
              <div className="flex-1">
                <label className="text-xs font-bold text-gray-700 block mb-1">
                  Filter by column
                </label>
                <select
                  value={selectedColumn}
                  onChange={(e) => setSelectedColumn(e.target.value as any)}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                >
                  <option value="all">All columns</option>
                  {Array.from(columnGroups.keys()).map((col) => (
                    <option key={col} value={col}>
                      {col} ({columnGroups.get(col)?.count})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex-1">
                <label className="text-xs font-bold text-gray-700 block mb-1">
                  Filter by status
                </label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value as any)}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                >
                  <option value="all">All statuses</option>
                  <option value="pending">Pending</option>
                  <option value="resolved_original">Resolved (Original)</option>
                  <option value="resolved_reentry">Resolved (Re-entry)</option>
                  <option value="resolved_manual">Resolved (Manual)</option>
                  <option value="flagged_for_investigation">
                    Flagged for Investigation
                  </option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Discrepancy table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left font-bold text-gray-900">
                    Participant
                  </th>
                  <th className="px-4 py-3 text-left font-bold text-gray-900">
                    Column
                  </th>
                  <th className="px-4 py-3 text-left font-bold text-gray-900">
                    Original Value
                  </th>
                  <th className="px-4 py-3 text-left font-bold text-gray-900">
                    Re-Entry Value
                  </th>
                  <th className="px-4 py-3 text-left font-bold text-gray-900">
                    Resolution
                  </th>
                  <th className="px-4 py-3 text-left font-bold text-gray-900">
                    Note
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredDiscrepancies.map((d, idx) => (
                  <tr
                    key={d.id}
                    className={
                      idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                    }
                  >
                    <td className="px-4 py-3 font-mono text-gray-700">
                      {d.participant_id}
                    </td>
                    <td className="px-4 py-3 text-gray-700 font-semibold">
                      {d.column_name}
                    </td>
                    <td className="px-4 py-3 text-gray-700 font-mono">
                      {d.original_value || '(empty)'}
                    </td>
                    <td className="px-4 py-3 text-gray-700 font-mono">
                      {d.reentry_value || '(empty)'}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={resolutions[d.id]?.status || 'pending'}
                        onChange={(e) =>
                          handleResolveChange(
                            d.id,
                            'status',
                            e.target.value as DiscrepancyStatus
                          )
                        }
                        className="border border-gray-300 rounded px-2 py-1 text-xs w-full"
                      >
                        <option value="pending">Select...</option>
                        <option value="resolved_original">Use Original</option>
                        <option value="resolved_reentry">Use Re-Entry</option>
                        <option value="resolved_manual">Manual Value</option>
                        <option value="flagged_for_investigation">
                          Flag
                        </option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={resolutions[d.id]?.resolutionNote || ''}
                        onChange={(e) =>
                          handleResolveChange(
                            d.id,
                            'resolutionNote',
                            e.target.value
                          )
                        }
                        placeholder="Explain choice"
                        className="border border-gray-300 rounded px-2 py-1 text-xs w-full"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <Button
            onClick={handleSaveResolutions}
            disabled={!allResolutionsProvided || loading}
            className="flex-1"
          >
            {loading ? 'Saving...' : 'Save Resolutions'}
          </Button>

          <Button onClick={onRefresh} variant="outline" className="flex-1">
            Refresh
          </Button>
        </div>
      </div>
    )
  }

  // RESOLVED STATE: Awaiting final validation
  if (session.status === 'resolved') {
    return (
      <Card>
        <CardContent className="pt-8 pb-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <span className="text-2xl">✓</span>
            </div>
          </div>
          <h2 className="font-bold text-lg mb-2">All discrepancies resolved</h2>
          <p className="text-sm text-gray-600 mb-6">
            Click below to finalize and create validated version.
          </p>
          <Button onClick={onValidate} className="w-full">
            Finalize & Validate →
          </Button>
        </CardContent>
      </Card>
    )
  }

  // VALIDATED STATE: Success
  if (session.status === 'validated') {
    return (
      <Card className="bg-green-50 border border-green-200">
        <CardContent className="pt-8 pb-8">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
              <span className="text-2xl">✓✓</span>
            </div>
            <div className="flex-1">
              <h2 className="font-bold text-lg mb-2">Validation complete</h2>
              <p className="text-sm text-green-900 mb-4 leading-relaxed">
                Blind re-entry validation successfully completed with{' '}
                  <strong>{(session.overall_agreement_pct ?? 0).toFixed(1)}%</strong>{' '}
                agreement.
              </p>
              <p className="text-xs text-green-800 mb-2">
                Verified version created:{' '}
                <code className="text-xs font-mono bg-green-100 px-2 py-1 rounded">
                  {session.verified_version_id?.slice(0, 8)}
                </code>
              </p>
              <p className="text-xs text-green-800">
                All discrepancies documented and resolved in audit trail.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Fallback
  return (
    <Card>
      <CardContent className="pt-6 pb-6">
        <p className="text-sm text-gray-600">
          Session status: <strong>{session.status}</strong>
        </p>
      </CardContent>
    </Card>
  )
}
