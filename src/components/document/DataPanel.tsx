"use client"

import { useState, useEffect } from 'react'
import { Table2, BarChart2, Loader2, Database, ChevronRight, ArrowLeft, ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { Dataset, DatasetVersion, DatasetBranch, DatasetExploration } from '@/types/database'

interface DataPanelProps {
  projectId: string
  onInsertTable: (params: { datasetId: string; versionId: string; datasetName: string }) => void
  onInsertChart: (params: {
    explorationId: string
    chartTitle: string
    chartType: string
    chartConfig: string
    datasetId: string
    versionId: string
  }) => void
}

type DataSection = 'datasets' | 'charts'

export function DataPanel({ projectId, onInsertTable, onInsertChart }: DataPanelProps) {
  const supabase = createClient()
  const [section, setSection] = useState<DataSection>('datasets')

  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [datasetsLoading, setDatasetsLoading] = useState(true)

  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null)
  const [versions, setVersions] = useState<DatasetVersion[]>([])
  const [branches, setBranches] = useState<DatasetBranch[]>([])
  const [selectedVersionId, setSelectedVersionId] = useState('')
  const [versionsLoading, setVersionsLoading] = useState(false)

  const [explorations, setExplorations] = useState<DatasetExploration[]>([])
  const [explorationsLoading, setExplorationsLoading] = useState(false)

  useEffect(() => {
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
  }, [projectId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (datasets.length === 0) { setExplorations([]); return }
    async function load() {
      setExplorationsLoading(true)
      const { data } = await supabase
        .from('dataset_explorations')
        .select('*')
        .in('dataset_id', datasets.map(d => d.id))
        .order('created_at', { ascending: false })
      setExplorations((data as DatasetExploration[]) ?? [])
      setExplorationsLoading(false)
    }
    load()
  }, [datasets]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedDataset) return
    async function load() {
      setVersionsLoading(true)
      const [vRes, bRes] = await Promise.all([
        supabase.from('dataset_versions').select('*').eq('dataset_id', selectedDataset!.id).order('version_number', { ascending: false }),
        supabase.from('dataset_branches').select('*').eq('dataset_id', selectedDataset!.id).order('is_default', { ascending: false }),
      ])
      const vList: DatasetVersion[] = vRes.data ?? []
      const bList: DatasetBranch[] = bRes.data ?? []
      setVersions(vList)
      setBranches(bList)
      const def = bList.find(b => b.is_default) ?? bList[0]
      if (def) {
        const head = vList.find(v => v.id === def.head_version)
        setSelectedVersionId(head?.id ?? vList[0]?.id ?? '')
      } else if (vList.length > 0) {
        setSelectedVersionId(vList[0].id)
      }
      setVersionsLoading(false)
    }
    load()
  }, [selectedDataset]) // eslint-disable-line react-hooks/exhaustive-deps

  const selectedVersion = versions.find(v => v.id === selectedVersionId)

  return (
    <div className="flex flex-col h-full">
      {/* Section toggle */}
      <div className="flex border-b border-[var(--border-default)] shrink-0">
        {([['datasets', 'Datasets', Table2], ['charts', 'Charts', BarChart2]] as const).map(([s, label, Icon]) => (
          <button
            key={s}
            onClick={() => { setSection(s); setSelectedDataset(null) }}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors',
              section === s
                ? 'text-[var(--color-clinical-blue)] border-b-2 border-[var(--color-clinical-blue)] -mb-px bg-white'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {/* Datasets section */}
        {section === 'datasets' && (
          <>
            {!selectedDataset ? (
              <div className="space-y-1.5">
                <p className="text-[11px] text-[var(--text-tertiary)] mb-2">Select a dataset to insert as a linked table</p>
                {datasetsLoading ? (
                  <div className="flex items-center justify-center py-8 gap-2 text-[var(--text-tertiary)]">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-xs">Loading…</span>
                  </div>
                ) : datasets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <Database className="h-8 w-8 text-[var(--text-tertiary)] opacity-40 mb-3" />
                    <p className="text-xs text-[var(--text-secondary)]">No datasets in this project</p>
                    <p className="text-[11px] text-[var(--text-tertiary)] mt-1">Upload a dataset from the Data section</p>
                  </div>
                ) : (
                  datasets.map(ds => (
                    <button
                      key={ds.id}
                      onClick={() => setSelectedDataset(ds)}
                      className="w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-[var(--border-default)] hover:border-blue-200 hover:bg-blue-50/40 transition-colors group"
                    >
                      <Table2 className="h-4 w-4 text-[var(--color-clinical-blue)] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-[var(--text-primary)] truncate">{ds.name}</p>
                        {ds.description && <p className="text-[11px] text-[var(--text-tertiary)] truncate">{ds.description}</p>}
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-[var(--text-tertiary)] shrink-0 opacity-0 group-hover:opacity-100" />
                    </button>
                  ))
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <button
                  onClick={() => setSelectedDataset(null)}
                  className="flex items-center gap-1 text-xs text-[var(--color-clinical-blue)] hover:underline"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back
                </button>

                <div className="px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg">
                  <p className="text-xs font-semibold text-[var(--color-clinical-blue)]">{selectedDataset.name}</p>
                  {selectedDataset.description && <p className="text-[11px] text-blue-700 mt-0.5">{selectedDataset.description}</p>}
                </div>

                {versionsLoading ? (
                  <div className="flex items-center justify-center py-6 gap-2 text-[var(--text-tertiary)]">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-xs">Loading versions…</span>
                  </div>
                ) : versions.length === 0 ? (
                  <p className="text-xs text-[var(--text-tertiary)] text-center py-6">No versions found</p>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">Version</label>
                      <div className="relative">
                        <select
                          value={selectedVersionId}
                          onChange={e => setSelectedVersionId(e.target.value)}
                          className="w-full text-xs border border-[var(--border-default)] rounded-lg px-3 py-2 pr-8 appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {versions.map(v => (
                            <option key={v.id} value={v.id}>
                              v{v.version_number} — {v.commit_message} ({v.row_count.toLocaleString()} rows)
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-tertiary)] pointer-events-none" />
                      </div>
                    </div>

                    {selectedVersion && (
                      <p className="text-[11px] text-[var(--text-tertiary)]">
                        {selectedVersion.row_count.toLocaleString()} rows · {selectedVersion.column_count} columns
                        {selectedVersion.schema_info.length > 0 && (
                          <span className="ml-1">
                            · {selectedVersion.schema_info.slice(0, 4).map(c => c.name).join(', ')}
                            {selectedVersion.schema_info.length > 4 && ` +${selectedVersion.schema_info.length - 4} more`}
                          </span>
                        )}
                      </p>
                    )}

                    <button
                      onClick={() => {
                        if (!selectedDataset || !selectedVersionId) return
                        onInsertTable({ datasetId: selectedDataset.id, versionId: selectedVersionId, datasetName: selectedDataset.name })
                        setSelectedDataset(null)
                      }}
                      disabled={!selectedVersionId}
                      className="w-full flex items-center justify-center gap-2 text-xs font-medium text-white bg-[var(--color-clinical-blue)] hover:bg-[var(--color-clinical-deep)] px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Table2 className="h-3.5 w-3.5" />
                      Insert Table
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Charts section */}
        {section === 'charts' && (
          <div className="space-y-1.5">
            <p className="text-[11px] text-[var(--text-tertiary)] mb-2">Select a saved chart exploration to embed</p>
            {explorationsLoading ? (
              <div className="flex items-center justify-center py-8 gap-2 text-[var(--text-tertiary)]">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-xs">Loading…</span>
              </div>
            ) : explorations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <BarChart2 className="h-8 w-8 text-[var(--text-tertiary)] opacity-40 mb-3" />
                <p className="text-xs text-[var(--text-secondary)]">No saved charts yet</p>
                <p className="text-[11px] text-[var(--text-tertiary)] mt-1">Go to a dataset's Explore tab to create charts</p>
              </div>
            ) : (
              explorations.map(exp => {
                const dsName = datasets.find(d => d.id === exp.dataset_id)?.name ?? ''
                return (
                  <button
                    key={exp.id}
                    onClick={() => onInsertChart({
                      explorationId: exp.id,
                      chartTitle: exp.title,
                      chartType: exp.chart_type,
                      chartConfig: JSON.stringify(exp.config),
                      datasetId: exp.dataset_id,
                      versionId: exp.version_id ?? '',
                    })}
                    className="w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-[var(--border-default)] hover:border-emerald-200 hover:bg-emerald-50/40 transition-colors group"
                  >
                    <BarChart2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-[var(--text-primary)] truncate">{exp.title}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="px-1.5 py-px rounded bg-emerald-50 text-[10px] font-medium uppercase text-emerald-700 border border-emerald-100">
                          {exp.chart_type}
                        </span>
                        {dsName && <span className="text-[11px] text-[var(--text-tertiary)] truncate">{dsName}</span>}
                      </div>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-[var(--text-tertiary)] shrink-0 opacity-0 group-hover:opacity-100" />
                  </button>
                )
              })
            )}
          </div>
        )}
      </div>
    </div>
  )
}
