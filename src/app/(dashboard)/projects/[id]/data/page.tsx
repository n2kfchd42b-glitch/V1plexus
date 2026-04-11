'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Upload, Database, ExternalLink, Loader2,
  BarChart2, ShieldCheck, GitCommit, Eye,
  Archive, ArchiveRestore, Trash2, ChevronRight,
  Hash, Type, Calendar, ToggleLeft, Tag, Fingerprint, MapPin,
  Search,
} from 'lucide-react'
import { motion, type Variants } from 'framer-motion'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DatasetTable } from '@/components/data/DatasetTable'
import { DataPortraitPanel } from '@/components/analysis/DataPortraitPanel'
import { VersionSelector } from '@/components/data/VersionSelector'
import { DatasetUpload } from '@/components/data/DatasetUpload'
import { loadVersionData } from '@/lib/data/storage'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { logAudit } from '@/lib/audit'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import type { Dataset, DatasetVersion, ParsedDataset, ColumnSchema } from '@/types/database'

// ─── Types ────────────────────────────────────────────────────────────────────

type DataTab = 'preview' | 'profile' | 'quality' | 'charts' | 'versions'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function typeIcon(type: string) {
  if (['number', 'integer', 'float'].includes(type)) return <Hash className="h-3 w-3" />
  if (type === 'text') return <Type className="h-3 w-3" />
  if (type === 'date') return <Calendar className="h-3 w-3" />
  if (type === 'boolean') return <ToggleLeft className="h-3 w-3" />
  if (type === 'categorical') return <Tag className="h-3 w-3" />
  if (type === 'geo') return <MapPin className="h-3 w-3" />
  return <Fingerprint className="h-3 w-3" />
}

function typeBadgeClass(type: string) {
  if (['number', 'integer', 'float'].includes(type)) return 'bg-blue-50 text-blue-600'
  if (type === 'date') return 'bg-amber-50 text-amber-700'
  if (type === 'boolean') return 'bg-purple-50 text-purple-700'
  if (type === 'categorical') return 'bg-emerald-50 text-emerald-700'
  return 'bg-slate-100 text-slate-600'
}

// ─── Tab config ───────────────────────────────────────────────────────────────

const TABS: { id: DataTab; label: string; icon: React.ReactNode }[] = [
  { id: 'preview',  label: 'Preview',  icon: <Eye className="h-3.5 w-3.5" /> },
  { id: 'profile',  label: 'Profile',  icon: <BarChart2 className="h-3.5 w-3.5" /> },
  { id: 'quality',  label: 'Quality',  icon: <ShieldCheck className="h-3.5 w-3.5" /> },
  { id: 'charts',   label: 'Charts',   icon: <BarChart2 className="h-3.5 w-3.5" /> },
  { id: 'versions', label: 'Versions', icon: <GitCommit className="h-3.5 w-3.5" /> },
]

// ─── Animations ───────────────────────────────────────────────────────────────

const listVariants: Variants = { hidden: {}, visible: { transition: { staggerChildren: 0.05 } } }
const itemVariants: Variants = { hidden: { opacity: 0, y: 4 }, visible: { opacity: 1, y: 0, transition: { duration: 0.15 } } }

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProjectDataPage() {
  const params    = useParams()
  const router    = useRouter()
  const projectId = params.id as string
  const { user, loading: authLoading } = useAuth()
  const supabase  = createClient()

  // Dataset list
  const [datasets,      setDatasets]      = useState<Dataset[]>([])
  const [archivedCount, setArchivedCount] = useState(0)
  const [listLoading,   setListLoading]   = useState(true)
  const [showArchived,  setShowArchived]  = useState(false)
  const [showUpload,    setShowUpload]    = useState(false)

  // Selected dataset
  const [selectedId,      setSelectedId]      = useState<string | null>(null)
  const [dataset,         setDataset]         = useState<Dataset | null>(null)
  const [versions,        setVersions]        = useState<DatasetVersion[]>([])
  const [activeVersionId, setActiveVersionId] = useState<string>('')
  const [parsedData,      setParsedData]      = useState<ParsedDataset | null>(null)
  const [detailLoading,   setDetailLoading]   = useState(false)
  const [dataLoading,     setDataLoading]     = useState(false)
  const [dataTab,         setDataTab]         = useState<DataTab>('preview')

  // Quality tab column search
  const [colSearch, setColSearch] = useState('')

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [authLoading, user, router])

  // ── Fetch dataset list ─────────────────────────────────────────────────────

  const fetchDatasets = useCallback(async () => {
    if (!user) return
    setListLoading(true)
    try {
      const query = showArchived
        ? supabase.from('datasets').select('*').eq('project_id', projectId).is('deleted_at', null).not('archived_at', 'is', null).order('updated_at', { ascending: false })
        : supabase.from('datasets').select('*').eq('project_id', projectId).is('deleted_at', null).is('archived_at', null).order('updated_at', { ascending: false })

      const [datasetsRes, archivedRes] = await Promise.all([
        query,
        supabase.from('datasets').select('id', { count: 'exact', head: true }).eq('project_id', projectId).is('deleted_at', null).not('archived_at', 'is', null),
      ])

      setArchivedCount(archivedRes.count ?? 0)
      if (!datasetsRes.data?.length) { setDatasets([]); return }

      const datasetList: Dataset[] = datasetsRes.data
      const versionsRes = await supabase
        .from('dataset_versions').select('*')
        .in('dataset_id', datasetList.map(d => d.id))
        .order('version_number', { ascending: false })

      const latestMap = new Map<string, DatasetVersion>()
      for (const v of (versionsRes.data ?? []) as DatasetVersion[]) {
        if (!latestMap.has(v.dataset_id)) latestMap.set(v.dataset_id, v)
      }
      setDatasets(datasetList.map(ds => ({ ...ds, latest_version: latestMap.get(ds.id) ?? undefined })))
    } finally {
      setListLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, showArchived, user])

  useEffect(() => { fetchDatasets() }, [fetchDatasets])

  // ── Load dataset detail when selected ────────────────────────────────────────

  useEffect(() => {
    if (!selectedId || !user) return
    setDetailLoading(true)
    setParsedData(null)
    setVersions([])
    setActiveVersionId('')
    setDataset(null)

    const load = async () => {
      try {
        const [dsRes, versRes] = await Promise.all([
          supabase.from('datasets').select('*').eq('id', selectedId).single(),
          supabase.from('dataset_versions').select('*').eq('dataset_id', selectedId).order('version_number', { ascending: false }),
        ])
        if (dsRes.data) setDataset(dsRes.data)
        const vList: DatasetVersion[] = versRes.data ?? []
        setVersions(vList)
        if (vList.length > 0) setActiveVersionId(vList[0].id)
      } finally {
        setDetailLoading(false)
      }
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, user])

  // ── Load data file when version changes ───────────────────────────────────

  useEffect(() => {
    if (!activeVersionId || versions.length === 0) return
    const version = versions.find(v => v.id === activeVersionId)
    if (!version) return
    setDataLoading(true)
    setParsedData(null)
    loadVersionData(version.file_path)
      .then(data => setParsedData(data))
      .catch(() => toast.error('Failed to load data'))
      .finally(() => setDataLoading(false))
  }, [activeVersionId, versions])

  // ── List actions ──────────────────────────────────────────────────────────

  const handleUploadSuccess = (datasetId: string) => {
    setShowUpload(false)
    fetchDatasets().then(() => {
      setSelectedId(datasetId)
      setDataTab('preview')
    })
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('datasets').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    if (error) { toast.error('Failed to delete dataset'); return }
    setDatasets(prev => prev.filter(d => d.id !== id))
    if (selectedId === id) { setSelectedId(null); setDataset(null) }
    logAudit('dataset.deleted', 'dataset', id, {}, projectId)
    toast.success('Dataset deleted')
  }

  const handleArchive = async (id: string, archive: boolean) => {
    const { error } = await supabase.from('datasets').update({ archived_at: archive ? new Date().toISOString() : null }).eq('id', id)
    if (error) { toast.error(archive ? 'Failed to archive' : 'Failed to unarchive'); return }
    setDatasets(prev => prev.filter(d => d.id !== id))
    if (selectedId === id) { setSelectedId(null); setDataset(null) }
    logAudit(archive ? 'dataset.archived' : 'dataset.unarchived', 'dataset', id, {}, projectId)
    toast.success(archive ? 'Dataset archived' : 'Dataset unarchived')
  }

  // ── Derived stats ─────────────────────────────────────────────────────────

  const activeVersion  = versions.find(v => v.id === activeVersionId)
  const columns: ColumnSchema[] = parsedData?.columns ?? activeVersion?.schema_info ?? []
  const rowCount       = parsedData?.row_count ?? activeVersion?.row_count ?? 0
  const totalCells     = rowCount * columns.length
  const totalMissing   = columns.reduce((acc, c) => acc + c.null_count, 0)
  const completePct    = totalCells > 0 ? (100 - (totalMissing / totalCells) * 100).toFixed(1) : '100.0'

  const filteredCols = useMemo(
    () => columns.filter(c => c.name.toLowerCase().includes(colSearch.toLowerCase())),
    [columns, colSearch]
  )

  if (authLoading || !user) return null

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-row h-full min-h-0 bg-[var(--bg-app)] overflow-hidden">

      {/* ── LEFT PANEL — dataset list ──────────────────────────────────────── */}
      <div className="w-72 shrink-0 flex flex-col border-r border-[var(--border-row)] overflow-hidden bg-[var(--bg-app)]">

        {/* Header */}
        <div className="px-4 pt-5 pb-3 flex-shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h1 className="page-title">Data</h1>
              <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                {datasets.length} {datasets.length === 1 ? 'dataset' : 'datasets'}
                {archivedCount > 0 && ` · ${archivedCount} archived`}
              </p>
            </div>
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-white bg-[var(--accent-blue)] hover:opacity-90 transition-opacity shrink-0"
            >
              <Upload className="h-3 w-3" />
              Import
            </button>
          </div>
          {archivedCount > 0 && (
            <button
              onClick={() => setShowArchived(v => !v)}
              className={`mt-2 w-full text-left px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                showArchived
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'border-[var(--border-strong)] text-[var(--text-secondary)] hover:bg-[var(--bg-row-hover)]'
              }`}
            >
              {showArchived ? 'View Active' : `View ${archivedCount} Archived`}
            </button>
          )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto border-t border-[var(--border-row)]">
          {listLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="px-4 py-3 border-b border-[var(--border-row)]">
                <div className="skeleton h-3.5 w-36 rounded mb-1.5" />
                <div className="skeleton h-3 w-24 rounded" />
              </div>
            ))
          ) : datasets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 px-4 text-center">
              <Database className="h-6 w-6 text-[var(--text-tertiary)] mb-2" />
              <p className="text-xs text-[var(--text-secondary)] font-medium">
                {showArchived ? 'No archived datasets' : 'No datasets yet'}
              </p>
              {!showArchived && (
                <button
                  onClick={() => setShowUpload(true)}
                  className="mt-2 text-xs text-[var(--accent-blue)] hover:underline"
                >
                  Import your first dataset
                </button>
              )}
            </div>
          ) : (
            <motion.div initial="hidden" animate="visible" variants={listVariants}>
              {datasets.map(ds => (
                <motion.div key={ds.id} variants={itemVariants}>
                  <DatasetListItem
                    dataset={ds}
                    isSelected={ds.id === selectedId}
                    isArchived={!!ds.archived_at}
                    onSelect={() => { setSelectedId(ds.id); setDataTab('preview') }}
                    onDelete={handleDelete}
                    onArchive={handleArchive}
                  />
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </div>

      {/* ── RIGHT PANEL ───────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Empty state */}
        {!selectedId && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
            <Database className="h-10 w-10 text-[var(--text-tertiary)]" />
            <p className="text-sm font-medium text-[var(--text-secondary)]">Select a dataset</p>
            <p className="text-xs text-[var(--text-tertiary)] max-w-xs leading-relaxed">
              Choose a dataset from the left to preview data, explore columns, check quality, and manage versions.
            </p>
          </div>
        )}

        {/* Loading detail */}
        {selectedId && detailLoading && (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-5 w-5 text-[var(--text-tertiary)] animate-spin" />
          </div>
        )}

        {/* Dataset detail */}
        {selectedId && !detailLoading && dataset && (
          <>
            {/* Dataset header + tabs */}
            <div className="px-5 pt-4 pb-0 border-b border-[var(--border-row)] flex-shrink-0 bg-[var(--bg-app)]">
              <div className="flex items-center justify-between gap-3 pb-3">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-[var(--text-primary)] truncate">{dataset.name}</h2>
                  {activeVersion && (
                    <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                      {activeVersion.row_count.toLocaleString()} rows · {activeVersion.column_count} cols · v{activeVersion.version_number}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {versions.length > 1 && (
                    <VersionSelector
                      versions={versions}
                      currentVersionId={activeVersionId}
                      onVersionChange={setActiveVersionId}
                    />
                  )}
                  <a
                    href={`/projects/${projectId}/data/${dataset.id}`}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium border border-[var(--border-strong)] text-[var(--text-secondary)] hover:bg-[var(--bg-row-hover)] transition-colors"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Full view
                  </a>
                </div>
              </div>

              {/* Tab bar */}
              <div className="flex gap-0.5">
                {TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setDataTab(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                      dataTab === tab.id
                        ? 'border-[var(--accent-blue)] text-[var(--accent-blue)]'
                        : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab content */}
            <div className="flex-1 min-h-0 overflow-hidden">

              {/* PREVIEW */}
              {dataTab === 'preview' && (
                dataLoading ? (
                  <div className="h-full flex items-center justify-center">
                    <Loader2 className="h-5 w-5 text-[var(--text-tertiary)] animate-spin" />
                  </div>
                ) : parsedData ? (
                  <DatasetTable rows={parsedData.rows} columns={columns} className="h-full" />
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-[var(--text-tertiary)]">
                    No data available
                  </div>
                )
              )}

              {/* PROFILE */}
              {dataTab === 'profile' && (
                <div className="h-full overflow-y-auto p-5">
                  <DataPortraitPanel
                    datasetId={dataset.id}
                    projectId={projectId}
                    versionId={activeVersionId || null}
                  />
                </div>
              )}

              {/* QUALITY */}
              {dataTab === 'quality' && (
                <div className="h-full overflow-y-auto p-5 space-y-5">
                  {/* Summary cards */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white border border-[var(--border-row)] rounded-lg p-4 text-center">
                      <p className={`text-2xl font-bold ${
                        parseFloat(completePct) >= 95 ? 'text-green-600' : parseFloat(completePct) >= 80 ? 'text-amber-600' : 'text-red-600'
                      }`}>{completePct}%</p>
                      <p className="text-xs text-[var(--text-tertiary)] mt-1">Completeness</p>
                    </div>
                    <div className="bg-white border border-[var(--border-row)] rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-[var(--text-primary)]">{columns.length}</p>
                      <p className="text-xs text-[var(--text-tertiary)] mt-1">Columns</p>
                    </div>
                    <div className="bg-white border border-[var(--border-row)] rounded-lg p-4 text-center">
                      <p className={`text-2xl font-bold ${totalMissing > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                        {totalMissing.toLocaleString()}
                      </p>
                      <p className="text-xs text-[var(--text-tertiary)] mt-1">Missing values</p>
                    </div>
                  </div>

                  {/* Column completeness table */}
                  <div className="bg-white border border-[var(--border-row)] rounded-lg overflow-hidden">
                    <div className="px-4 py-3 border-b border-[var(--border-row)] flex items-center gap-3">
                      <h3 className="text-xs font-semibold text-[var(--text-primary)]">Column Completeness</h3>
                      <div className="flex-1 relative max-w-xs">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-tertiary)]" />
                        <input
                          value={colSearch}
                          onChange={e => setColSearch(e.target.value)}
                          placeholder="Search columns…"
                          className="pl-7 h-7 w-full text-xs rounded-md border border-[var(--border-strong)] bg-transparent px-3 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-blue)]"
                        />
                      </div>
                    </div>
                    <div className="divide-y divide-[var(--border-row)] max-h-[400px] overflow-y-auto">
                      {filteredCols.length === 0 ? (
                        <p className="text-xs text-[var(--text-tertiary)] px-4 py-6 text-center">No columns match</p>
                      ) : filteredCols.map(col => {
                        const pct = rowCount > 0 ? ((rowCount - col.null_count) / rowCount) * 100 : 100
                        return (
                          <div key={col.name} className="px-4 py-2.5 flex items-center gap-3">
                            <div className="flex items-center gap-1.5 w-48 shrink-0">
                              <span className="text-[var(--text-tertiary)]">{typeIcon(col.type)}</span>
                              <span className="text-xs text-[var(--text-primary)] truncate">{col.name}</span>
                              <span className={`ml-auto text-[10px] font-medium px-1 py-0.5 rounded shrink-0 ${typeBadgeClass(col.type)}`}>
                                {col.type}
                              </span>
                            </div>
                            <div className="flex-1 h-1.5 bg-[var(--bg-row-hover)] rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${pct}%`,
                                  background: pct < 80 ? '#ef4444' : pct < 95 ? '#f59e0b' : '#22c55e',
                                }}
                              />
                            </div>
                            <span
                              className="text-xs font-medium w-12 text-right shrink-0"
                              style={{ color: pct < 80 ? '#ef4444' : pct < 95 ? '#f59e0b' : '#6b7280' }}
                            >
                              {pct.toFixed(1)}%
                            </span>
                            {col.null_count > 0 && (
                              <span className="text-[10px] text-[var(--text-tertiary)] w-20 text-right shrink-0">
                                {col.null_count.toLocaleString()} null
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* CHARTS */}
              {dataTab === 'charts' && (
                <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-8">
                  <BarChart2 className="h-10 w-10 text-[var(--text-tertiary)]" />
                  <p className="text-sm font-medium text-[var(--text-secondary)]">Chart Explorer</p>
                  <p className="text-xs text-[var(--text-tertiary)] max-w-xs leading-relaxed">
                    Build bar charts, scatter plots, histograms, and more from your data.
                  </p>
                  <a
                    href={`/projects/${projectId}/data/${dataset.id}?tab=charts`}
                    className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-white bg-[var(--accent-blue)] hover:opacity-90 transition-opacity"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open Chart Explorer
                  </a>
                </div>
              )}

              {/* VERSIONS */}
              {dataTab === 'versions' && (
                <div className="h-full overflow-y-auto p-5 space-y-3">
                  {versions.length === 0 ? (
                    <p className="text-xs text-[var(--text-tertiary)] text-center py-8">No versions found</p>
                  ) : versions.map(v => (
                    <div
                      key={v.id}
                      onClick={() => { setActiveVersionId(v.id); setDataTab('preview') }}
                      className={cn(
                        'bg-white border rounded-lg p-4 cursor-pointer transition-colors',
                        v.id === activeVersionId
                          ? 'border-[var(--accent-blue)] bg-blue-50/30'
                          : 'border-[var(--border-row)] hover:bg-[var(--bg-row-hover)]'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <GitCommit className="h-4 w-4 text-[var(--text-tertiary)] shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[var(--text-primary)]">v{v.version_number}</p>
                            {v.commit_message && (
                              <p className="text-xs text-[var(--text-secondary)] mt-0.5 truncate">{v.commit_message}</p>
                            )}
                          </div>
                        </div>
                        {v.id === activeVersionId && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[var(--accent-blue)] text-white shrink-0">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex items-center gap-3 text-[10px] text-[var(--text-tertiary)]">
                        <span>{v.row_count.toLocaleString()} rows</span>
                        <span>{v.column_count} cols</span>
                        <span className="ml-auto">{formatDistanceToNow(new Date(v.created_at), { addSuffix: true })}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

            </div>
          </>
        )}
      </div>

      {/* Upload dialog */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Dataset</DialogTitle>
          </DialogHeader>
          <DatasetUpload
            projectId={projectId}
            onSuccess={handleUploadSuccess}
            onCancel={() => setShowUpload(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Dataset list item ────────────────────────────────────────────────────────

interface DatasetListItemProps {
  dataset: Dataset
  isSelected: boolean
  isArchived: boolean
  onSelect: () => void
  onDelete: (id: string) => void
  onArchive: (id: string, archived: boolean) => void
}

function DatasetListItem({ dataset, isSelected, isArchived, onSelect, onDelete, onArchive }: DatasetListItemProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const version = dataset.latest_version

  if (confirmingDelete) {
    return (
      <div className="px-4 py-3 border-b border-[var(--border-row)] flex items-center gap-2">
        <span className="text-xs text-[var(--timeline-flagged)] flex-1 min-w-0 truncate">
          Delete &ldquo;{dataset.name}&rdquo;?
        </span>
        <button
          onClick={() => { onDelete(dataset.id); setConfirmingDelete(false) }}
          className="px-2 py-1 rounded text-xs font-medium bg-[var(--timeline-flagged)] text-white hover:opacity-90 shrink-0"
        >
          Delete
        </button>
        <button
          onClick={() => setConfirmingDelete(false)}
          className="px-2 py-1 rounded text-xs font-medium border border-[var(--border-strong)] text-[var(--text-secondary)] hover:bg-[var(--bg-row-hover)] shrink-0"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'group border-b border-[var(--border-row)] last:border-0 cursor-pointer transition-colors',
        isSelected ? 'bg-blue-50/60' : 'hover:bg-[var(--bg-row-hover)]',
        isArchived && 'opacity-60'
      )}
      onClick={onSelect}
    >
      <div className="px-4 py-3 flex items-start gap-2.5">
        <Database className={cn(
          'h-3.5 w-3.5 mt-0.5 shrink-0',
          isSelected ? 'text-[var(--accent-blue)]' : 'text-[var(--text-tertiary)]'
        )} />
        <div className="flex-1 min-w-0">
          <p className={cn(
            'text-xs truncate leading-snug',
            isSelected ? 'font-semibold text-[var(--accent-blue)]' : 'font-medium text-[var(--text-primary)]'
          )}>
            {dataset.name}
          </p>
          <p className="data-mono-xs text-[var(--text-tertiary)] mt-0.5 truncate">
            {version
              ? `${version.row_count.toLocaleString()} rows · ${version.column_count} cols · v${version.version_number}`
              : 'Processing…'}
          </p>
        </div>
        {/* Hover actions — stop propagation so they don't trigger onSelect */}
        <div
          className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={() => onArchive(dataset.id, !isArchived)}
            className="h-5 w-5 flex items-center justify-center rounded text-[var(--text-tertiary)] hover:bg-white hover:text-[var(--text-secondary)] transition-colors"
            title={isArchived ? 'Unarchive' : 'Archive'}
          >
            {isArchived ? <ArchiveRestore className="h-3 w-3" /> : <Archive className="h-3 w-3" />}
          </button>
          <button
            onClick={() => setConfirmingDelete(true)}
            className="h-5 w-5 flex items-center justify-center rounded text-[var(--text-tertiary)] hover:bg-white hover:text-[var(--timeline-flagged)] transition-colors"
            title="Delete"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
        {isSelected && <ChevronRight className="h-3.5 w-3.5 text-[var(--accent-blue)] shrink-0 mt-0.5" />}
      </div>
    </div>
  )
}
