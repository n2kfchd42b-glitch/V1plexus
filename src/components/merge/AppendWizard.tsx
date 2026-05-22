'use client'

import { useState, useEffect } from 'react'
import { ChevronRight, ChevronLeft, ChevronDown, Loader2, Check, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ColumnMappingTable } from '@/components/merge/ColumnMappingTable'
import { createClient } from '@/lib/supabase/client'
import { loadVersionData, createDatasetRecord, storeVersionData, createVersionRecord, upsertBranch } from '@/lib/data/storage'
import { appendDatasets } from '@/lib/data/operations'
import { useAuth } from '@/hooks/useAuth'
import { logAudit } from '@/lib/audit'
import type { Dataset, DatasetVersion, ColumnSchema, DataRow } from '@/types/database'

interface AppendWizardProps {
  projectId: string
  currentDatasetId?: string
  onComplete: (newDatasetId: string) => void
  onCancel: () => void
}

type Step = 1 | 2 | 3

export function AppendWizard({ projectId, currentDatasetId, onComplete, onCancel }: AppendWizardProps) {
  const { user } = useAuth()
  const supabase = createClient()

  const [step, setStep] = useState<Step>(1)
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [datasetsLoading, setDatasetsLoading] = useState(true)

  // Step 1
  const [baseDatasetId, setBaseDatasetId] = useState(currentDatasetId ?? '')
  const [appendDatasetId, setAppendDatasetId] = useState('')

  // Step 2 - column mapping: appendColumn -> baseColumn
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({})

  // Dataset versions
  const [baseVersion, setBaseVersion] = useState<DatasetVersion | null>(null)
  const [appendVersion, setAppendVersion] = useState<DatasetVersion | null>(null)
  const [loadingVersions, setLoadingVersions] = useState(false)

  // Step 3 preview
  const [previewRows, setPreviewRows] = useState<DataRow[]>([])
  const [previewLoading, setPreviewLoading] = useState(false)
  const [baseRows, setBaseRows] = useState<DataRow[]>([])
  const [appendRowsData, setAppendRowsData] = useState<DataRow[]>([])

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
        .select('*')
        .eq('project_id', projectId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
      setDatasets((data as Dataset[]) ?? [])
      setDatasetsLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  // Load versions when datasets selected, auto-build mapping
  useEffect(() => {
    if (!baseDatasetId || !appendDatasetId) return
    const load = async () => {
      setLoadingVersions(true)
      try {
        const [bRes, aRes] = await Promise.all([
          supabase
            .from('dataset_versions')
            .select('*')
            .eq('dataset_id', baseDatasetId)
            .order('version_number', { ascending: false })
            .limit(1)
            .single(),
          supabase
            .from('dataset_versions')
            .select('*')
            .eq('dataset_id', appendDatasetId)
            .order('version_number', { ascending: false })
            .limit(1)
            .single(),
        ])
        if (bRes.data) setBaseVersion(bRes.data)
        if (aRes.data) setAppendVersion(aRes.data)

        // Auto-map columns by name
        if (bRes.data && aRes.data) {
          const baseNames = new Set(bRes.data.schema_info.map((c: ColumnSchema) => c.name))
          const autoMapping: Record<string, string> = {}
          aRes.data.schema_info.forEach((c: ColumnSchema) => {
            if (baseNames.has(c.name)) {
              autoMapping[c.name] = c.name
            }
          })
          setColumnMapping(autoMapping)

          const baseName = datasets.find(d => d.id === baseDatasetId)?.name ?? 'Base'
          const appendName = datasets.find(d => d.id === appendDatasetId)?.name ?? 'Append'
          setOutputName(`${baseName} + ${appendName} (appended)`)
        }
      } finally {
        setLoadingVersions(false)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseDatasetId, appendDatasetId])

  const canProceedStep1 = baseDatasetId && appendDatasetId && baseDatasetId !== appendDatasetId && !loadingVersions
  const mappedCount = Object.keys(columnMapping).length
  const appendColCount = appendVersion?.schema_info.length ?? 0

  const handleNext = async () => {
    if (step === 2) {
      // Load data and compute preview
      setPreviewLoading(true)
      try {
        const [bData, aData] = await Promise.all([
          loadVersionData(baseVersion!.file_path),
          loadVersionData(appendVersion!.file_path),
        ])
        setBaseRows(bData.rows)
        setAppendRowsData(aData.rows)
        const result = appendDatasets(bData.rows, aData.rows, columnMapping)
        setPreviewRows(result)
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : 'Failed to preview append')
        setPreviewLoading(false)
        return
      }
      setPreviewLoading(false)
      setStep(3)
    } else {
      setStep((s) => (s + 1) as Step)
    }
  }

  const handleBack = () => setStep((s) => (s - 1) as Step)

  const handleSave = async () => {
    if (!user || !outputName.trim() || !baseVersion || !appendVersion) return
    setSaving(true)
    setSaveError(null)
    try {
      const datasetId = await createDatasetRecord({
        projectId,
        name: outputName.trim(),
        description: `Appended from ${datasets.find(d => d.id === appendDatasetId)?.name ?? 'dataset'}`,
        source: 'append',
        uploadedBy: user.id,
      })

      const schema = baseVersion.schema_info

      const { path, hash, size } = await storeVersionData(previewRows, schema, projectId, datasetId, 1)

      const versionId = await createVersionRecord({
        datasetId,
        versionNumber: 1,
        commitMessage: `Appended ${appendRowsData.length} rows`,
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

      await logAudit(
        'dataset.branch.merged',
        'dataset',
        datasetId,
        {
          summary: `Appended dataset rows into "${outputName.trim()}"`,
          operation: {
            output_name: outputName.trim(),
            base_dataset_id: baseDatasetId,
            append_dataset_id: appendDatasetId,
            result_row_count: previewRows.length,
            result_column_count: schema.length,
          },
        },
        projectId,
      )

      onComplete(datasetId)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save appended dataset')
    } finally {
      setSaving(false)
    }
  }

  const baseColumns = baseVersion?.schema_info ?? []
  const appendColumns = appendVersion?.schema_info ?? []

  const newCols = appendColumns.filter(c => !columnMapping[c.name])
  const unmappedBase = baseColumns.filter(c => !Object.values(columnMapping).includes(c.name))

  return (
    <div className="flex flex-col h-full">
      {/* Step indicator */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((s) => (
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
              {s < 3 && <ChevronRight className="h-4 w-4 text-gray-300" />}
            </div>
          ))}
          <span className="ml-3 text-sm text-gray-500">
            {step === 1 && 'Select datasets'}
            {step === 2 && 'Map columns'}
            {step === 3 && 'Preview & save'}
          </span>
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Step 1: Select datasets */}
        {step === 1 && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h2 className="text-base font-semibold text-gray-900 mb-1">Select datasets to append</h2>
              <p className="text-sm text-gray-500">
                Choose the base dataset to append rows into, and the dataset whose rows will be added.
              </p>
            </div>

            {datasetsLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading datasets...
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Base dataset</label>
                  <p className="text-xs text-gray-400 mb-1.5">Existing rows stay; schema comes from here</p>
                  <div className="relative">
                  <select
                    value={baseDatasetId}
                    onChange={e => setBaseDatasetId(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 pr-8 appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a dataset</option>
                    {datasets.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Append dataset</label>
                  <p className="text-xs text-gray-400 mb-1.5">Rows from this dataset will be stacked below</p>
                  <div className="relative">
                  <select
                    value={appendDatasetId}
                    onChange={e => setAppendDatasetId(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 pr-8 appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a dataset</option>
                    {datasets.filter(d => d.id !== baseDatasetId).map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>
            )}

            {loadingVersions && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading column info...
              </div>
            )}

            {baseVersion && appendVersion && !loadingVersions && (
              <div className="grid grid-cols-2 gap-6">
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm">
                  <p className="font-medium text-blue-800">{datasets.find(d => d.id === baseDatasetId)?.name}</p>
                  <p className="text-blue-600 mt-0.5">{baseVersion.row_count.toLocaleString()} rows &middot; {baseVersion.column_count} cols</p>
                </div>
                <div className="p-3 bg-purple-50 border border-purple-100 rounded-lg text-sm">
                  <p className="font-medium text-purple-800">{datasets.find(d => d.id === appendDatasetId)?.name}</p>
                  <p className="text-purple-600 mt-0.5">{appendVersion.row_count.toLocaleString()} rows &middot; {appendVersion.column_count} cols</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Column mapping */}
        {step === 2 && (
          <div className="max-w-3xl space-y-6">
            <div>
              <h2 className="text-base font-semibold text-gray-900 mb-1">Map columns</h2>
              <p className="text-sm text-gray-500">
                Columns were auto-mapped by name. Adjust the mapping as needed. Unmapped append columns will be discarded.
              </p>
            </div>

            <div className="flex items-center gap-6 text-sm text-gray-600">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                {mappedCount} mapped
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
                {newCols.length} new (will be discarded)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-gray-300" />
                {unmappedBase.length} base cols without data
              </span>
            </div>

            <ColumnMappingTable
              leftColumns={baseColumns}
              rightColumns={appendColumns}
              mapping={columnMapping}
              onMappingChange={setColumnMapping}
            />

            {mappedCount === 0 && appendColCount > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                No columns are mapped. The appended rows will have no data.
              </div>
            )}
          </div>
        )}

        {/* Step 3: Preview & save */}
        {step === 3 && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h2 className="text-base font-semibold text-gray-900 mb-1">Preview & save</h2>
              <p className="text-sm text-gray-500">Review the append result and save as a new dataset.</p>
            </div>

            {previewLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Computing preview...
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: 'Base rows', value: baseRows.length.toLocaleString(), color: 'text-blue-700' },
                    { label: 'Appended rows', value: appendRowsData.length.toLocaleString(), color: 'text-purple-700' },
                    { label: 'Total rows', value: previewRows.length.toLocaleString(), color: 'text-gray-900' },
                  ].map(stat => (
                    <div key={stat.label} className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
                    </div>
                  ))}
                </div>

                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
                  <span className="font-medium">{mappedCount}</span> columns mapped &middot; {' '}
                  <span className="font-medium">{newCols.length}</span> discarded &middot; {' '}
                  <span className="font-medium">{unmappedBase.length}</span> base columns will have nulls for new rows
                </div>

                {/* Sample preview rows */}
                {previewRows.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Preview (last 5 rows)</p>
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
                          {previewRows.slice(-5).map((row, i) => (
                            <tr key={i} className={`hover:bg-gray-50 ${i >= previewRows.length - appendRowsData.length ? 'bg-purple-50/40' : ''}`}>
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
                    placeholder="e.g. Appended dataset"
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
            )}
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

        {step < 3 ? (
          <Button
            onClick={handleNext}
            disabled={
              (step === 1 && !canProceedStep1) ||
              (step === 2 && previewLoading)
            }
          >
            {step === 2 && previewLoading ? (
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
            disabled={saving || !outputName.trim() || previewLoading}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-1.5" />
                Save appended dataset
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}
