'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, BarChart2, Loader2, RefreshCw, MoreHorizontal,
  BarChart, LineChart, ScatterChart, TrendingUp, PieChart, Box, Grid3x3,
  Trash2, ExternalLink, Search, Plus, ChevronDown, ChevronRight,
  Hash, Type, Calendar, ToggleLeft, Tag, MapPin, Fingerprint, Copy, ShieldCheck,
  GitMerge, GitCommit, Archive, ArchiveRestore,
} from 'lucide-react'
import { DAGBuilderPanel } from '@/components/analysis/causal/DAGBuilderPanel'
import { DataPortraitPanel } from '@/components/analysis/DataPortraitPanel'
import { EpidemiologicalFingerprint } from '@/components/analysis/EpidemiologicalFingerprint'
import { AnalysisTimeline } from '@/components/analysis/AnalysisTimeline'
import { useDataPortrait } from '@/hooks/useDataPortrait'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DatasetTable } from '@/components/data/DatasetTable'
import { VersionSelector } from '@/components/data/VersionSelector'
import { BranchSelector } from '@/components/data/BranchSelector'
import { DuplicateReviewModal } from '@/components/data/DuplicateReviewModal'
import { ApprovalStatusCard } from '@/components/dataset-hub/ApprovalStatusCard'
import { loadVersionData } from '@/lib/data/storage'
import { detectDuplicates } from '@/lib/data/operations'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import type {
  Dataset, DatasetVersion, DatasetBranch, ParsedDataset,
  DatasetExploration, ChartType, ChartConfig, ColumnSchema,
} from '@/types/database'

// ─── Chart type metadata ──────────────────────────────────────────────────────

const CHART_META: Partial<Record<ChartType, { label: string; icon: React.ReactNode; color: string }>> = {
  bar:       { label: 'Bar',       icon: <BarChart size={14} />,     color: 'bg-indigo-100 text-indigo-700' },
  line:      { label: 'Line',      icon: <LineChart size={14} />,    color: 'bg-blue-100 text-blue-700' },
  area:      { label: 'Area',      icon: <TrendingUp size={14} />,   color: 'bg-cyan-100 text-cyan-700' },
  scatter:   { label: 'Scatter',   icon: <ScatterChart size={14} />, color: 'bg-violet-100 text-violet-700' },
  histogram: { label: 'Histogram', icon: <BarChart size={14} />,     color: 'bg-purple-100 text-purple-700' },
  box:       { label: 'Box Plot',  icon: <Box size={14} />,          color: 'bg-emerald-100 text-emerald-700' },
  pie:       { label: 'Pie',       icon: <PieChart size={14} />,     color: 'bg-rose-100 text-rose-700' },
  donut:     { label: 'Donut',     icon: <PieChart size={14} />,     color: 'bg-pink-100 text-pink-700' },
  heatmap:   { label: 'Heatmap',   icon: <Grid3x3 size={14} />,      color: 'bg-amber-100 text-amber-700' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' })
    .replace(/\//g, '.')
}

function typeLabel(type: string): string {
  const map: Record<string, string> = {
    text: 'TEXT', number: 'NUMERIC', boolean: 'BOOLEAN',
    date: 'DATE', integer: 'INTEGER', float: 'FLOAT',
    categorical: 'ENUM', id: 'ID', geo: 'GEO',
  }
  return map[type] ?? type.toUpperCase()
}

function typeBadgeClass(type: string): string {
  if (['number', 'integer', 'float'].includes(type)) return 'bg-blue-50 text-blue-600'
  if (type === 'date') return 'bg-amber-50 text-amber-700'
  if (type === 'boolean') return 'bg-purple-50 text-purple-700'
  if (type === 'categorical') return 'bg-emerald-50 text-emerald-700'
  if (type === 'id') return 'bg-slate-100 text-slate-500'
  return 'bg-slate-100 text-slate-600'
}

function typeIcon(type: string) {
  if (['number', 'integer', 'float'].includes(type)) return <Hash className="h-3 w-3" />
  if (type === 'text') return <Type className="h-3 w-3" />
  if (type === 'date') return <Calendar className="h-3 w-3" />
  if (type === 'boolean') return <ToggleLeft className="h-3 w-3" />
  if (type === 'categorical') return <Tag className="h-3 w-3" />
  if (type === 'geo') return <MapPin className="h-3 w-3" />
  if (type === 'id') return <Fingerprint className="h-3 w-3" />
  return <Hash className="h-3 w-3" />
}

type TypeGroup = { label: string; icon: React.ReactNode; color: string; bgColor: string }
const TYPE_GROUPS: Record<string, TypeGroup> = {
  numeric:     { label: 'Numeric',     icon: <Hash className="h-3 w-3" />,       color: 'text-blue-700',    bgColor: 'bg-blue-50' },
  text:        { label: 'Text',        icon: <Type className="h-3 w-3" />,       color: 'text-slate-700',   bgColor: 'bg-slate-100' },
  categorical: { label: 'Categorical', icon: <Tag className="h-3 w-3" />,        color: 'text-emerald-700', bgColor: 'bg-emerald-50' },
  date:        { label: 'Date',        icon: <Calendar className="h-3 w-3" />,   color: 'text-amber-700',   bgColor: 'bg-amber-50' },
  boolean:     { label: 'Boolean',     icon: <ToggleLeft className="h-3 w-3" />, color: 'text-purple-700',  bgColor: 'bg-purple-50' },
  other:       { label: 'Other',       icon: <Fingerprint className="h-3 w-3" />,color: 'text-slate-500',   bgColor: 'bg-slate-100' },
}

function getTypeGroup(type: string): string {
  if (['number', 'integer', 'float'].includes(type)) return 'numeric'
  if (type === 'text') return 'text'
  if (type === 'categorical') return 'categorical'
  if (type === 'date') return 'date'
  if (type === 'boolean') return 'boolean'
  return 'other'
}

function MiniDistribution({ col }: { col: ColumnSchema }) {
  const counts = col.value_counts
  if (counts) {
    const vals = Object.values(counts).slice(0, 6)
    const max = Math.max(...vals, 1)
    return (
      <div className="flex items-end gap-0.5 h-5">
        {vals.map((v, i) => (
          <div
            key={i}
            className="w-1.5 rounded-sm"
            style={{ height: `${Math.max(2, Math.round((v / max) * 20))}px`, background: '#003d9b', opacity: 0.25 + 0.75 * (v / max) }}
          />
        ))}
      </div>
    )
  }
  return (
    <div className="flex items-end gap-0.5 h-5">
      {[0.3, 0.6, 1, 0.8, 0.5, 0.3].map((h, i) => (
        <div key={i} className="w-1.5 rounded-sm bg-[#003d9b]" style={{ height: `${h * 20}px`, opacity: h * 0.8 }} />
      ))}
    </div>
  )
}


function ExplorationEmptyCard({ href }: { href: string }) {
  return (
    <div className="bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] overflow-hidden">
      <div className="bg-[#f7f9fb] px-5 pt-5 pb-3">
        <div className="flex items-end gap-1.5 h-14 mb-2">
          {[0.4, 0.7, 0.55, 1, 0.85, 0.6, 0.45, 0.9].map((h, idx) => (
            <div key={idx} className="flex-1 rounded-sm bg-[#003d9b]/20" style={{ height: `${h * 100}%` }} />
          ))}
        </div>
        <div className="flex gap-1">
          {['', '', '', ''].map((_, i) => (
            <div key={i} className="flex-1 h-1 rounded-full bg-slate-200" />
          ))}
        </div>
      </div>
      <div className="p-4 text-center">
        <p className="text-xs font-bold text-[#191c1e]">No explorations yet</p>
        <p className="text-[10px] text-slate-400 mt-1 mb-3 leading-relaxed">
          Build charts, histograms, and scatter plots from your data.
        </p>
        <Link href={href}>
          <button className="w-full py-2 bg-[#003d9b] text-white rounded-lg text-xs font-bold hover:bg-[#0052cc] transition-colors">
            Open Explorer
          </button>
        </Link>
      </div>
    </div>
  )
}

function versionDiff(curr: ColumnSchema[], prev: ColumnSchema[] | undefined) {
  if (!prev) return null
  const prevNames = new Set(prev.map(c => c.name))
  const currNames = new Set(curr.map(c => c.name))
  const added   = curr.filter(c => !prevNames.has(c.name)).length
  const removed = prev.filter(c => !currNames.has(c.name)).length
  return { added, removed }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface DatasetDetailPanelProps {
  datasetId: string
  projectId: string
  showBackLink?: boolean
  isArchived?: boolean
  onArchive?: () => void
  onDelete?: () => void
}

export function DatasetDetailPanel({ datasetId, projectId, showBackLink, isArchived, onArchive, onDelete }: DatasetDetailPanelProps) {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: authLoading } = useAuth()

  const [dataset,         setDataset]         = useState<Dataset | null>(null)
  const [versions,        setVersions]        = useState<DatasetVersion[]>([])
  const [branches,        setBranches]        = useState<DatasetBranch[]>([])
  const [activeVersionId, setActiveVersionId] = useState<string>('')
  const [activeBranchId,  setActiveBranchId]  = useState<string>('')
  const [parsedData,      setParsedData]      = useState<ParsedDataset | null>(null)
  const [metaLoading,     setMetaLoading]     = useState(true)
  const [dataLoading,     setDataLoading]     = useState(false)
  const [error,           setError]           = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState<'schema' | 'data' | 'analysis' | 'charts'>(
    searchParams.get('tab') === 'charts' ? 'charts'
      : searchParams.get('tab') === 'data' ? 'data'
      : searchParams.get('tab') === 'analysis' ? 'analysis'
      : 'schema'
  )

  const [schemaSearch,     setSchemaSearch]     = useState('')
  const [schemaTypeFilter, setSchemaTypeFilter] = useState<Set<string>>(new Set())
  const [expandedRow,      setExpandedRow]      = useState<string | null>(null)
  const [savedCharts,      setSavedCharts]      = useState<DatasetExploration[]>([])
  const [chartsLoading,    setChartsLoading]    = useState(false)
  const [deletingId,       setDeletingId]       = useState<string | null>(null)
  const [showDuplicateModal, setShowDuplicateModal] = useState(false)
  const [confirmDelete,      setConfirmDelete]      = useState(false)

  const supabase = createClient()

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [authLoading, user, router])

  useEffect(() => {
    if (!user) return
    const fetchAll = async () => {
      setMetaLoading(true)
      setChartsLoading(true)
      setError(null)
      try {
        const [datasetRes, versionsRes, branchesRes, chartsRes] = await Promise.all([
          supabase.from('datasets').select('*').eq('id', datasetId).single(),
          supabase.from('dataset_versions').select('*').eq('dataset_id', datasetId).order('version_number', { ascending: false }),
          supabase.from('dataset_branches').select('*').eq('dataset_id', datasetId).order('is_default', { ascending: false }),
          supabase.from('dataset_explorations').select('*').eq('dataset_id', datasetId).order('created_at', { ascending: false }),
        ])
        if (datasetRes.error) throw new Error(datasetRes.error.message)
        if (datasetRes.data) setDataset(datasetRes.data)
        const versionList: DatasetVersion[] = versionsRes.data ?? []
        const branchList:  DatasetBranch[]  = branchesRes.data ?? []
        setVersions(versionList)
        setBranches(branchList)
        setSavedCharts((chartsRes.data as DatasetExploration[]) ?? [])
        const defaultBranch = branchList.find(b => b.is_default) ?? branchList[0]
        if (defaultBranch) {
          setActiveBranchId(defaultBranch.id)
          const headVersion = versionList.find(v => v.id === defaultBranch.head_version)
          if (headVersion) setActiveVersionId(headVersion.id)
          else if (versionList.length > 0) setActiveVersionId(versionList[0].id)
        } else if (versionList.length > 0) {
          setActiveVersionId(versionList[0].id)
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load dataset')
      } finally {
        setMetaLoading(false)
        setChartsLoading(false)
      }
    }
    fetchAll()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasetId, user])

  useEffect(() => {
    if (!activeVersionId || versions.length === 0) return
    const version = versions.find(v => v.id === activeVersionId)
    if (!version) return
    setDataLoading(true)
    setError(null)
    loadVersionData(version.file_path)
      .then(data => setParsedData(data))
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load data'))
      .finally(() => setDataLoading(false))
  }, [activeVersionId, versions])

  async function handleDeleteChart(id: string) {
    setDeletingId(id)
    await supabase.from('dataset_explorations').delete().eq('id', id)
    setSavedCharts(prev => prev.filter(c => c.id !== id))
    setDeletingId(null)
  }

  const handleVersionChange = (versionId: string) => {
    setActiveVersionId(versionId)
    setExpandedRow(null)
  }

  const handleBranchChange = (branchId: string) => {
    setActiveBranchId(branchId)
    const branch = branches.find(b => b.id === branchId)
    if (branch) {
      const headVersion = versions.find(v => v.id === branch.head_version)
      if (headVersion) setActiveVersionId(headVersion.id)
    }
  }

  const activeVersion = versions.find(v => v.id === activeVersionId)
  const columns: ColumnSchema[] = parsedData?.columns ?? activeVersion?.schema_info ?? []
  const rowCount    = parsedData?.row_count ?? activeVersion?.row_count ?? 0
  const totalCells  = rowCount * columns.length
  const totalMissing = columns.reduce((acc, c) => acc + c.null_count, 0)
  const missingPct   = totalCells > 0 ? ((totalMissing / totalCells) * 100).toFixed(1) : '0.0'
  const integrityPct = totalCells > 0 ? (100 - (totalMissing / totalCells) * 100).toFixed(1) : '100.0'

  const filteredColumns = useMemo(() =>
    columns.filter(c => {
      const matchesSearch = c.name.toLowerCase().includes(schemaSearch.toLowerCase())
      const matchesType   = schemaTypeFilter.size === 0 || schemaTypeFilter.has(getTypeGroup(c.type))
      return matchesSearch && matchesType
    })
  , [columns, schemaSearch, schemaTypeFilter])

  const duplicateReport = useMemo(() => {
    const rows = parsedData?.rows
    if (!rows || rows.length === 0) return null
    const report = detectDuplicates(rows)
    return report.duplicateGroups.length > 0 ? report : null
  }, [parsedData])

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const col of columns) {
      const g = getTypeGroup(col.type)
      counts[g] = (counts[g] ?? 0) + 1
    }
    return counts
  }, [columns])

  if (authLoading || metaLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!user) return null

  if (!dataset) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <p className="text-muted-foreground text-sm">Dataset not found.</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto bg-[var(--bg-app)]">

      {/* ── COMPACT HEADER ─────────────────────────────────────────────────── */}
      <div className="px-6 pt-5 pb-0 bg-[var(--bg-surface)] border-b border-[var(--border-row)]">

        {showBackLink && (
          <Link
            href={`/projects/${projectId}/data`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All Datasets
          </Link>
        )}

        <div className="flex items-start justify-between gap-4 mb-4">

          {/* Left — name + selectors */}
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)] font-manrope truncate">
              {dataset.name}
            </h1>
            {dataset.description && (
              <p className="text-xs text-[var(--text-tertiary)] mt-0.5 truncate max-w-sm">{dataset.description}</p>
            )}
            {(branches.length > 0 || versions.length > 0) && (
              <div className="flex items-center gap-2 mt-2">
                {branches.length > 0 && activeBranchId && (
                  <BranchSelector branches={branches} currentBranchId={activeBranchId} onBranchChange={handleBranchChange} />
                )}
                {versions.length > 0 && activeVersionId && (
                  <VersionSelector versions={versions} currentVersionId={activeVersionId} onVersionChange={handleVersionChange} />
                )}
              </div>
            )}
          </div>

          {/* Right — stats strip + overflow menu */}
          <div className="flex items-center gap-5 shrink-0">

            {/* Stats strip */}
            <div className="flex items-center gap-4">
              {[
                { label: 'Rows',      value: rowCount.toLocaleString(),  dim: false },
                { label: 'Cols',      value: String(columns.length),     dim: false },
                { label: 'Missing',   value: `${missingPct}%`,           dim: parseFloat(missingPct) > 0 },
                { label: 'Integrity', value: `${integrityPct}%`,         dim: false },
              ].map(({ label, value, dim }) => (
                <div key={label} className="text-right">
                  <p className="section-label mb-0.5">{label}</p>
                  <p className={`data-mono text-sm font-semibold tabular-nums ${
                    dim ? 'text-[var(--status-error)]' : 'text-[var(--accent-blue)]'
                  }`}>
                    {value}
                  </p>
                </div>
              ))}
            </div>

            {/* ••• overflow menu */}
            <DropdownMenu onOpenChange={(open) => { if (!open) setConfirmDelete(false) }}>
              <DropdownMenuTrigger asChild>
                <button className="h-8 w-8 flex items-center justify-center rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] transition-colors">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link href={`/projects/${projectId}/data/${datasetId}/merge`} className="flex items-center gap-2">
                    <GitMerge className="h-3.5 w-3.5" />
                    Merge datasets
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/projects/${projectId}/data/${datasetId}/versions`} className="flex items-center gap-2">
                    <GitCommit className="h-3.5 w-3.5" />
                    Version history
                  </Link>
                </DropdownMenuItem>
                {onArchive && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onArchive} className="flex items-center gap-2">
                      {isArchived
                        ? <><ArchiveRestore className="h-3.5 w-3.5" />Unarchive</>
                        : <><Archive className="h-3.5 w-3.5" />Archive</>
                      }
                    </DropdownMenuItem>
                  </>
                )}
                {onDelete && (
                  <>
                    {!onArchive && <DropdownMenuSeparator />}
                    {confirmDelete ? (
                      <DropdownMenuItem
                        onClick={() => { onDelete(); setConfirmDelete(false) }}
                        className="flex items-center gap-2 text-[var(--status-error)] focus:text-[var(--status-error)]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Confirm delete
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        onClick={(e) => { e.preventDefault(); setConfirmDelete(true) }}
                        className="flex items-center gap-2 text-[var(--status-error)] focus:text-[var(--status-error)]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete dataset
                      </DropdownMenuItem>
                    )}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* ── TABS ── */}
        <div className="flex items-center gap-0">
          {(['schema', 'data', 'analysis', 'charts'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === tab
                  ? 'border-[var(--accent-blue)] text-[var(--accent-blue)]'
                  : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
              }`}
            >
              {tab === 'schema'   ? 'Schema'
                : tab === 'data' ? 'Raw Data'
                : tab === 'analysis' ? 'Analysis'
                : (
                <>
                  Explorations
                  {savedCharts.length > 0 && (
                    <span className="text-[10px] bg-[var(--accent-blue-subtle)] text-[var(--accent-blue)] rounded-full px-1.5 py-0.5 data-mono leading-none">
                      {savedCharts.length}
                    </span>
                  )}
                </>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── TAB CONTENT ── */}
      <div className="px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl text-sm flex items-center justify-between">
            <span>{error}</span>
            <Button variant="ghost" size="sm" onClick={() => {
              setError(null)
              if (activeVersion) {
                setDataLoading(true)
                loadVersionData(activeVersion.file_path)
                  .then(d => setParsedData(d))
                  .catch(e => setError(e instanceof Error ? e.message : 'Failed to load data'))
                  .finally(() => setDataLoading(false))
              }
            }}>
              <RefreshCw className="h-4 w-4 mr-1" />Retry
            </Button>
          </div>
        )}

        {/* ════ SCHEMA TAB ════ */}
        {activeTab === 'schema' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

            {/* ── Left: variable table ──────────────────────────────────────── */}
            <div className="lg:col-span-2">
              <div className="bg-[var(--bg-surface)] rounded-lg border border-[var(--border-default)] shadow-[var(--shadow-xs)]">

                {/* Table header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 p-5 border-b border-[var(--border-subtle)]">
                  <div>
                    <h3 className="text-base font-semibold text-[var(--text-primary)] tracking-tight">Variables</h3>
                    <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                      {dataLoading ? 'Loading…' : (
                        schemaTypeFilter.size > 0 || schemaSearch
                          ? <><span className="font-semibold text-[var(--accent-blue)]">{filteredColumns.length}</span> of {columns.length} shown</>
                          : <>{columns.length} variable{columns.length !== 1 ? 's' : ''}</>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-56">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] h-3.5 w-3.5" />
                      <input
                        value={schemaSearch}
                        onChange={e => setSchemaSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 bg-[var(--bg-inset)] border-none rounded-md text-xs text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:ring-2 focus:ring-[var(--border-focus)] outline-none"
                        placeholder="Search variables…"
                      />
                    </div>
                    {(schemaTypeFilter.size > 0 || schemaSearch) && (
                      <button
                        onClick={() => { setSchemaTypeFilter(new Set()); setSchemaSearch('') }}
                        className="px-2.5 py-1.5 rounded-md text-xs font-medium text-[var(--accent-blue)] bg-[var(--accent-blue-subtle)] hover:opacity-80 transition-opacity whitespace-nowrap"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                {/* Type filters */}
                {columns.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 px-5 py-3 border-b border-[var(--border-subtle)]">
                    {Object.entries(typeCounts).map(([group, count]) => {
                      const g = TYPE_GROUPS[group]
                      const isActive = schemaTypeFilter.size === 0 || schemaTypeFilter.has(group)
                      return (
                        <button
                          key={group}
                          onClick={() => setSchemaTypeFilter(prev => {
                            const next = new Set(prev)
                            if (next.has(group)) { next.delete(group) } else { next.add(group) }
                            return next
                          })}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-all cursor-pointer ${
                            isActive ? `${g.bgColor} ${g.color}` : 'bg-[var(--bg-inset)] text-[var(--text-tertiary)]'
                          } hover:opacity-80`}
                        >
                          {g.icon}
                          {count} {g.label}
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* Table body */}
                {dataLoading ? (
                  <div className="flex items-center justify-center py-14">
                    <Loader2 className="h-5 w-5 animate-spin text-[var(--text-tertiary)]" />
                  </div>
                ) : columns.length === 0 ? (
                  <div className="flex items-center justify-center py-14">
                    <p className="text-sm text-[var(--text-tertiary)]">No schema available yet.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto overflow-y-auto max-h-[560px]">
                    <table className="w-full text-left">
                      <thead className="sticky top-0 bg-[var(--bg-surface)] z-10">
                        <tr className="border-b border-[var(--border-subtle)]">
                          <th className="pb-2.5 pt-3 px-3 w-4" />
                          <th className="section-label pb-2.5 pt-3 px-2">Variable</th>
                          <th className="section-label pb-2.5 pt-3 px-2">Type</th>
                          <th className="section-label pb-2.5 pt-3 px-2">Quality</th>
                          <th className="section-label pb-2.5 pt-3 px-2">Distribution</th>
                          <th className="section-label pb-2.5 pt-3 px-2 text-right">Missing</th>
                        </tr>
                      </thead>
                      <tbody className="text-xs">
                        {filteredColumns.map(col => {
                          const completeness = rowCount > 0 ? ((rowCount - col.null_count) / rowCount) * 100 : 100
                          const cardinalityRatio = rowCount > 0 ? Math.round((col.unique_count / rowCount) * 100) : 0
                          const qualityDot = completeness < 80 ? 'var(--status-error)' : completeness < 95 ? 'var(--status-warning)' : 'var(--status-success)'
                          const isExpanded = expandedRow === col.name
                          return (
                            <React.Fragment key={col.name}>
                              <tr
                                className="group hover:bg-[var(--bg-row-hover)] border-b border-[var(--border-row)] transition-colors cursor-pointer"
                                onClick={() => setExpandedRow(isExpanded ? null : col.name)}
                              >
                                <td className="py-3 px-3 text-[var(--text-tertiary)] group-hover:text-[var(--accent-blue)] transition-colors">
                                  {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                </td>
                                <td className="py-3 px-2 data-mono font-medium text-[var(--accent-blue)]">{col.name}</td>
                                <td className="py-3 px-2">
                                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${typeBadgeClass(col.type)}`}>
                                    {typeIcon(col.type)}{typeLabel(col.type)}
                                  </span>
                                </td>
                                <td className="py-3 px-2">
                                  <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: qualityDot }} />
                                    <span className="data-mono text-[10px] text-[var(--text-tertiary)]">{col.unique_count.toLocaleString()} uniq</span>
                                    {cardinalityRatio <= 5 && col.unique_count > 1 && (
                                      <span className="text-[9px] font-medium text-[var(--status-success-text)] bg-[var(--status-success-bg)] px-1 rounded">low</span>
                                    )}
                                    {cardinalityRatio >= 95 && (
                                      <span className="text-[9px] font-medium text-[var(--status-info-text)] bg-[var(--status-info-bg)] px-1 rounded">id</span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-3 px-2"><MiniDistribution col={col} /></td>
                                <td className="py-3 px-2 text-right data-mono text-[var(--text-tertiary)]">{col.null_count}</td>
                              </tr>
                              {isExpanded && (
                                <tr key={`${col.name}-expanded`} className="bg-[var(--bg-inset)]">
                                  <td colSpan={6} className="px-5 py-4">
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                      {col.min !== undefined && col.min !== null && (
                                        <div className="bg-[var(--bg-surface)] rounded-md p-3 shadow-[var(--shadow-xs)]">
                                          <p className="section-label mb-1">Min</p>
                                          <p className="data-mono text-sm font-semibold text-[var(--text-primary)] truncate">{String(col.min)}</p>
                                        </div>
                                      )}
                                      {col.max !== undefined && col.max !== null && (
                                        <div className="bg-[var(--bg-surface)] rounded-md p-3 shadow-[var(--shadow-xs)]">
                                          <p className="section-label mb-1">Max</p>
                                          <p className="data-mono text-sm font-semibold text-[var(--text-primary)] truncate">{String(col.max)}</p>
                                        </div>
                                      )}
                                      {col.mean !== undefined && col.mean !== null && (
                                        <div className="bg-[var(--bg-surface)] rounded-md p-3 shadow-[var(--shadow-xs)]">
                                          <p className="section-label mb-1">Mean</p>
                                          <p className="data-mono text-sm font-semibold text-[var(--text-primary)]">{col.mean.toFixed(2)}</p>
                                        </div>
                                      )}
                                      {col.unique_count !== undefined && (
                                        <div className="bg-[var(--bg-surface)] rounded-md p-3 shadow-[var(--shadow-xs)]">
                                          <p className="section-label mb-1">Unique</p>
                                          <p className="data-mono text-sm font-semibold text-[var(--text-primary)]">{col.unique_count.toLocaleString()}</p>
                                        </div>
                                      )}
                                    </div>
                                    {col.sample_values?.length > 0 && (
                                      <div className="mt-3">
                                        <p className="section-label mb-2">Sample values</p>
                                        <div className="flex flex-wrap gap-1.5">
                                          {col.sample_values.slice(0, 8).map((v, i) => (
                                            <span key={i} className="px-2 py-0.5 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded text-[10px] data-mono text-[var(--text-secondary)]">
                                              {String(v ?? 'null')}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Footer */}
                {columns.length > 0 && (
                  <div className="px-5 py-3 border-t border-[var(--border-subtle)] flex justify-between items-center">
                    <span className="section-label">
                      {filteredColumns.length < columns.length
                        ? <><span className="text-[var(--accent-blue)]">{filteredColumns.length}</span> of {columns.length} variables</>
                        : <>{columns.length} variable{columns.length !== 1 ? 's' : ''}</>
                      }
                    </span>
                    <span className="data-mono text-[10px] text-[var(--text-tertiary)]">{versions.length} version{versions.length !== 1 ? 's' : ''}</span>
                  </div>
                )}
              </div>
            </div>

            {/* ── Right: sidebar ────────────────────────────────────────────── */}
            <div className="space-y-4">

              {/* Completeness summary — click-through to quality page */}
              {columns.length > 0 && (
                <Link href={`/projects/${projectId}/data/${datasetId}/quality`} className="block">
                  <div className="bg-[var(--bg-surface)] rounded-lg border border-[var(--border-default)] shadow-[var(--shadow-xs)] px-5 py-4 hover:shadow-[var(--shadow-md)] hover:border-[var(--border-status-info)] transition-all cursor-pointer">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold text-[var(--text-primary)]">Completeness</p>
                      <ChevronRight className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
                    </div>
                    <div className="flex items-end gap-1 mb-3">
                      <span className="data-mono text-2xl font-bold tabular-nums text-[var(--accent-blue)]">{integrityPct}%</span>
                      <span className="text-xs text-[var(--text-tertiary)] mb-0.5">integrity</span>
                    </div>
                    {/* Mini bar per column (top 8) */}
                    <div className="space-y-1.5">
                      {columns.slice(0, 8).map(col => {
                        const pct = rowCount > 0 ? ((rowCount - col.null_count) / rowCount) * 100 : 100
                        const barColor = pct < 80 ? 'var(--status-error)' : pct < 95 ? 'var(--status-warning)' : 'var(--status-success)'
                        return (
                          <div key={col.name} className="flex items-center gap-2">
                            <span className="data-mono text-[9px] text-[var(--text-tertiary)] w-24 truncate shrink-0">{col.name}</span>
                            <div className="flex-1 h-1 bg-[var(--bg-inset)] rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: barColor }} />
                            </div>
                            <span className="data-mono text-[9px] text-[var(--text-tertiary)] w-7 text-right shrink-0">{Math.round(pct)}%</span>
                          </div>
                        )
                      })}
                      {columns.length > 8 && (
                        <p className="text-[9px] text-[var(--text-tertiary)] pt-0.5">+{columns.length - 8} more columns</p>
                      )}
                    </div>
                  </div>
                </Link>
              )}

              {/* Quality Intelligence */}
              <Link href={`/projects/${projectId}/data/${datasetId}/quality`} className="block">
                <div className="bg-[var(--bg-surface)] rounded-lg border border-[var(--border-default)] shadow-[var(--shadow-xs)] px-5 py-4 hover:shadow-[var(--shadow-md)] hover:border-[var(--border-status-info)] transition-all cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-[var(--status-info-bg)] rounded-md shrink-0">
                      <ShieldCheck className="h-4 w-4 text-[var(--status-info-text)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">Data Quality Intelligence</p>
                      <p className="text-xs text-[var(--text-tertiary)] mt-0.5">DQI score, dimensions &amp; enumerator metrics</p>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-[var(--text-tertiary)] shrink-0" />
                  </div>
                </div>
              </Link>

              {/* Duplicate records alert */}
              {duplicateReport && (
                <div className="bg-[var(--status-warning-bg)] border border-[var(--border-status-warning)] rounded-lg p-4 shadow-[var(--shadow-xs)]">
                  <div className="flex items-start gap-3">
                    <div className="p-1.5 bg-amber-100 rounded-md shrink-0 mt-0.5">
                      <Copy className="h-3.5 w-3.5 text-[var(--status-warning-text)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-xs font-semibold text-[var(--status-warning-text)]">Duplicate Records</p>
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-200 text-amber-800">
                          {duplicateReport.duplicateGroups.length}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--status-warning-text)] leading-relaxed">
                        <span className="font-semibold">{duplicateReport.totalAffectedRows} records</span> share a duplicate{' '}
                        <span className="data-mono font-semibold">{duplicateReport.idColumn}</span>{' '}
                        ({duplicateReport.percentAffected.toFixed(1)}% of dataset).
                      </p>
                      <button
                        onClick={() => setShowDuplicateModal(true)}
                        className="mt-2.5 w-full py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-xs font-semibold transition-colors"
                      >
                        Review &amp; Resolve
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Version history */}
              <div className="bg-[var(--bg-surface)] rounded-lg border border-[var(--border-default)] shadow-[var(--shadow-xs)] p-5">
                <h3 className="text-xs font-semibold text-[var(--text-primary)] mb-4">Version History</h3>
                {versions.length === 0 ? (
                  <p className="text-xs text-[var(--text-tertiary)] italic">No versions yet.</p>
                ) : (
                  <div className="space-y-4 relative before:content-[''] before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-px before:bg-[var(--border-subtle)]">
                    {versions.slice(0, 5).map((v, idx) => {
                      const isActive = v.id === activeVersionId
                      const prevVersion = versions[idx + 1]
                      const diff = versionDiff(v.schema_info ?? [], prevVersion?.schema_info)
                      return (
                        <div key={v.id} className="relative pl-8">
                          <button
                            onClick={() => handleVersionChange(v.id)}
                            className={`absolute left-0 top-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ring-2 ring-[var(--bg-surface)] transition-colors ${
                              isActive
                                ? 'bg-[var(--accent-blue)] text-white'
                                : 'bg-[var(--bg-inset)] text-[var(--text-tertiary)] hover:bg-[var(--accent-blue-subtle)] hover:text-[var(--accent-blue)]'
                            }`}
                          >
                            {versions.length - idx}
                          </button>
                          {isActive && <p className="section-label text-[var(--accent-blue)] mb-0.5">Current</p>}
                          <p className={`text-xs font-semibold truncate ${isActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                            v{v.version_number} — {v.commit_message || 'Initial upload'}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="data-mono text-[10px] text-[var(--text-tertiary)]">{fmtDateShort(v.created_at)}</p>
                            {diff && (diff.added > 0 || diff.removed > 0) && (
                              <div className="flex items-center gap-1">
                                {diff.added > 0 && <span className="text-[10px] font-semibold text-[var(--status-success-text)]">+{diff.added}</span>}
                                {diff.removed > 0 && <span className="text-[10px] font-semibold text-[var(--status-error-text)]">−{diff.removed}</span>}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
                <Link href={`/projects/${projectId}/data/${datasetId}/versions`}>
                  <button className="mt-4 w-full py-2 bg-[var(--bg-inset)] rounded-md text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface-active)] transition-colors">
                    View all versions
                  </button>
                </Link>
              </div>

              {/* Approval status */}
              {activeVersion && (
                <ApprovalStatusCard
                  datasetId={datasetId}
                  datasetName={dataset?.name ?? datasetId}
                  versionId={activeVersion.id}
                  versionNumber={activeVersion.version_number}
                  projectId={projectId}
                />
              )}

              {/* Saved explorations preview */}
              <div className="bg-[var(--bg-surface)] rounded-lg border border-[var(--border-default)] shadow-[var(--shadow-xs)] p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-[var(--text-primary)]">Explorations</h3>
                  <Link href={`/projects/${projectId}/data/${datasetId}/explore`}>
                    <button className="flex items-center gap-1 text-xs font-medium text-[var(--accent-blue)] hover:opacity-80 transition-opacity">
                      <Plus className="h-3 w-3" />New
                    </button>
                  </Link>
                </div>
                {chartsLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-4 w-4 animate-spin text-[var(--text-tertiary)]" />
                  </div>
                ) : savedCharts.length === 0 ? (
                  <ExplorationEmptyCard href={`/projects/${projectId}/data/${datasetId}/explore`} />
                ) : (
                  <div className="space-y-2">
                    {savedCharts.slice(0, 3).map(chart => {
                      const meta = CHART_META[chart.chart_type] ?? { label: chart.chart_type, icon: <BarChart2 size={12} />, color: '' }
                      return (
                        <div key={chart.id} className="group flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-[var(--bg-row-hover)] transition-colors">
                          <span className="text-[var(--text-tertiary)] shrink-0">{meta.icon}</span>
                          <span className="flex-1 text-xs font-medium text-[var(--text-secondary)] truncate">{chart.title}</span>
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <Link href={`/projects/${projectId}/data/${datasetId}/explore?load=${chart.id}`}>
                              <button className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-surface-active)] transition-colors">
                                <ExternalLink size={11} />
                              </button>
                            </Link>
                            <button
                              onClick={() => handleDeleteChart(chart.id)}
                              disabled={deletingId === chart.id}
                              className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--status-error)] hover:bg-[var(--status-error-bg)] transition-colors"
                            >
                              {deletingId === chart.id ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                    {savedCharts.length > 3 && (
                      <button
                        onClick={() => setActiveTab('charts')}
                        className="w-full pt-2 text-xs font-medium text-[var(--text-tertiary)] hover:text-[var(--accent-blue)] transition-colors text-center"
                      >
                        View all {savedCharts.length} explorations →
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ════ RAW DATA TAB ════ */}
        {activeTab === 'data' && (
          <div className="bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] overflow-hidden" style={{ minHeight: 400 }}>
            {dataLoading ? (
              <div className="flex items-center justify-center py-24">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-[#003d9b]/40 mx-auto mb-3" />
                  <p className="text-sm text-slate-400">Loading data…</p>
                </div>
              </div>
            ) : parsedData ? (
              <DatasetTable rows={parsedData.rows} columns={parsedData.columns} className="h-full" />
            ) : !error ? (
              <div className="flex items-center justify-center py-24">
                <p className="text-sm text-slate-400">No data available for this version.</p>
              </div>
            ) : null}
          </div>
        )}

        {/* ════ ANALYSIS TAB ════ */}
        {activeTab === 'analysis' && (
          <div className="space-y-8">

            {/* Analysis Timeline — full width */}
            <AnalysisTimeline datasetId={datasetId} />

            {/* DAG Builder — full width, needs room */}
            {activeVersionId && columns.length > 0 && (
              <DAGBuilderPanel
                projectId={projectId}
                datasetId={datasetId}
                versionId={activeVersionId}
                availableVariables={columns.map(c => c.name)}
              />
            )}

            {/* Portrait + Fingerprint — side by side */}
            {activeVersionId && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                <DataPortraitPanel
                  datasetId={datasetId}
                  projectId={projectId}
                  versionId={activeVersionId}
                />
                <PortraitFingerprint
                  datasetId={datasetId}
                  projectId={projectId}
                  versionId={activeVersionId}
                />
              </div>
            )}

            {/* Empty state when no version loaded yet */}
            {!activeVersionId && (
              <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
                <div className="w-10 h-10 rounded-xl bg-[var(--bg-inset)] flex items-center justify-center">
                  <BarChart2 className="h-5 w-5 text-[var(--text-tertiary)]" />
                </div>
                <p className="text-sm font-semibold text-[var(--text-secondary)]">No version loaded</p>
                <p className="text-xs text-[var(--text-tertiary)] max-w-xs">
                  Select a version to view analysis tools.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ════ EXPLORATIONS TAB ════ */}
        {activeTab === 'charts' && (
          <div>
            {chartsLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
              </div>
            ) : savedCharts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-5 text-center bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
                <div className="flex items-end gap-2 h-20">
                  {[0.4, 0.7, 0.55, 1, 0.85, 0.6, 0.45, 0.9, 0.75, 0.5].map((h, i) => (
                    <div key={i} className="w-5 rounded-t-sm bg-[#003d9b]/15" style={{ height: `${h * 80}px` }} />
                  ))}
                </div>
                <div>
                  <p className="font-manrope font-bold text-base text-[#191c1e]">No saved explorations yet</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs">
                    Open the Explorer to build bar charts, histograms, scatter plots, and more — then save them here.
                  </p>
                </div>
                <Link href={`/projects/${projectId}/data/${datasetId}/explore`}>
                  <button className="inline-flex items-center gap-2 bg-[#003d9b] text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#0052cc] transition-colors shadow-lg shadow-[#003d9b]/20">
                    <BarChart2 className="h-4 w-4" />Open Explorer
                  </button>
                </Link>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-6">
                  <p className="text-sm font-semibold text-[#191c1e]">
                    {savedCharts.length} saved exploration{savedCharts.length !== 1 ? 's' : ''}
                  </p>
                  <Link href={`/projects/${projectId}/data/${datasetId}/explore`}>
                    <button className="inline-flex items-center gap-1.5 bg-[#003d9b] text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-[#0052cc] transition-colors">
                      <Plus className="h-3.5 w-3.5" />New Chart
                    </button>
                  </Link>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {savedCharts.map(chart => {
                    const meta = CHART_META[chart.chart_type] ?? { label: chart.chart_type, icon: <BarChart2 size={14} />, color: 'bg-gray-100 text-gray-700' }
                    const cfg = chart.config as ChartConfig
                    return (
                      <div key={chart.id} className="bg-white rounded-xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)] hover:shadow-md transition-shadow flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${meta.color}`}>
                            {meta.icon}{meta.label}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">{fmtDate(chart.created_at)}</span>
                        </div>
                        <div>
                          <p className="font-bold text-sm text-[#191c1e] truncate">{chart.title}</p>
                          {(cfg.x_axis || cfg.y_axis) && (
                            <p className="text-xs text-slate-400 mt-0.5 truncate">
                              {[cfg.x_axis, cfg.y_axis].filter(Boolean).join(' → ')}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-auto pt-1">
                          <Link href={`/projects/${projectId}/data/${datasetId}/explore?load=${chart.id}`} className="flex-1">
                            <button className="w-full flex items-center justify-center gap-1.5 border border-slate-200 rounded-lg py-1.5 text-xs font-semibold text-slate-600 hover:border-[#003d9b] hover:text-[#003d9b] transition-colors">
                              <ExternalLink size={12} />Open
                            </button>
                          </Link>
                          <button
                            onClick={() => handleDeleteChart(chart.id)}
                            disabled={deletingId === chart.id}
                            className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                          >
                            {deletingId === chart.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {showDuplicateModal && duplicateReport && parsedData && activeVersion && user && (
        <DuplicateReviewModal
          rows={parsedData.rows}
          columns={columns}
          datasetId={datasetId}
          projectId={projectId}
          version={activeVersion}
          branchName={branches.find(b => b.id === activeBranchId)?.name ?? 'main'}
          createdBy={user.id}
          onClose={() => setShowDuplicateModal(false)}
          onVersionSaved={(newVersionId) => {
            setShowDuplicateModal(false)
            const supabaseRefresh = createClient()
            supabaseRefresh.from('dataset_versions').select('*').eq('dataset_id', datasetId)
              .order('version_number', { ascending: false })
              .then(({ data }) => {
                if (data) {
                  setVersions(data)
                  setActiveVersionId(newVersionId)
                }
              })
          }}
        />
      )}
    </div>
  )
}

function PortraitFingerprint({ datasetId, projectId, versionId }: { datasetId: string; projectId: string; versionId: string | null }) {
  const { portrait } = useDataPortrait(datasetId, projectId, versionId)
  if (!portrait || portrait.status !== 'complete') return null
  return <EpidemiologicalFingerprint portrait={portrait} />
}
