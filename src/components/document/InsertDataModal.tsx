'use client'

import { useState, useEffect } from 'react'
import { Table2, BarChart2, Loader2, Database, ChevronRight, ChevronDown } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createClient } from '@/lib/supabase/client'
import type { Dataset, DatasetVersion, DatasetBranch, DatasetExploration } from '@/types/database'

interface InsertDataModalProps {
  open: boolean
  onClose: () => void
  projectId: string
  onInsertTable: (params: {
    datasetId: string
    versionId: string
    datasetName: string
  }) => void
  onInsertChart: (params: {
    explorationId: string
    chartTitle: string
    chartType: string
    chartConfig: string
    datasetId: string
    versionId: string
  }) => void
}

export function InsertDataModal({
  open,
  onClose,
  projectId,
  onInsertTable,
  onInsertChart,
}: InsertDataModalProps) {
  const supabase = createClient()
  const [tab, setTab] = useState<'table' | 'chart'>('table')

  // Datasets
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [datasetsLoading, setDatasetsLoading] = useState(true)

  // Selected dataset for table insertion
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null)
  const [versions, setVersions] = useState<DatasetVersion[]>([])
  const [branches, setBranches] = useState<DatasetBranch[]>([])
  const [selectedVersionId, setSelectedVersionId] = useState<string>('')
  const [versionsLoading, setVersionsLoading] = useState(false)

  // Saved explorations for chart insertion
  const [explorations, setExplorations] = useState<DatasetExploration[]>([])
  const [explorationsLoading, setExplorationsLoading] = useState(true)

  // Load datasets
  useEffect(() => {
    if (!open) return

    async function load() {
      setDatasetsLoading(true)
      const { data } = await supabase
        .from('datasets')
        .select('*')
        .eq('project_id', projectId)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
      setDatasets((data as Dataset[]) ?? [])
      setDatasetsLoading(false)
    }
    load()
  }, [open, projectId, supabase])

  // Load explorations
  useEffect(() => {
    if (!open) return

    async function load() {
      setExplorationsLoading(true)
      const { data } = await supabase
        .from('dataset_explorations')
        .select('*')
        .in(
          'dataset_id',
          datasets.map(d => d.id)
        )
        .order('created_at', { ascending: false })
      setExplorations((data as DatasetExploration[]) ?? [])
      setExplorationsLoading(false)
    }

    if (datasets.length > 0) {
      load()
    } else {
      setExplorations([])
      setExplorationsLoading(false)
    }
  }, [open, datasets, supabase])

  // Load versions when a dataset is selected
  useEffect(() => {
    if (!selectedDataset) return

    async function load() {
      setVersionsLoading(true)
      const [vRes, bRes] = await Promise.all([
        supabase
          .from('dataset_versions')
          .select('*')
          .eq('dataset_id', selectedDataset!.id)
          .order('version_number', { ascending: false }),
        supabase
          .from('dataset_branches')
          .select('*')
          .eq('dataset_id', selectedDataset!.id)
          .order('is_default', { ascending: false }),
      ])

      const vList: DatasetVersion[] = vRes.data ?? []
      const bList: DatasetBranch[] = bRes.data ?? []
      setVersions(vList)
      setBranches(bList)

      // Auto-select head of default branch
      const defaultBranch = bList.find(b => b.is_default) ?? bList[0]
      if (defaultBranch) {
        const head = vList.find(v => v.id === defaultBranch.head_version)
        setSelectedVersionId(head?.id ?? vList[0]?.id ?? '')
      } else if (vList.length > 0) {
        setSelectedVersionId(vList[0].id)
      }
      setVersionsLoading(false)
    }

    load()
  }, [selectedDataset, supabase])

  function handleInsertTable() {
    if (!selectedDataset || !selectedVersionId) return
    onInsertTable({
      datasetId: selectedDataset.id,
      versionId: selectedVersionId,
      datasetName: selectedDataset.name,
    })
    handleClose()
  }

  function handleInsertExploration(exp: DatasetExploration) {
    onInsertChart({
      explorationId: exp.id,
      chartTitle: exp.title,
      chartType: exp.chart_type,
      chartConfig: JSON.stringify(exp.config),
      datasetId: exp.dataset_id,
      versionId: exp.version_id ?? '',
    })
    handleClose()
  }

  function handleClose() {
    setSelectedDataset(null)
    setVersions([])
    setBranches([])
    setSelectedVersionId('')
    onClose()
  }

  const selectedVersion = versions.find(v => v.id === selectedVersionId)

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Insert Data into Document
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={v => setTab(v as 'table' | 'chart')} className="flex-1 flex flex-col min-h-0">
          <TabsList className="shrink-0">
            <TabsTrigger value="table" className="gap-1.5">
              <Table2 className="h-3.5 w-3.5" />
              Dataset Table
            </TabsTrigger>
            <TabsTrigger value="chart" className="gap-1.5">
              <BarChart2 className="h-3.5 w-3.5" />
              Saved Chart
            </TabsTrigger>
          </TabsList>

          {/* ── Insert Table Tab ───────────────────────────────────────────── */}
          <TabsContent value="table" className="flex-1 overflow-auto mt-4">
            {!selectedDataset ? (
              // Dataset picker
              <div>
                <p className="text-sm text-muted-foreground mb-3">
                  Select a dataset to insert as a table into your document.
                </p>
                {datasetsLoading ? (
                  <div className="flex items-center gap-2 justify-center py-8 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading datasets...
                  </div>
                ) : datasets.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    No datasets found in this project. Upload a dataset first.
                  </div>
                ) : (
                  <div className="space-y-1">
                    {datasets.map(ds => (
                      <button
                        key={ds.id}
                        onClick={() => setSelectedDataset(ds)}
                        className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        <Table2 className="h-4 w-4 text-blue-600 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{ds.name}</p>
                          {ds.description && (
                            <p className="text-xs text-muted-foreground truncate">{ds.description}</p>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">{ds.source}</span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              // Version picker for selected dataset
              <div>
                <button
                  onClick={() => setSelectedDataset(null)}
                  className="text-xs text-blue-600 hover:underline mb-3 flex items-center gap-1"
                >
                  &larr; Back to datasets
                </button>
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg mb-4">
                  <p className="text-sm font-medium text-blue-900">{selectedDataset.name}</p>
                  {selectedDataset.description && (
                    <p className="text-xs text-blue-700 mt-0.5">{selectedDataset.description}</p>
                  )}
                </div>

                {versionsLoading ? (
                  <div className="flex items-center gap-2 justify-center py-6 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading versions...
                  </div>
                ) : versions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No versions found for this dataset.
                  </p>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">Version</label>
                      <div className="relative">
                      <select
                        value={selectedVersionId}
                        onChange={e => setSelectedVersionId(e.target.value)}
                        className="w-full text-sm border rounded-lg px-3 py-2 pr-8 appearance-none bg-white"
                      >
                        {versions.map(v => (
                          <option key={v.id} value={v.id}>
                            v{v.version_number} — {v.commit_message} ({v.row_count.toLocaleString()} rows, {v.column_count} cols)
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                      </div>
                    </div>

                    {selectedVersion && (
                      <div className="text-xs text-muted-foreground">
                        {selectedVersion.row_count.toLocaleString()} rows · {selectedVersion.column_count} columns
                        {selectedVersion.schema_info.length > 0 && (
                          <span className="ml-2">
                            Columns: {selectedVersion.schema_info.slice(0, 5).map(c => c.name).join(', ')}
                            {selectedVersion.schema_info.length > 5 && ` +${selectedVersion.schema_info.length - 5} more`}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="flex justify-end pt-2">
                      <Button onClick={handleInsertTable} disabled={!selectedVersionId} size="sm">
                        <Table2 className="h-4 w-4 mr-1.5" />
                        Insert Table
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* ── Insert Chart Tab ───────────────────────────────────────────── */}
          <TabsContent value="chart" className="flex-1 overflow-auto mt-4">
            <p className="text-sm text-muted-foreground mb-3">
              Select a saved chart exploration to embed in your document.
            </p>

            {explorationsLoading ? (
              <div className="flex items-center gap-2 justify-center py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading saved charts...
              </div>
            ) : explorations.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                <BarChart2 className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                <p>No saved chart explorations yet.</p>
                <p className="text-xs mt-1">Go to a dataset&apos;s Explore tab to create and save charts.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {explorations.map(exp => {
                  const dsName = datasets.find(d => d.id === exp.dataset_id)?.name ?? 'Unknown'
                  return (
                    <button
                      key={exp.id}
                      onClick={() => handleInsertExploration(exp)}
                      className="text-left p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <BarChart2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span className="text-sm font-medium truncate">{exp.title}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-medium uppercase">
                          {exp.chart_type}
                        </span>
                        <span className="truncate">{dsName}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
