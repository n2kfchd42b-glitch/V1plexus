import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { ReentrySession } from '@/types/analysisIntegrity'

interface InitiateReentryModalProps {
  isOpen: boolean
  onClose: () => void
  datasetId: string
  projectId: string
  onInitiate: (params: InitiateReentryParams) => Promise<void>
}

export interface InitiateReentryParams {
  datasetId: string
  projectId: string
  participantIdColumn: string
  columnsToValidate: string[] | null
  reentryAssignedTo: string
}

export function InitiateReentryModal({
  isOpen,
  onClose,
  datasetId,
  projectId,
  onInitiate,
}: InitiateReentryModalProps) {
  const [participantIdColumn, setParticipantIdColumn] = useState('')
  const [columnsToValidate, setColumnsToValidate] = useState<string[] | null>(
    null
  )
  const [allColumns, setAllColumns] = useState(false)
  const [reentryAssignedTo, setReentryAssignedTo] = useState('')
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleInitiate = async () => {
    if (!participantIdColumn.trim()) {
      setError('Please specify the participant ID column')
      return
    }

    if (!reentryAssignedTo.trim()) {
      setError('Please assign re-entry to a person')
      return
    }

    if (!allColumns && selectedColumns.size === 0) {
      setError('Please select at least one column to validate')
      return
    }

    setLoading(true)
    setError(null)

    try {
      await onInitiate({
        datasetId,
        projectId,
        participantIdColumn,
        columnsToValidate: allColumns ? null : Array.from(selectedColumns),
        reentryAssignedTo,
      })
      onClose()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to initiate re-entry'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-[560px] mx-4 rounded-2xl">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-sm text-blue-600">✓✓</span>
            </div>
            <CardTitle className="text-base">
              Initiate Blind Re-Entry Validation
            </CardTitle>
          </div>
          <p className="text-xs text-gray-600 leading-relaxed">
            Data will be re-entered without access to the original values,
            ensuring independent validation. All discrepancies will be
            documented and require resolution.
          </p>
        </CardHeader>

        <CardContent className="space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-3">
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}

          {/* Participant ID Column */}
          <div>
            <label className="block text-xs font-bold text-gray-900 uppercase mb-2">
              Participant ID Column
            </label>
            <p className="text-xs text-gray-600 mb-2">
              Column that uniquely identifies participants (will not be
              revalidated)
            </p>
            <input
              type="text"
              value={participantIdColumn}
              onChange={(e) => {
                setParticipantIdColumn(e.target.value)
                setError(null)
              }}
              placeholder="e.g., participant_id, subject_number"
              className="w-full border border-gray-300 rounded px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Columns to Validate */}
          <div>
            <label className="block text-xs font-bold text-gray-900 uppercase mb-2">
              Data Columns to Validate
            </label>
            <p className="text-xs text-gray-600 mb-3">
              Leave empty to validate all columns except the participant ID
            </p>

            <div className="space-y-2 mb-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allColumns}
                  onChange={(e) => {
                    setAllColumns(e.target.checked)
                    if (e.target.checked) {
                      setSelectedColumns(new Set())
                    }
                    setError(null)
                  }}
                  className="w-4 h-4 rounded"
                />
                <span className="text-xs text-gray-700">
                  Validate ALL columns
                </span>
              </label>
            </div>

            {!allColumns && (
              <div className="bg-gray-50 border border-gray-200 rounded p-3 max-h-32 overflow-y-auto">
                <div className="space-y-2">
                  {['age', 'systolic_bp', 'diastolic_bp', 'cholesterol'].map(
                    (col) => (
                      <label
                        key={col}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedColumns.has(col)}
                          onChange={(e) => {
                            const newCols = new Set(selectedColumns)
                            if (e.target.checked) {
                              newCols.add(col)
                            } else {
                              newCols.delete(col)
                            }
                            setSelectedColumns(newCols)
                            setError(null)
                          }}
                          className="w-4 h-4 rounded"
                        />
                        <span className="text-xs text-gray-700">{col}</span>
                      </label>
                    )
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-3 italic">
                  Showing first 4 columns. Import dataset to see all.
                </p>
              </div>
            )}
          </div>

          {/* Assign to Person */}
          <div>
            <label className="block text-xs font-bold text-gray-900 uppercase mb-2">
              Assign Re-Entry To
            </label>
            <p className="text-xs text-gray-600 mb-2">
              Person who will independently re-enter data
            </p>
            <input
              type="email"
              value={reentryAssignedTo}
              onChange={(e) => {
                setReentryAssignedTo(e.target.value)
                setError(null)
              }}
              placeholder="email@example.com"
              className="w-full border border-gray-300 rounded px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 pt-4 flex items-center justify-between">
            <button
              onClick={onClose}
              className="text-sm text-gray-600 hover:text-gray-900 font-medium"
            >
              Cancel
            </button>

            <Button
              onClick={handleInitiate}
              disabled={loading}
              className="ml-3"
            >
              {loading ? 'Initiating...' : 'Start Re-Entry →'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
