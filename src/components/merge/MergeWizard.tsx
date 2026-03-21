'use client'

import { useState, useEffect } from 'react'
import { ChevronRight, ChevronLeft, Loader2, Check, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import { loadVersionData, createDatasetRecord, storeVersionData, createVersionRecord, upsertBranch } from '@/lib/data/storage'
import { mergeDatasets } from '@/lib/data/operations'
import { useAuth } from '@/hooks/useAuth'
import type { Dataset, DatasetVersion, JoinType, ColumnSchema, DataRow } from '@/types/database'

interface MergeWizardProps {
  projectId: string
  currentDatasetId?: string
  onComplete: (newDatasetId: string) => void
  onCancel: () => void
}

type Step = 1 | 2 | 3 | 4 | 5

const JOIN_TYPES: { value: JoinType; label: string; description: string; icon: string }[] = [
  {
    value: 'left',
    label: 'Left Join',
    description: 'Keep all rows from the left dataset. Add matching data from the right.',
    icon: '⬤○',
  },
  {
    value: 'inner',
    label: 'Inner Join',
    description: 'Keep only rows that have a match in both datasets.',
    icon: '◑',
  },
  {
    value: 'full_outer',
    label: 'Full Outer Join',
    description: 'Keep all rows from both datasets, filling nulls where there is no match.',
    icon: '⬤⬤',
  },
]

export function MergeWizard({ projectId, currentDatasetId, onComplete, onCancel }: MergeWizardProps) {
  const { user } = useAuth()
  const supabase = createClient()

  const [step, setStep] = useState<Step>(1)
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [datasetsLoading, setDatasetsLoading] = useState(true)

  // Step 1
  const [leftDatasetId, setLeftDatasetId] = useState(currentDatasetId ?? '')
  const [rightDatasetId, setRightDatasetId] = useState('')

  // Step 2
  const [joinType, setJoinType] = useState<JoinType>('left')

  // Step 3
  const [leftKey, setLeftKey] = useState('')
  const [rightKey, setRightKey] = useState('')

  // Step 4
  const [leftSelectedCols, setLeftSelectedCols] = useState<string[]>([])
  const [rightSelectedCols, setRightSelectedCols] = useState<string[]>([])

  // Dataset versions/columns
  const [leftVersion, setLeftVersion] = useState<DatasetVersion | null>(null)
  const [rightVersion, setRightVersion] = useState<DatasetVersion | null>(null)
  const [leftRows, setLeftRows] = useState<DataRow[]>([])
  const [rightRows, setRightRows] = useState<DataRow[]>([])
  const [loadingVersions, setLoadingVersions] = useState(false)

  // Step 5 preview
  const [previewStats, setPreviewStats] = useState<{ matched: number; unmatched_left: number; unmatched_right: number; total: number } | null>(null)
  const [previewRows, setPreviewRows] = useState<DataRow[]>([])

  // Final
  const [outputName, setOutputName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Load datasets for this project
  useEffect(() => {
    const load = async () => {
      setDatasetsLoading(true)
      const { data } = await supabase
        .from('datasets')
        .select('*, latest_version:dataset_versions(id, version_number, row_count, column_count, schema_info, file_path, commit_message, created_at, parent_version, file_hash, file_size, operations, created_by, dataset_id)')
        .eq('project_id', projectId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
      setDatasets((data as Dataset[]) ?? [])
      setDatasetsLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  // Load versions when datasets selected
  useEffect(() => {
    if (!leftDatasetId || !rightDatasetId) return
    const load = async () => {
      setLoadingVersions(true)
      try {
        const [lRes, rRes] = await Promise.all([
          supabase
            .from('dataset_versions')
            .select('*')
            .eq('dataset_id', leftDatasetId)
            .order('version_number', { ascending: false })
            .limit(1)
            .single(),
          supabase
            .from('dataset_versions')
            .select('*')
            .eq('dataset_id', rightDatasetId)
            .order('version_number', { ascending: false })
            .limit(1)
            .single(),
        ])
        if (lRes.data) {
          setLeftVersion(lRes.data)
          setLeftSelectedCols(lRes.data.schema_info.map((c: ColumnSchema) => c.name))
        }
        if (rRes.data) {
          setRightVersion(rRes.data)
          setRightSelectedCols(rRes.data.schema_info.map((c: ColumnSchema) => c.name))
        }
      } finally {
        setLoadingVersions(false)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leftDatasetId, rightDatasetId])

  const canProceedStep1 = leftDatasetId && rightDatasetId && leftDatasetId !== rightDatasetId
  const canProceedStep3 = leftKey && rightKey
  const canProceedStep4 = leftSelectedCols.length > 0 || rightSelectedCols.length > 0

  const handleNext = async () => {
    if (step === 4) {
      // Load data and compute preview
      setLoadingVersions(true)
      try {
        const [lData, rData] = await Promise.all([
          loadVersionData(leftVersion!.file_path),
          loadVersionData(rightVersion!.file_path),
        ])
        setLeftRows(lData.rows)
        setRightRows(rData.rows)
        const result = mergeDatasets(
          lData.rows,
          rData.rows,
          leftKey,
          rightKey,
          joinType,
          leftSelectedCols,
          rightSelectedCols
        )
        setPreviewRows(result.rows)
        setPreviewStats({
          ...result.stats,
          total: result.rows.length,
        })
        // Default output name
        const lName = datasets.find(d => d.id === leftDatasetId)?.name ?? 'Left'
        const rName = datasets.find(d => d.id === rightDatasetId)?.name ?? 'Right'
        setOutputName(`${lName} + ${rName} (${joinType})`)
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : 'Failed to preview merge')
        setLoadingVersions(false)
        return
      }
      setLoadingVersions(false)
      setStep(5)
    } else {
      setStep((s) => (s + 1) as Step)
    }
  }

  const handleBack = () => setStep((s) => (s - 1) as Step)

  const handleSave = async () => {
    if (!user || !outputName.trim() || !leftVersion || !rightVersion) return
    setSaving(true)
    setSaveError(null)
    try {
      const datasetId = await createDatasetRecord({
        projectId,
        name: outputName.trim(),
        description: `Merged from datasets via ${joinType} join`,
        source: 'merge',
        uploadedBy: user.id,
      })

      // Compute result schema
      const allCols = new Map<string, ColumnSchema>()
      leftVersion.schema_info.filter(c => leftSelectedCols.includes(c.name)).forEach(c => allCols.set(c.name, c))
      rightVersion.schema_info.filter(c => rightSelectedCols.includes(c.name) && c.name !== rightKey).forEach(c => {
        if (!allCols.has(c.name)) allCols.set(c.name, c)
      })
      const schema = Array.from(allCols.values())

      const { path, hash, size } = await storeVersionData(previewRows, schema, projectId, datasetId, 1)

      const versionId = await createVersionRecord({
        datasetId,
        versionNumber: 1,
        commitMessage: `Merged: ${joinType} join on ${leftKey}`,
        filePath: path,
        fileHash: hash,
        fileSize: size,
        rowCount: previewRows.length,
        columnCount: schema.length,
        schemaInfo: schema,
        operations: [],
        createdBy: user.id,
      })

      await upsertBranch({
        datasetId,
        name: 'main',
        headVersionId: versionId,
        isDefault: true,
        createdBy: user.id,
      })

      onComplete(datasetId)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save merged dataset')
    } finally {
      setSaving(false)
    }
  }

  const leftColumns = leftVersion?.schema_info ?? []
  const rightColumns = rightVersion?.schema_info ?? []

  const toggleCol = (col: string, side: 'left' | 'right') => {
    if (side === 'left') {
      setLeftSelectedCols(prev =>
        prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
      )
    } else {
      setRightSelectedCols(prev =>
        prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
      )
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Step indicator */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4, 5].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                  step === s
                    ? 'bg-blue-600 text-white'
                    : step > s
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {step > s ? <Check className="h-3.5 w-3.5" /> : s}
              </div>
              {s < 5 && <ChevronRight className="h-4 w-4 text-gray-300" />}
            </div>
          ))}
          <span className="ml-3 text-sm text-gray-500">
            {step === 1 && 'Select datasets'}
            {step === 2 && 'Join type'}
            {step === 3 && 'Key columns'}
            {step === 4 && 'Select columns'}
            {step === 5 && 'Preview & save'}
          </span>
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Step 1: Select datasets */}
        {step === 1 && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h2 className="text-base font-semibold text-gray-900 mb-1">Select datasets to merge</h2>
              <p className="text-sm text-gray-500">Choose the left (base) and right datasets to join together.</p>
            </div>

            {datasetsLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading datasets...
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Left dataset</label>
                  <select
                    value={leftDatasetId}
                    onChange={e => setLeftDatasetId(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a dataset</option>
                    {datasets.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Right dataset</label>
                  <select
                    value={rightDatasetId}
                    onChange={e => setRightDatasetId(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a dataset</option>
                    {datasets.filter(d => d.id !== leftDatasetId).map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {loadingVersions && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading column info...
              </div>
            )}

            {leftVersion && rightVersion && !loadingVersions && (
              <div className="grid grid-cols-2 gap-6">
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm">
                  <p className="font-medium text-blue-800">{datasets.find(d => d.id === leftDatasetId)?.name}</p>
                  <p className="text-blue-600 mt-0.5">{leftVersion.row_count.toLocaleString()} rows &middot; {leftVersion.column_count} columns</p>
                </div>
                <div className="p-3 bg-purple-50 border border-purple-100 rounded-lg text-sm">
                  <p className="font-medium text-purple-800">{datasets.find(d => d.id === rightDatasetId)?.name}</p>
                  <p className="text-purple-600 mt-0.5">{rightVersion.row_count.toLocaleString()} rows &middot; {rightVersion.column_count} columns</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Join type */}
        {step === 2 && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h2 className="text-base font-semibold text-gray-900 mb-1">Select join type</h2>
              <p className="text-sm text-gray-500">How should rows from the two datasets be combined?</p>
            </div>
            <div className="space-y-3">
              {JOIN_TYPES.map(jt => (
                <button
                  key={jt.value}
                  onClick={() => setJoinType(jt.value)}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                    joinType === jt.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl mt-0.5 leading-none">{jt.icon}</span>
                    <div>
                      <p className={`font-medium text-sm ${joinType === jt.value ? 'text-blue-700' : 'text-gray-800'}`}>
                        {jt.label}
                      </p>
                      <p className="text-sm text-gray-500 mt-0.5">{jt.description}</p>
                    </div>
                    {joinType === jt.value && (
                      <Check className="h-4 w-4 text-blue-600 ml-auto shrink-0 mt-0.5" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Key columns */}
        {step === 3 && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h2 className="text-base font-semibold text-gray-900 mb-1">Select key columns</h2>
              <p className="text-sm text-gray-500">Choose which columns to match rows on between the two datasets.</p>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Left key column
                  <span className="ml-1 font-normal text-gray-400">({datasets.find(d => d.id === leftDatasetId)?.name})</span>
                </label>
                <select
                  value={leftKey}
                  onChange={e => setLeftKey(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select column</option>
                  {leftColumns.map(c => (
                    <option key={c.name} value={c.name}>{c.name} ({c.type})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Right key column
                  <span className="ml-1 font-normal text-gray-400">({datasets.find(d => d.id === rightDatasetId)?.name})</span>
                </label>
                <select
                  value={rightKey}
                  onChange={e => setRightKey(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select column</option>
                  {rightColumns.map(c => (
                    <option key={c.name} value={c.name}>{c.name} ({c.type})</option>
                  ))}
                </select>
              </div>
            </div>

            {leftKey && rightKey && leftKey !== rightKey && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>Joining on different column names: <strong>{leftKey}</strong> = <strong>{rightKey}</strong></span>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Select columns */}
        {step === 4 && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h2 className="text-base font-semibold text-gray-900 mb-1">Select columns to include</h2>
              <p className="text-sm text-gray-500">Choose which columns from each dataset to include in the result.</p>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">
                    {datasets.find(d => d.id === leftDatasetId)?.name}
                  </label>
                  <button
                    onClick={() => setLeftSelectedCols(leftSelectedCols.length === leftColumns.length ? [] : leftColumns.map(c => c.name))}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    {leftSelectedCols.length === leftColumns.length ? 'Deselect all' : 'Select all'}
                  </button>
                </div>
                <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-64 overflow-y-auto">
                  {leftColumns.map(col => (
                    <label
                      key={col.name}
                      className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={leftSelectedCols.includes(col.name)}
                        onChange={() => toggleCol(col.name, 'left')}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-800 flex-1 truncate">{col.name}</span>
                      <span className="text-xs text-gray-400 shrink-0">{col.type}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">
                    {datasets.find(d => d.id === rightDatasetId)?.name}
                  </label>
                  <button
                    onClick={() => setRightSelectedCols(rightSelectedCols.length === rightColumns.length ? [] : rightColumns.map(c => c.name))}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    {rightSelectedCols.length === rightColumns.length ? 'Deselect all' : 'Select all'}
                  </button>
                </div>
                <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-64 overflow-y-auto">
                  {rightColumns.map(col => (
                    <label
                      key={col.name}
                      className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={rightSelectedCols.includes(col.name)}
                        onChange={() => toggleCol(col.name, 'right')}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        disabled={col.name === rightKey}
                      />
                      <span className={`text-sm flex-1 truncate ${col.name === rightKey ? 'text-gray-400 italic' : 'text-gray-800'}`}>
                        {col.name}{col.name === rightKey ? ' (key)' : ''}
                      </span>
                      <span className="text-xs text-gray-400 shrink-0">{col.type}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Preview & save */}
        {step === 5 && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h2 className="text-base font-semibold text-gray-900 mb-1">Preview & save</h2>
              <p className="text-sm text-gray-500">Review the merge result and save as a new dataset.</p>
            </div>

            {loadingVersions ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Computing preview...
              </div>
            ) : previewStats ? (
              <>
                <div className="grid grid-cols-4 gap-4">
                  {[
                    { label: 'Total rows', value: previewStats.total.toLocaleString(), color: 'text-gray-900' },
                    { label: 'Matched', value: previewStats.matched.toLocaleString(), color: 'text-green-700' },
                    { label: 'Unmatched left', value: previewStats.unmatched_left.toLocaleString(), color: 'text-amber-700' },
                    { label: 'Unmatched right', value: previewStats.unmatched_right.toLocaleString(), color: 'text-purple-700' },
                  ].map(stat => (
                    <div key={stat.label} className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
                    </div>
                  ))}
                </div>

                {/* Sample preview rows */}
                {previewRows.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Preview (first 5 rows)</p>
                    <div className="border border-gray-200 rounded-lg overflow-x-auto">
                      <table className="text-xs w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            {Object.keys(previewRows[0]).slice(0, 8).map(col => (
                              <th key={col} className="px-3 py-2 text-left text-gray-600 font-medium truncate max-w-24">{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {previewRows.slice(0, 5).map((row, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                              {Object.keys(previewRows[0]).slice(0, 8).map(col => (
                                <td key={col} className="px-3 py-2 text-gray-700 truncate max-w-24">
                                  {row[col] === null ? <span className="text-gray-300 italic">null</span> : String(row[col])}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Output dataset name</label>
                  <Input
                    value={outputName}
                    onChange={e => setOutputName(e.target.value)}
                    placeholder="e.g. Merged dataset"
                    className="max-w-sm"
                  />
                </div>

                {saveError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    {saveError}
                  </div>
                )}
              </>
            ) : null}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-gray-200 bg-white flex items-center justify-between">
        <Button variant="outline" onClick={step === 1 ? onCancel : handleBack}>
          {step === 1 ? 'Cancel' : (
            <>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </>
          )}
        </Button>

        {step < 5 ? (
          <Button
            onClick={handleNext}
            disabled={
              (step === 1 && !canProceedStep1) ||
              (step === 3 && !canProceedStep3) ||
              (step === 4 && (!canProceedStep4 || loadingVersions)) ||
              loadingVersions
            }
          >
            {loadingVersions && step === 4 ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                Computing...
              </>
            ) : (
              <>
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </>
            )}
          </Button>
        ) : (
          <Button
            onClick={handleSave}
            disabled={saving || !outputName.trim() || !previewStats}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-1.5" />
                Save merged dataset
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}
