'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Wand2, BarChart2, GitMerge, GitCommit, Loader2, RefreshCw,
  BarChart, LineChart, ScatterChart, TrendingUp, PieChart, Box, Grid3x3,
  Trash2, ExternalLink, Search, Filter, Plus, ChevronDown, ChevronRight,
  Hash, Type, Calendar, ToggleLeft, Tag, MapPin, Fingerprint, Copy, ShieldCheck,
} from 'lucide-react'
import { DAGBuilderPanel } from '@/components/analysis/causal/DAGBuilderPanel'
import { DataPortraitPanel } from '@/components/analysis/DataPortraitPanel'
import { EpidemiologicalFingerprint } from '@/components/analysis/EpidemiologicalFingerprint'
import { AnalysisTimeline } from '@/components/analysis/AnalysisTimeline'
import { useDataPortrait } from '@/hooks/useDataPortrait'
import { Button } from '@/components/ui/button'
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

function CompletenessChart({ columns, rowCount }: { columns: ColumnSchema[]; rowCount: number }) {
  const [showIncompleteOnly, setShowIncompleteOnly] = useState(false)
  const [sortMode, setSortMode] = useState<'worst_first' | 'best_first' | 'alphabetical'>('worst_first')

  const items = useMemo(() => {
    let list = columns.map(c => ({
      name: c.name,
      pct: rowCount > 0 ? ((rowCount - c.null_count) / rowCount) * 100 : 100,
      type: c.type,
      missing: c.null_count,
    }))
    if (showIncompleteOnly) list = list.filter(c => c.pct < 100)
    if (sortMode === 'worst_first')    list.sort((a, b) => a.pct - b.pct)
    else if (sortMode === 'best_first') list.sort((a, b) => b.pct - a.pct)
    else list.sort((a, b) => a.name.localeCompare(b.name))
    return list
  }, [columns, rowCount, showIncompleteOnly, sortMode])

  const incompleteCount = useMemo(() =>
    columns.filter(c => (rowCount > 0 ? ((rowCount - c.null_count) / rowCount) * 100 : 100) < 100).length,
    [columns, rowCount]
  )

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <button
          onClick={() => setShowIncompleteOnly(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
            showIncompleteOnly ? 'bg-white/20 text-white' : 'bg-white/8 text-white/50 hover:bg-white/12 hover:text-white/70'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
          Incomplete only
          {incompleteCount > 0 && <span className="ml-0.5 text-[10px] opacity-70">({incompleteCount})</span>}
        </button>
        <div className="flex items-center gap-1 ml-auto">
          {(['worst_first', 'best_first', 'alphabetical'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setSortMode(mode)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                sortMode === mode ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white/60'
              }`}
            >
              {mode === 'worst_first' ? 'Worst first' : mode === 'best_first' ? 'Best first' : 'A–Z'}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-y-auto max-h-[220px] space-y-2.5 pr-1 scrollbar-thin">
        {items.length === 0 ? (
          <p className="text-[11px] text-white/40 italic py-4 text-center">All columns are 100% complete</p>
        ) : items.map(col => (
          <div key={col.name} className="flex items-center gap-3">
            <div className="w-36 shrink-0 flex items-center gap-1.5">
              <span className="text-white/40">{typeIcon(col.type)}</span>
              <span className="font-mono text-[10px] text-white/60 truncate">{col.name}</span>
            </div>
            <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${col.pct}%`,
                  background: col.pct < 80 ? '#f87171' : col.pct < 95 ? '#fbbf24' : 'rgba(255,255,255,0.75)',
                }}
              />
            </div>
            <span className="w-12 text-right font-mono text-[10px] shrink-0"
              style={{ color: col.pct < 80 ? '#f87171' : col.pct < 95 ? '#fbbf24' : 'rgba(255,255,255,0.5)' }}>
              {col.pct.toFixed(1)}%
            </span>
            {col.missing > 0 && (
              <span className="w-16 text-right font-mono text-[10px] text-white/30 shrink-0">
                {col.missing.toLocaleString()} null
              </span>
            )}
          </div>
        ))}
      </div>
      <p className="text-[10px] text-white/25 mt-3">
        {showIncompleteOnly
          ? `${items.length} incomplete column${items.length !== 1 ? 's' : ''} of ${columns.length} total`
          : `${items.length} column${items.length !== 1 ? 's' : ''} · scroll to see all`}
      </p>
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
}

export function DatasetDetailPanel({ datasetId, projectId, showBackLink }: DatasetDetailPanelProps) {
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

  const [activeTab, setActiveTab] = useState<'schema' | 'data' | 'charts'>(
    searchParams.get('tab') === 'charts' ? 'charts' : searchParams.get('tab') === 'data' ? 'data' : 'schema'
  )

  const [schemaSearch,     setSchemaSearch]     = useState('')
  const [schemaTypeFilter, setSchemaTypeFilter] = useState<Set<string>>(new Set())
  const [expandedRow,      setExpandedRow]      = useState<string | null>(null)
  const [savedCharts,      setSavedCharts]      = useState<DatasetExploration[]>([])
  const [chartsLoading,    setChartsLoading]    = useState(false)
  const [deletingId,       setDeletingId]       = useState<string | null>(null)
  const [showDuplicateModal, setShowDuplicateModal] = useState(false)

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

  const pipelineSteps = [
    { key: 'import',   label: 'Import',          desc: 'Data loaded',            href: null,                                                       done: true  },
    { key: 'clean',    label: 'Clean',            desc: 'Remove outliers & nulls', href: `/projects/${projectId}/data/${datasetId}/clean`,           done: false },
    { key: 'explore',  label: 'Explore',          desc: 'Visual EDA',              href: `/projects/${projectId}/data/${datasetId}/explore`,         done: false },
    { key: 'quality',  label: 'Quality',          desc: 'Assess completeness',     href: `/projects/${projectId}/data/${datasetId}/quality`,         done: false },
    { key: 'analysis', label: 'Analysis Ready',   desc: 'Run statistical tests',   href: `/projects/${projectId}/analysis`,                          done: false },
  ]

  return (
    <div className="h-full overflow-y-auto bg-[#f7f9fb]">
      <div className="px-8 pt-8 pb-0">
        {showBackLink && (
          <Link
            href={`/projects/${projectId}/data`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#003d9b] transition-colors mb-5"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All Datasets
          </Link>
        )}

        <section className="flex flex-col md:flex-row justify-between items-end gap-6 mb-8">
          <div className="space-y-1.5">
            <div className="flex items-center gap-3">
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-bold font-mono uppercase tracking-widest">
                Dataset
              </span>
              {dataset.description && (
                <span className="text-slate-400 text-xs font-mono truncate max-w-xs">{dataset.description}</span>
              )}
            </div>
            <h1 className="font-manrope text-4xl font-extrabold tracking-tight text-[#191c1e]">
              {dataset.name}
            </h1>
            {(branches.length > 0 || versions.length > 0) && (
              <div className="flex items-center gap-3 pt-1">
                {branches.length > 0 && activeBranchId && (
                  <BranchSelector branches={branches} currentBranchId={activeBranchId} onBranchChange={handleBranchChange} />
                )}
                {versions.length > 0 && activeVersionId && (
                  <VersionSelector versions={versions} currentVersionId={activeVersionId} onVersionChange={handleVersionChange} />
                )}
              </div>
            )}
          </div>

          <div className="flex gap-8 shrink-0">
            {[
              { label: 'Rows',      value: rowCount.toLocaleString(), color: 'text-[#003d9b]' },
              { label: 'Columns',   value: String(columns.length),    color: 'text-[#003d9b]' },
              { label: 'Missing',   value: `${missingPct}%`,          color: 'text-red-500' },
              { label: 'Integrity', value: `${integrityPct}%`,        color: 'text-[#003d9b]' },
            ].map(({ label, value, color }) => (
              <div key={label} className="text-right">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
                <p className={`text-2xl font-mono font-semibold ${color}`}>{value}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── WORKFLOW PIPELINE ── */}
        <section className="mb-8">
          <div className="flex items-stretch gap-0 bg-white rounded-2xl overflow-hidden border border-slate-200/60"
            style={{ boxShadow: '0 4px 20px rgba(0,24,72,0.05)' }}>
            {pipelineSteps.map((step, i) => {
              const isLast = i === pipelineSteps.length - 1
              const content = (
                <div className={`
                  group flex-1 flex items-center gap-3 px-5 py-4 relative
                  ${step.href ? 'cursor-pointer hover:bg-[#f7f9fb] transition-colors' : 'cursor-default'}
                  ${!isLast ? 'border-r border-slate-200/60' : ''}
                `}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold transition-colors
                    ${step.done
                      ? 'bg-[#f0fdf4] text-[#166534]'
                      : 'bg-[#f2f4f6] text-[#A1A1AA] group-hover:bg-[rgba(0,64,162,0.08)] group-hover:text-[#003d9b]'
                    }`}>
                    {step.done ? '✓' : i + 1}
                  </div>
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold leading-none font-manrope ${step.done ? 'text-[#166534]' : 'text-[#18181B]'}`}>
                      {step.label}
                    </p>
                    <p className="text-[11px] text-[#A1A1AA] mt-0.5 leading-none hidden sm:block">{step.desc}</p>
                  </div>
                  {!isLast && (
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10 w-4 h-4 bg-white border-r border-t border-slate-200/60 rotate-45" />
                  )}
                </div>
              )
              return step.href ? (
                <Link key={step.key} href={step.href} className="flex-1 flex">{content}</Link>
              ) : (
                <div key={step.key} className="flex-1 flex">{content}</div>
              )
            })}
          </div>
          <div className="flex items-center gap-3 mt-3">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Actions:</span>
            <button
              onClick={() => router.push(`/projects/${projectId}/data/${datasetId}/merge`)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#52525B] bg-white border border-slate-200 hover:border-[#003d9b] hover:text-[#003d9b] transition-all"
              style={{ boxShadow: '0 2px 8px rgba(0,24,72,0.04)' }}
            >
              <GitMerge className="h-3.5 w-3.5" />
              Merge Datasets
            </button>
            <button
              onClick={() => router.push(`/projects/${projectId}/data/${datasetId}/versions`)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#52525B] bg-white border border-slate-200 hover:border-[#003d9b] hover:text-[#003d9b] transition-all"
              style={{ boxShadow: '0 2px 8px rgba(0,24,72,0.04)' }}
            >
              <GitCommit className="h-3.5 w-3.5" />
              Version Control
            </button>
          </div>
        </section>

        {/* ── TABS ── */}
        <div className="flex items-center gap-0 border-b border-slate-200/60">
          {(['schema', 'data', 'charts'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === tab
                  ? 'border-[#003d9b] text-[#003d9b]'
                  : 'border-transparent text-slate-400 hover:text-slate-700'
              }`}
            >
              {tab === 'schema' ? 'Schema' : tab === 'data' ? 'Raw Data' : (
                <>
                  Explorations
                  {savedCharts.length > 0 && (
                    <span className="text-[10px] bg-[#003d9b]/10 text-[#003d9b] rounded-full px-1.5 py-0.5 font-mono leading-none">
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
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white rounded-xl p-8 shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-5">
                    <div>
                      <h3 className="font-manrope font-bold text-xl text-[#191c1e]">Schema &amp; Variables</h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {dataLoading ? 'Loading schema…' : (
                          schemaTypeFilter.size > 0 || schemaSearch
                            ? <><span className="font-semibold text-[#003d9b]">{filteredColumns.length}</span> of {columns.length} variable{columns.length !== 1 ? 's' : ''} shown</>
                            : <>{columns.length} variable{columns.length !== 1 ? 's' : ''} in this dataset</>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 w-full md:w-auto">
                      <div className="relative flex-1 md:w-60">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-3.5 w-3.5" />
                        <input
                          value={schemaSearch}
                          onChange={e => setSchemaSearch(e.target.value)}
                          className="w-full pl-9 pr-4 py-2 bg-[#f2f4f6] border-none rounded-lg text-xs focus:ring-2 focus:ring-[#003d9b]/20 outline-none"
                          placeholder="Search variables…"
                        />
                      </div>
                      {(schemaTypeFilter.size > 0 || schemaSearch) && (
                        <button
                          onClick={() => { setSchemaTypeFilter(new Set()); setSchemaSearch('') }}
                          className="flex items-center gap-1 px-3 py-2 bg-[#003d9b]/8 rounded-lg text-xs font-bold text-[#003d9b] hover:bg-[#003d9b]/15 transition-colors whitespace-nowrap"
                        >
                          Clear filters
                        </button>
                      )}
                    </div>
                  </div>

                  {columns.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-6 pb-5 border-b border-[#f2f4f6]">
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
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
                              isActive ? `${g.bgColor} ${g.color}` : 'bg-slate-100 text-slate-400'
                            } hover:opacity-80`}
                          >
                            {g.icon}
                            {count} {g.label}
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {dataLoading ? (
                    <div className="flex items-center justify-center py-16">
                      <Loader2 className="h-6 w-6 animate-spin text-[#003d9b]/40" />
                    </div>
                  ) : columns.length === 0 ? (
                    <div className="flex items-center justify-center py-16">
                      <p className="text-sm text-slate-400">No schema available yet.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto overflow-y-auto max-h-[540px]">
                      <table className="w-full text-left">
                        <thead className="text-[10px] uppercase tracking-widest text-slate-400 font-bold sticky top-0 bg-white z-10">
                          <tr className="border-b border-[#f2f4f6]">
                            <th className="pb-3 px-2 w-4" />
                            <th className="pb-3 px-2">Variable</th>
                            <th className="pb-3 px-2">Type</th>
                            <th className="pb-3 px-2">Quality</th>
                            <th className="pb-3 px-2">Distribution</th>
                            <th className="pb-3 px-2 text-right">Missing</th>
                          </tr>
                        </thead>
                        <tbody className="text-xs">
                          {filteredColumns.map(col => {
                            const completeness = rowCount > 0 ? ((rowCount - col.null_count) / rowCount) * 100 : 100
                            const cardinalityRatio = rowCount > 0 ? Math.round((col.unique_count / rowCount) * 100) : 0
                            const qualityDot = completeness < 80 ? '#ef4444' : completeness < 95 ? '#f59e0b' : '#22c55e'
                            const isExpanded = expandedRow === col.name
                            return (
                              <React.Fragment key={col.name}>
                                <tr
                                  className="group hover:bg-[#f7f9fb] border-b border-[#f2f4f6] transition-colors cursor-pointer"
                                  onClick={() => setExpandedRow(isExpanded ? null : col.name)}
                                >
                                  <td className="py-3 px-2 text-slate-300 group-hover:text-[#003d9b] transition-colors">
                                    {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                  </td>
                                  <td className="py-3 px-2 font-mono font-medium text-[#003d9b]">{col.name}</td>
                                  <td className="py-3 px-2">
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${typeBadgeClass(col.type)}`}>
                                      {typeIcon(col.type)}{typeLabel(col.type)}
                                    </span>
                                  </td>
                                  <td className="py-3 px-2">
                                    <div className="flex items-center gap-2">
                                      <div className="w-2 h-2 rounded-full shrink-0"
                                        style={{ background: qualityDot, boxShadow: `0 0 0 2px white, 0 0 0 3px ${qualityDot}` }} />
                                      <span className="font-mono text-[10px] text-slate-400">{col.unique_count.toLocaleString()} uniq</span>
                                      {cardinalityRatio <= 5 && col.unique_count > 1 && (
                                        <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1 rounded">low</span>
                                      )}
                                      {cardinalityRatio >= 95 && (
                                        <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1 rounded">id</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-3 px-2"><MiniDistribution col={col} /></td>
                                  <td className="py-3 px-2 text-right font-mono text-slate-400">{col.null_count}</td>
                                </tr>
                                {isExpanded && (
                                  <tr key={`${col.name}-expanded`} className="bg-[#f7f9fb]">
                                    <td colSpan={6} className="px-6 py-4">
                                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                        {col.min !== undefined && col.min !== null && (
                                          <div className="bg-white rounded-lg p-3 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Min</p>
                                            <p className="font-mono text-sm font-semibold text-[#191c1e] truncate">{String(col.min)}</p>
                                          </div>
                                        )}
                                        {col.max !== undefined && col.max !== null && (
                                          <div className="bg-white rounded-lg p-3 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Max</p>
                                            <p className="font-mono text-sm font-semibold text-[#191c1e] truncate">{String(col.max)}</p>
                                          </div>
                                        )}
                                        {col.mean !== undefined && col.mean !== null && (
                                          <div className="bg-white rounded-lg p-3 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Mean</p>
                                            <p className="font-mono text-sm font-semibold text-[#191c1e]">{col.mean.toFixed(2)}</p>
                                          </div>
                                        )}
                                        {col.unique_count !== undefined && (
                                          <div className="bg-white rounded-lg p-3 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Unique</p>
                                            <p className="font-mono text-sm font-semibold text-[#191c1e]">{col.unique_count.toLocaleString()}</p>
                                          </div>
                                        )}
                                      </div>
                                      {col.sample_values?.length > 0 && (
                                        <div className="mt-3">
                                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Sample values</p>
                                          <div className="flex flex-wrap gap-1.5">
                                            {col.sample_values.slice(0, 8).map((v, i) => (
                                              <span key={i} className="px-2 py-0.5 bg-white border border-[#e0e3e5] rounded text-[10px] font-mono text-slate-600">
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

                  {columns.length > 0 && (
                    <div className="mt-5 pt-4 border-t border-[#f2f4f6] flex justify-between items-center text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                      <span>
                        {filteredColumns.length < columns.length
                          ? <><span className="text-[#003d9b]">{filteredColumns.length}</span> of {columns.length} variables</>
                          : <>{columns.length} variable{columns.length !== 1 ? 's' : ''} · scroll to see all</>
                        }
                      </span>
                      <span className="font-mono text-[#003d9b]/50">{versions.length} version{versions.length !== 1 ? 's' : ''}</span>
                    </div>
                  )}
                </div>

                {activeVersionId && columns.length > 0 && (
                  <DAGBuilderPanel
                    projectId={projectId}
                    datasetId={datasetId}
                    versionId={activeVersionId}
                    availableVariables={columns.map(c => c.name)}
                  />
                )}
              </div>

              <div className="space-y-6">
                {activeVersionId && (
                  <DataPortraitPanel datasetId={datasetId} projectId={projectId} versionId={activeVersionId} />
                )}
                <PortraitFingerprint datasetId={datasetId} projectId={projectId} versionId={activeVersionId} />

                <div className="bg-white rounded-xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
                  <h3 className="font-manrope font-bold text-lg text-[#191c1e] mb-6">Version History</h3>
                  {versions.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No versions yet.</p>
                  ) : (
                    <div className="space-y-5 relative before:content-[''] before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#f2f4f6]">
                      {versions.slice(0, 5).map((v, idx) => {
                        const isActive = v.id === activeVersionId
                        const prevVersion = versions[idx + 1]
                        const diff = versionDiff(v.schema_info ?? [], prevVersion?.schema_info)
                        return (
                          <div key={v.id} className="relative pl-10">
                            <button
                              onClick={() => handleVersionChange(v.id)}
                              className={`absolute left-0 top-1 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ring-4 ring-white transition-colors ${
                                isActive ? 'bg-[#003d9b] text-white' : 'bg-[#f2f4f6] text-slate-500 hover:bg-[#003d9b]/10'
                              }`}
                            >
                              {versions.length - idx}
                            </button>
                            {isActive && <p className="text-[10px] font-bold text-[#003d9b] tracking-widest uppercase mb-0.5">Current</p>}
                            <h4 className={`font-bold text-sm ${isActive ? 'text-[#191c1e]' : 'text-slate-600'}`}>
                              v{v.version_number} — {v.commit_message || 'Initial upload'}
                            </h4>
                            <div className="flex items-center gap-3 mt-0.5">
                              <p className="text-[10px] text-slate-400 font-mono">{fmtDateShort(v.created_at)}</p>
                              {diff && (diff.added > 0 || diff.removed > 0) && (
                                <div className="flex items-center gap-1.5">
                                  {diff.added > 0 && <span className="text-[10px] font-bold text-emerald-600">+{diff.added} col{diff.added > 1 ? 's' : ''}</span>}
                                  {diff.removed > 0 && <span className="text-[10px] font-bold text-red-500">−{diff.removed} col{diff.removed > 1 ? 's' : ''}</span>}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  <Link href={`/projects/${projectId}/data/${datasetId}/versions`}>
                    <button className="mt-6 w-full py-2.5 bg-[#f2f4f6] rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors">
                      View All Versions
                    </button>
                  </Link>
                </div>

                {activeVersion && (
                  <ApprovalStatusCard
                    datasetId={datasetId}
                    datasetName={dataset?.name ?? datasetId}
                    versionId={activeVersion.id}
                    versionNumber={activeVersion.version_number}
                    projectId={projectId}
                  />
                )}

                <Link href={`/projects/${projectId}/data/${datasetId}/quality`} className="block">
                  <div className="bg-white rounded-xl px-5 py-4 shadow-[0_4px_20px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_24px_rgba(0,0,0,0.08)] transition-shadow cursor-pointer border border-transparent hover:border-blue-100">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-blue-50 rounded-lg shrink-0">
                        <ShieldCheck className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-[#191c1e]">Data Quality Intelligence</p>
                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">DQI score, dimension breakdown &amp; enumerator metrics</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-300 shrink-0" />
                    </div>
                  </div>
                </Link>

                {duplicateReport && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 shadow-[0_2px_8px_rgba(217,119,6,0.08)]">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-amber-100 rounded-lg shrink-0 mt-0.5">
                        <Copy className="h-4 w-4 text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-manrope font-bold text-sm text-amber-900">Duplicate Records</h3>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-200 text-amber-800">
                            {duplicateReport.duplicateGroups.length}
                          </span>
                        </div>
                        <p className="text-xs text-amber-700 leading-relaxed">
                          <span className="font-semibold">{duplicateReport.totalAffectedRows} records</span> share a duplicate{' '}
                          <span className="font-mono font-semibold">{duplicateReport.idColumn}</span>{' '}
                          ({duplicateReport.percentAffected.toFixed(1)}% of dataset).
                          {duplicateReport.nearDuplicateGroups.length > 0 && (
                            <> Also found <span className="font-semibold">{duplicateReport.nearDuplicateGroups.length} near-duplicate</span> ID pairs.</>
                          )}
                        </p>
                        <button
                          onClick={() => setShowDuplicateModal(true)}
                          className="mt-3 w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors"
                        >
                          Review &amp; Resolve
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <div className="flex justify-between items-center px-1">
                    <h3 className="font-manrope font-bold text-lg text-[#191c1e]">Saved Explorations</h3>
                    <Link href={`/projects/${projectId}/data/${datasetId}/explore`}>
                      <button className="flex items-center gap-1 text-xs font-semibold text-[#003d9b] hover:text-[#0052cc] transition-colors">
                        <Plus className="h-3.5 w-3.5" />New
                      </button>
                    </Link>
                  </div>
                  {chartsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
                    </div>
                  ) : savedCharts.length === 0 ? (
                    <ExplorationEmptyCard href={`/projects/${projectId}/data/${datasetId}/explore`} />
                  ) : (
                    <>
                      {savedCharts.slice(0, 4).map(chart => {
                        const meta = CHART_META[chart.chart_type] ?? { label: chart.chart_type, icon: <BarChart2 size={14} />, color: 'bg-white/10 text-white/80' }
                        return (
                          <div key={chart.id} className="bg-gradient-to-br from-[#003d9b] to-[#0052cc] rounded-xl overflow-hidden shadow-lg shadow-[#003d9b]/20 hover:-translate-y-0.5 transition-all duration-200">
                            <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/15 text-white/80 mb-2">
                                  {meta.icon}{meta.label}
                                </span>
                                <h4 className="text-xs font-bold text-white truncate">{chart.title}</h4>
                                <p className="text-[10px] text-white/40 mt-0.5">{fmtDate(chart.created_at)}</p>
                              </div>
                              <div className="flex items-center gap-0.5 shrink-0 mt-0.5">
                                <Link href={`/projects/${projectId}/data/${datasetId}/explore?load=${chart.id}`}>
                                  <button className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors">
                                    <ExternalLink size={11} />
                                  </button>
                                </Link>
                                <button
                                  onClick={() => handleDeleteChart(chart.id)}
                                  disabled={deletingId === chart.id}
                                  className="p-1.5 rounded-lg text-white/30 hover:text-red-300 hover:bg-white/10 transition-colors"
                                >
                                  {deletingId === chart.id ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                                </button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                      {savedCharts.length > 4 && (
                        <button
                          onClick={() => setActiveTab('charts')}
                          className="w-full py-2.5 bg-white rounded-xl text-xs font-bold text-slate-500 hover:text-[#003d9b] transition-colors shadow-[0_4px_20px_rgba(0,0,0,0.04)]"
                        >
                          View all {savedCharts.length} explorations →
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-8">
              <AnalysisTimeline datasetId={datasetId} />
            </div>

            {columns.length > 0 && (
              <div className="mt-8 bg-gradient-to-br from-[#003d9b] to-[#0046b0] rounded-xl p-8 shadow-lg shadow-[#003d9b]/25">
                <div className="flex justify-between items-start mb-7">
                  <div>
                    <h3 className="font-manrope font-bold text-lg text-white">Completeness Profile</h3>
                    <p className="text-[10px] text-white/50 mt-0.5">Per-column data completeness · filter and sort below</p>
                  </div>
                  <div className="flex items-center gap-5 text-[10px] font-bold uppercase tracking-wider shrink-0">
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-red-400" /><span className="text-white/50">&lt; 80%</span></div>
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-amber-400" /><span className="text-white/50">&lt; 95%</span></div>
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-white/60" /><span className="text-white/50">Complete</span></div>
                  </div>
                </div>
                <CompletenessChart columns={columns} rowCount={rowCount} />
              </div>
            )}
          </>
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
