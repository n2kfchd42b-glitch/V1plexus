"use client"

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { loadVersionData } from '@/lib/data/storage'
import { detectColumnTypes, parseCSVData } from '@/lib/analysis/engine'
import { Button } from '@/components/ui/button'
import {
  Database, Upload, Check, ChevronDown, RefreshCw, X, FileText
} from 'lucide-react'
import type { DataRow } from '@/lib/analysis/engine'
import type { DatasetColumn } from '@/types/database'

interface DatasetMeta {
  id: string
  name: string
  description: string | null
  source: string
}

interface VersionMeta {
  id: string
  version_number: number
  commit_message: string | null
  row_count: number | null
  column_count: number | null
  file_path: string
  created_at: string
}

interface Props {
  projectId: string
  onData: (
    rows: DataRow[],
    columns: DatasetColumn[],
    name: string,
    datasetId?: string,
    versionId?: string
  ) => void
  datasetId?: string
  versionId?: string
  data?: DataRow[]
  fileName?: string
}

type Mode = 'project' | 'upload'

export function ProjectDatasetSelector({
  projectId, onData, datasetId, versionId, data, fileName
}: Props) {
  const [mode, setMode] = useState<Mode>('project')
  const [datasets, setDatasets] = useState<DatasetMeta[]>([])
  const [loadingDatasets, setLoadingDatasets] = useState(true)
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>(datasetId ?? '')
  const [versions, setVersions] = useState<VersionMeta[]>([])
  const [selectedVersionId, setSelectedVersionId] = useState<string>(versionId ?? '')
  const [loadingVersions, setLoadingVersions] = useState(false)
  const [loadingData, setLoadingData] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const supabase = createClient()

  // Fetch project datasets on mount
  useEffect(() => {
    const fetchDatasets = async () => {
      setLoadingDatasets(true)
      const { data: ds } = await supabase
        .from('datasets')
        .select('id, name, description, source')
        .eq('project_id', projectId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
      setDatasets(ds ?? [])
      setLoadingDatasets(false)
    }
    fetchDatasets()
  }, [projectId])

  // Fetch versions when a dataset is selected
  useEffect(() => {
    if (!selectedDatasetId) { setVersions([]); setSelectedVersionId(''); return }
    const fetchVersions = async () => {
      setLoadingVersions(true)
      setSelectedVersionId('')
      const { data: vs } = await supabase
        .from('dataset_versions')
        .select('id, version_number, commit_message, row_count, column_count, file_path, created_at')
        .eq('dataset_id', selectedDatasetId)
        .order('version_number', { ascending: false })
      const list = vs ?? []
      setVersions(list)
      // Auto-select head (first = latest)
      if (list.length > 0) setSelectedVersionId(list[0].id)
      setLoadingVersions(false)
    }
    fetchVersions()
  }, [selectedDatasetId])

  const handleLoadDataset = async () => {
    const version = versions.find(v => v.id === selectedVersionId)
    if (!version) return
    setLoadingData(true)
    setError(null)
    try {
      const parsed = await loadVersionData(version.file_path)
      const dataset = datasets.find(d => d.id === selectedDatasetId)
      // Convert ColumnSchema[] → DatasetColumn[]
      const cols: DatasetColumn[] = parsed.columns.map(col => ({
        name: col.name,
        type: col.type,
        unique_values: col.unique_count,
        missing: col.null_count,
        sample_values: col.sample_values as (string | number)[],
      }))
      // Cast rows — ParsedDataset.DataRow and engine DataRow are structurally compatible
      onData(parsed.rows as DataRow[], cols, `${dataset?.name ?? 'Dataset'} v${version.version_number}`, selectedDatasetId, selectedVersionId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dataset')
    } finally {
      setLoadingData(false)
    }
  }

  // CSV file upload handler
  const processFile = (file: File) => {
    setError(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      if (!text) { setError('Empty file'); return }
      try {
        const rows = parseCSVData(text)
        if (rows.length === 0) { setError('No data found in file'); return }
        const types = detectColumnTypes(rows)
        const columns: DatasetColumn[] = Object.keys(rows[0] ?? {}).map(name => ({
          name,
          type: types[name] ?? 'text',
          unique_values: new Set(rows.map(r => String(r[name] ?? '')).filter(v => v)).size,
          missing: rows.filter(r => r[name] === null || r[name] === undefined || r[name] === '').length,
        }))
        onData(rows, columns, file.name)
      } catch {
        setError('Failed to parse CSV. Please check the format.')
      }
    }
    reader.readAsText(file)
  }

  // Loaded state — dataset already set
  if (data && data.length > 0) {
    return (
      <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{fileName}</p>
              <p className="text-xs text-muted-foreground">{data.length.toLocaleString()} rows loaded</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="flex-shrink-0 h-7 text-xs"
            onClick={() => onData([], [], '')}
          >
            <X className="h-3 w-3 mr-1" /> Change
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Mode tabs */}
      <div className="flex rounded-lg border overflow-hidden text-xs font-medium">
        <button
          onClick={() => setMode('project')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 transition-colors ${
            mode === 'project'
              ? 'bg-blue-600 text-white'
              : 'text-muted-foreground hover:bg-muted/60'
          }`}
        >
          <Database className="h-3.5 w-3.5" />
          Project Datasets
        </button>
        <button
          onClick={() => setMode('upload')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 transition-colors border-l ${
            mode === 'upload'
              ? 'bg-blue-600 text-white'
              : 'text-muted-foreground hover:bg-muted/60'
          }`}
        >
          <Upload className="h-3.5 w-3.5" />
          Upload File
        </button>
      </div>

      {/* Project datasets mode */}
      {mode === 'project' && (
        <div className="space-y-2">
          {loadingDatasets ? (
            <p className="text-xs text-muted-foreground py-2 text-center">Loading datasets…</p>
          ) : datasets.length === 0 ? (
            <div className="rounded-lg border border-dashed p-4 text-center">
              <Database className="h-6 w-6 mx-auto text-muted-foreground/40 mb-1.5" />
              <p className="text-xs text-muted-foreground">No datasets in this project yet.</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Go to the <span className="font-medium">Data</span> tab to upload one, or use Upload File.
              </p>
            </div>
          ) : (
            <>
              {/* Dataset dropdown */}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Dataset</label>
                <div className="relative">
                  <select
                    value={selectedDatasetId}
                    onChange={e => setSelectedDatasetId(e.target.value)}
                    className="w-full appearance-none rounded-md border bg-background px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">— Select a dataset —</option>
                    {datasets.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              {/* Version dropdown */}
              {selectedDatasetId && (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Version</label>
                  {loadingVersions ? (
                    <p className="text-xs text-muted-foreground">Loading versions…</p>
                  ) : (
                    <div className="relative">
                      <select
                        value={selectedVersionId}
                        onChange={e => setSelectedVersionId(e.target.value)}
                        className="w-full appearance-none rounded-md border bg-background px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        {versions.map(v => (
                          <option key={v.id} value={v.id}>
                            v{v.version_number}
                            {v.row_count ? ` · ${v.row_count.toLocaleString()} rows` : ''}
                            {v.commit_message ? ` — ${v.commit_message}` : ''}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    </div>
                  )}
                </div>
              )}

              {error && <p className="text-xs text-destructive">{error}</p>}

              <Button
                size="sm"
                className="w-full"
                disabled={!selectedDatasetId || !selectedVersionId || loadingData}
                onClick={handleLoadDataset}
              >
                {loadingData
                  ? <><RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Loading…</>
                  : <><Database className="h-3.5 w-3.5 mr-1.5" /> Load Dataset</>}
              </Button>
            </>
          )}
        </div>
      )}

      {/* Upload mode */}
      {mode === 'upload' && (
        <div>
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => {
              e.preventDefault(); setDragOver(false)
              const file = e.dataTransfer.files[0]
              if (file && (file.name.endsWith('.csv') || file.type === 'text/csv')) processFile(file)
              else setError('Please upload a CSV file')
            }}
            onClick={() => fileRef.current?.click()}
            className={`rounded-lg border-2 border-dashed p-5 text-center cursor-pointer transition-colors ${
              dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
            }`}
          >
            <FileText className="h-7 w-7 mx-auto text-muted-foreground mb-1.5" />
            <p className="text-sm font-medium">Drop CSV here or click to browse</p>
            <p className="text-xs text-muted-foreground mt-0.5">Not saved to project · for one-off analysis only</p>
            {error && <p className="text-xs text-destructive mt-2">{error}</p>}
          </div>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => { if (e.target.files?.[0]) processFile(e.target.files[0]) }} />
        </div>
      )}
    </div>
  )
}
