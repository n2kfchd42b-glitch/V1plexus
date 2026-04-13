'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, BarChart2, Loader2, RefreshCw, MoreHorizontal,
  BarChart, LineChart, ScatterChart, TrendingUp, PieChart, Box, Grid3x3,
  Trash2, ExternalLink, Search, Plus, ChevronDown, ChevronRight,
  Hash, Type, Calendar, ToggleLeft, Tag, MapPin, Fingerprint, Copy, ShieldCheck,
  GitMerge, GitCommit, Archive, ArchiveRestore, AlertTriangle, ChevronsRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DatasetTable } from '@/components/data/DatasetTable'
import { VersionSelector } from '@/components/data/VersionSelector'
import { BranchSelector } from '@/components/data/BranchSelector'
import { DuplicateReviewModal } from '@/components/data/DuplicateReviewModal'
import { CleaningWorkbench } from '@/components/cleaning/CleaningWorkbench'
import { DataQualityScorecard } from '@/components/dataset-hub/DataQualityScorecard'
import { EnumeratorQualityPanel } from '@/components/dataset-hub/EnumeratorQualityPanel'
import { loadVersionData } from '@/lib/data/storage'
import { detectDuplicates } from '@/lib/data/operations'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import type {
  Dataset, DatasetVersion, DatasetBranch, ParsedDataset,
  DatasetExploration, ChartType, ChartConfig, ColumnSchema,
} from '@/types/database'
import type { QualityReport } from '@/types/qualityIntelligence'

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
  if (type === 'id') return 'bg-[var(--bg-inset)] text-[var(--text-tertiary)]'
  return 'bg-[var(--bg-inset)] text-[var(--text-secondary)]'
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
  numeric:     { label: 'Numeric',     icon: <Hash className="h-3 w-3" />,       color: 'text-blue-700',                           bgColor: 'bg-blue-50' },
  text:        { label: 'Text',        icon: <Type className="h-3 w-3" />,       color: 'text-[var(--text-secondary)]',            bgColor: 'bg-[var(--bg-inset)]' },
  categorical: { label: 'Categorical', icon: <Tag className="h-3 w-3" />,        color: 'text-emerald-700',                        bgColor: 'bg-emerald-50' },
  date:        { label: 'Date',        icon: <Calendar className="h-3 w-3" />,   color: 'text-amber-700',                          bgColor: 'bg-amber-50' },
  boolean:     { label: 'Boolean',     icon: <ToggleLeft className="h-3 w-3" />, color: 'text-purple-700',                         bgColor: 'bg-purple-50' },
  other:       { label: 'Other',       icon: <Fingerprint className="h-3 w-3" />,color: 'text-[var(--text-tertiary)]',             bgColor: 'bg-[var(--bg-inset)]' },
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
            className="w-1.5 rounded-sm bg-[var(--accent-blue)]"
            style={{ height: `${Math.max(2, Math.round((v / max) * 20))}px`, opacity: 0.25 + 0.75 * (v / max) }}
          />
        ))}
      </div>
    )
  }
  return (
    <div className="flex items-end gap-0.5 h-5">
      {[0.3, 0.6, 1, 0.8, 0.5, 0.3].map((h, i) => (
        <div key={i} className="w-1.5 rounded-sm bg-[var(--accent-blue)]" style={{ height: `${h * 20}px`, opacity: h * 0.8 }} />
      ))}
    </div>
  )
}


// ─── Component ────────────────────────────────────────────────────────────────

interface DatasetDetailPanelProps {
  datasetId: string
  projectId: string
  showBackLink?: boolean
  isArchived?: boolean
  onArchive?: () => void
  onDelete?: () => void
  onExpandPanel?: () => void
}

export function DatasetDetailPanel({ datasetId, projectId, showBackLink, isArchived, onArchive, onDelete, onExpandPanel }: DatasetDetailPanelProps) {
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

  const [activeTab, setActiveTab] = useState<'schema' | 'data' | 'clean' | 'quality' | 'charts'>(
    searchParams.get('tab') === 'charts' ? 'charts'
      : searchParams.get('tab') === 'data' ? 'data'
      : searchParams.get('tab') === 'clean' ? 'clean'
      : searchParams.get('tab') === 'quality' ? 'quality'
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

  // Quality tab state (lazy — only fetched when tab first opened)
  const [qualityReport,     setQualityReport]     = useState<QualityReport | null | undefined>(undefined)
  const [qualityLoading,    setQualityLoading]    = useState(false)
  const [qualityRecomputing,setQualityRecomputing]= useState(false)
  const [qualitySubTab,     setQualitySubTab]     = useState<'overview' | 'enumerators'>('overview')
  // Clean tab state (lazy mount — workbench only rendered after first activation)
  const [cleanMounted,      setCleanMounted]      = useState(false)

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

  const fetchQualityReport = useCallback(async () => {
    if (!activeVersionId) return
    setQualityLoading(true)
    try {
      const res = await fetch(`/api/datasets/${datasetId}/quality?version_id=${activeVersionId}`)
      setQualityReport(res.ok ? await res.json() : null)
    } finally {
      setQualityLoading(false)
    }
  }, [datasetId, activeVersionId])

  const handleRecomputeQuality = useCallback(async () => {
    if (!activeVersionId) return
    setQualityRecomputing(true)
    try {
      const res = await fetch(`/api/datasets/${datasetId}/quality`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version_id: activeVersionId }),
      })
      if (res.ok) setQualityReport(await res.json())
      else await fetchQualityReport()
    } finally {
      setQualityRecomputing(false)
    }
  }, [datasetId, activeVersionId, fetchQualityReport])

  // Lazy quality fetch — only triggers on first visit to quality tab
  useEffect(() => {
    if (activeTab === 'quality' && qualityReport === undefined && !qualityLoading) {
      fetchQualityReport()
    }
  }, [activeTab, qualityReport, qualityLoading, fetchQualityReport])

  // Lazy clean mount — workbench only instantiated after first tab visit
  useEffect(() => {
    if (activeTab === 'clean') setCleanMounted(true)
  }, [activeTab])

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

        {showBackLink ? (
          <Link
            href={`/projects/${projectId}/data`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All Datasets
          </Link>
        ) : onExpandPanel ? (
          <button
            onClick={onExpandPanel}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors mb-4"
            title="Show dataset list"
          >
            <ChevronsRight className="h-3.5 w-3.5" />
            All Datasets
          </button>
        ) : null}

        <div className="mb-4">
          <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)] font-manrope truncate">
            {dataset.name}
          </h1>
          {dataset.description && (
            <p className="text-xs text-[var(--text-tertiary)] mt-0.5 truncate max-w-lg">{dataset.description}</p>
          )}

          {/* Selectors + stats — all on same row */}
          <div className="flex items-center flex-wrap gap-x-3 gap-y-1.5 mt-2">
            {branches.length > 0 && activeBranchId && (
              <BranchSelector branches={branches} currentBranchId={activeBranchId} onBranchChange={handleBranchChange} />
            )}
            {versions.length > 0 && activeVersionId && (
              <VersionSelector versions={versions} currentVersionId={activeVersionId} onVersionChange={handleVersionChange} />
            )}
            {columns.length > 0 && (
              <span className="text-[var(--border-default)] select-none px-0.5">·</span>
            )}
            {[
              { label: 'Rows',      value: rowCount.toLocaleString(),  dim: false },
              { label: 'Cols',      value: String(columns.length),     dim: false },
              { label: 'Missing',   value: `${missingPct}%`,           dim: parseFloat(missingPct) > 0 },
              { label: 'Integrity', value: `${integrityPct}%`,         dim: false },
            ].map(({ label, value, dim }) => (
              <div key={label} className="flex items-center gap-1">
                <span className="section-label">{label}</span>
                <span className={`data-mono text-xs font-semibold tabular-nums ${
                  dim ? 'text-[var(--status-error)]' : 'text-[var(--accent-blue)]'
                }`}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── TABS ── */}
        <div className="flex items-center gap-1 pt-3">
          {[
            { id: 'schema'  as const, label: 'Schema',       badge: null },
            { id: 'data'    as const, label: 'Raw Data',     badge: null },
            { id: 'clean'   as const, label: 'Clean',        badge: null },
            { id: 'quality' as const, label: 'Quality',      badge: null },
            { id: 'charts'  as const, label: 'Explorations', badge: savedCharts.length > 0 ? savedCharts.length : null },
          ].map(({ id, label, badge }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                activeTab === id
                  ? 'bg-[var(--text-primary)] text-[var(--text-inverse)]'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]'
              }`}
            >
              {label}
              {badge !== null && (
                <span className={`text-[10px] rounded-full px-1.5 py-0.5 leading-none ${
                  activeTab === id ? 'bg-white/20 text-white' : 'bg-[var(--accent-blue-subtle)] text-[var(--accent-blue)]'
                }`}>
                  {badge}
                </span>
              )}
            </button>
          ))}

          {/* Duplicates — direct modal trigger, no intermediate page */}
          {duplicateReport && (
            <>
              <span className="mx-1.5 text-[var(--text-tertiary)] select-none">|</span>
              <button
                onClick={() => setShowDuplicateModal(true)}
                className="px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 text-[var(--status-warning-text)] hover:bg-[var(--status-warning-bg)]"
              >
                <AlertTriangle className="h-3 w-3" />
                {duplicateReport.duplicateGroups.length} Duplicates
              </button>
            </>
          )}

          {/* ••• overflow menu — pushed to far right */}
          <div className="ml-auto">
            <DropdownMenu onOpenChange={(open) => { if (!open) setConfirmDelete(false) }}>
              <DropdownMenuTrigger asChild>
                <button className="h-7 w-7 flex items-center justify-center rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] transition-colors">
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
          <div className="space-y-6">

            {/* ── Variables table — full width ─────────────────────────────── */}
            <div>
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

            {/* ── Completeness — dark card, vertical bars, 5-col scroll ──── */}
            {columns.length > 0 && (
              <div className="bg-[var(--bg-sidebar)] rounded-xl border border-white/10 p-5">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-sm font-semibold text-white">Completeness</h3>
                    <span className="data-mono text-2xl font-bold tabular-nums text-[var(--accent-blue)]">{integrityPct}%</span>
                    <span className="text-xs text-white/40">integrity</span>
                  </div>
                  <button
                    onClick={() => setActiveTab('quality')}
                    className="text-xs font-medium text-[var(--accent-blue)] hover:opacity-80 transition-opacity"
                  >
                    Full quality report →
                  </button>
                </div>

                {/* Legend */}
                <div className="flex items-center gap-4 mb-5">
                  {[
                    { label: '≤5% missing',  color: 'var(--accent-blue)' },
                    { label: '>5% missing',   color: '#f59e0b' },
                    { label: '>10% missing',  color: 'var(--status-error)' },
                  ].map(({ label, color }) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                      <span className="text-[10px] text-white/50">{label}</span>
                    </div>
                  ))}
                </div>

                {/* Scrollable vertical bar columns — 5 visible at a time */}
                <div className="overflow-x-auto pb-1">
                  <div
                    className="flex gap-3"
                    style={{ minWidth: `${columns.length * 72}px` }}
                  >
                    {columns.map(col => {
                      const pct = rowCount > 0 ? ((rowCount - col.null_count) / rowCount) * 100 : 100
                      const missing = 100 - pct
                      const barColor = missing > 10
                        ? 'var(--status-error)'
                        : missing > 5
                        ? '#f59e0b'
                        : 'var(--accent-blue)'
                      return (
                        <div key={col.name} className="flex flex-col items-center gap-2 flex-shrink-0 w-[60px]">
                          <span
                            className="data-mono text-[10px] font-bold tabular-nums"
                            style={{ color: barColor }}
                          >
                            {Math.round(pct)}%
                          </span>
                          <div className="w-9 h-28 bg-white/10 rounded-lg overflow-hidden relative">
                            <div
                              className="absolute bottom-0 left-0 right-0 rounded-lg transition-all duration-300"
                              style={{ height: `${pct}%`, background: barColor }}
                            />
                          </div>
                          <span className="data-mono text-[9px] text-white/50 w-[60px] text-center truncate leading-tight">
                            {col.name}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════ RAW DATA TAB ════ */}
        {activeTab === 'data' && (
          <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-default)] overflow-hidden" style={{ minHeight: 400 }}>
            {dataLoading ? (
              <div className="flex items-center justify-center py-24">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-[var(--accent-blue)] opacity-40 mx-auto mb-3" />
                  <p className="text-sm text-[var(--text-tertiary)]">Loading data…</p>
                </div>
              </div>
            ) : parsedData ? (
              <DatasetTable rows={parsedData.rows} columns={parsedData.columns} className="h-full" />
            ) : !error ? (
              <div className="flex items-center justify-center py-24">
                <p className="text-sm text-[var(--text-tertiary)]">No data available for this version.</p>
              </div>
            ) : null}
          </div>
        )}

        {/* ════ CLEAN TAB ════ */}
        {activeTab === 'clean' && (
          <div className="min-h-[600px]">
            {cleanMounted && activeVersion && parsedData ? (
              <CleaningWorkbench
                datasetId={datasetId}
                projectId={projectId}
                version={activeVersion}
                initialRows={parsedData.rows}
                initialColumns={parsedData.columns}
                branchName={branches.find(b => b.id === activeBranchId)?.name ?? 'main'}
                onVersionSaved={(newVersionId) => {
                  createClient().from('dataset_versions').select('*').eq('dataset_id', datasetId)
                    .order('version_number', { ascending: false })
                    .then(({ data }) => {
                      if (data) { setVersions(data); setActiveVersionId(newVersionId) }
                    })
                  setActiveTab('schema')
                }}
              />
            ) : dataLoading || !parsedData ? (
              <div className="flex items-center justify-center py-24">
                <Loader2 className="h-6 w-6 animate-spin text-[var(--text-tertiary)]" />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
                <p className="text-sm text-[var(--text-secondary)] font-medium">No data loaded</p>
                <p className="text-xs text-[var(--text-tertiary)]">Select a version to use the cleaning workbench.</p>
              </div>
            )}
          </div>
        )}

        {/* ════ QUALITY TAB ════ */}
        {activeTab === 'quality' && (
          <div>
            {/* Sub-tabs + recompute button */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-1">
                {(['overview', 'enumerators'] as const).map(sub => (
                  <button
                    key={sub}
                    onClick={() => setQualitySubTab(sub)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      qualitySubTab === sub
                        ? 'bg-[var(--text-primary)] text-[var(--text-inverse)]'
                        : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]'
                    }`}
                  >
                    {sub === 'overview' ? 'Quality Overview' : 'Enumerator Metrics'}
                  </button>
                ))}
              </div>
              <button
                onClick={handleRecomputeQuality}
                disabled={qualityRecomputing || !activeVersionId}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-colors disabled:opacity-40"
              >
                <RefreshCw className={`h-3 w-3 ${qualityRecomputing ? 'animate-spin' : ''}`} />
                {qualityRecomputing ? 'Recomputing…' : 'Recompute'}
              </button>
            </div>

            {qualityLoading || qualityReport === undefined ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] h-32 animate-pulse" />
                ))}
              </div>
            ) : qualityReport === null ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                <ShieldCheck className="h-10 w-10 text-[var(--text-tertiary)]" />
                <p className="text-[var(--text-secondary)] text-sm font-medium">No quality report computed yet</p>
                <p className="text-xs text-[var(--text-tertiary)] max-w-xs">
                  Run the quality engine to get a DQI score, dimension breakdown, and enumerator analysis.
                </p>
                <button
                  onClick={handleRecomputeQuality}
                  disabled={qualityRecomputing || !activeVersionId}
                  className="mt-2 flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl text-[var(--text-inverse)] bg-[var(--accent-blue)] hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  <RefreshCw className={`h-4 w-4 ${qualityRecomputing ? 'animate-spin' : ''}`} />
                  {qualityRecomputing ? 'Computing…' : 'Compute Quality Report'}
                </button>
              </div>
            ) : qualitySubTab === 'overview' ? (
              <DataQualityScorecard
                report={qualityReport}
                isLoading={qualityRecomputing}
                onRecompute={handleRecomputeQuality}
              />
            ) : (
              <EnumeratorQualityPanel
                metrics={qualityReport.enumerator_metrics ?? null}
                isLoading={qualityRecomputing}
              />
            )}
          </div>
        )}


        {/* ════ EXPLORATIONS TAB ════ */}
        {activeTab === 'charts' && (
          <div>
            {chartsLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-5 w-5 animate-spin text-[var(--text-tertiary)]" />
              </div>
            ) : savedCharts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-5 text-center bg-[var(--bg-surface)] rounded-xl border border-[var(--border-default)]">
                <div className="flex items-end gap-2 h-20">
                  {[0.4, 0.7, 0.55, 1, 0.85, 0.6, 0.45, 0.9, 0.75, 0.5].map((h, i) => (
                    <div key={i} className="w-5 rounded-t-sm bg-[var(--accent-blue-subtle)]" style={{ height: `${h * 80}px` }} />
                  ))}
                </div>
                <div>
                  <p className="font-manrope font-bold text-base text-[var(--text-primary)]">No saved explorations yet</p>
                  <p className="text-xs text-[var(--text-tertiary)] mt-1 max-w-xs">
                    Open the Explorer to build bar charts, histograms, scatter plots, and more — then save them here.
                  </p>
                </div>
                <Link href={`/projects/${projectId}/data/${datasetId}/explore`}>
                  <button className="inline-flex items-center gap-2 bg-[var(--accent-blue)] text-[var(--text-inverse)] px-6 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity">
                    <BarChart2 className="h-4 w-4" />Open Explorer
                  </button>
                </Link>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-6">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    {savedCharts.length} saved exploration{savedCharts.length !== 1 ? 's' : ''}
                  </p>
                  <Link href={`/projects/${projectId}/data/${datasetId}/explore`}>
                    <button className="inline-flex items-center gap-1.5 bg-[var(--accent-blue)] text-[var(--text-inverse)] px-4 py-2 rounded-lg text-xs font-bold hover:opacity-90 transition-opacity">
                      <Plus className="h-3.5 w-3.5" />New Chart
                    </button>
                  </Link>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {savedCharts.map(chart => {
                    const meta = CHART_META[chart.chart_type] ?? { label: chart.chart_type, icon: <BarChart2 size={14} />, color: 'bg-[var(--bg-inset)] text-[var(--text-secondary)]' }
                    const cfg = chart.config as ChartConfig
                    return (
                      <div key={chart.id} className="bg-[var(--bg-surface)] rounded-xl p-5 border border-[var(--border-default)] hover:shadow-[var(--shadow-md)] transition-shadow flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${meta.color}`}>
                            {meta.icon}{meta.label}
                          </span>
                          <span className="data-mono text-[10px] text-[var(--text-tertiary)]">{fmtDate(chart.created_at)}</span>
                        </div>
                        <div>
                          <p className="font-bold text-sm text-[var(--text-primary)] truncate">{chart.title}</p>
                          {(cfg.x_axis || cfg.y_axis) && (
                            <p className="text-xs text-[var(--text-tertiary)] mt-0.5 truncate">
                              {[cfg.x_axis, cfg.y_axis].filter(Boolean).join(' → ')}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-auto pt-1">
                          <Link href={`/projects/${projectId}/data/${datasetId}/explore?load=${chart.id}`} className="flex-1">
                            <button className="w-full flex items-center justify-center gap-1.5 border border-[var(--border-default)] rounded-lg py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:border-[var(--accent-blue)] hover:text-[var(--accent-blue)] transition-colors">
                              <ExternalLink size={12} />Open
                            </button>
                          </Link>
                          <button
                            onClick={() => handleDeleteChart(chart.id)}
                            disabled={deletingId === chart.id}
                            className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--status-error)] hover:bg-[var(--status-error-bg)] transition-colors"
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

