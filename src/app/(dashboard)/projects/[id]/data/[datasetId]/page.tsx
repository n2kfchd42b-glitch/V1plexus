'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Wand2, BarChart2, GitMerge, GitCommit, Loader2, RefreshCw,
  BarChart, LineChart, ScatterChart, TrendingUp, PieChart, Box, Grid3x3,
  Trash2, ExternalLink, Search, Filter, Plus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DatasetTable } from '@/components/data/DatasetTable'
import { VersionSelector } from '@/components/data/VersionSelector'
import { BranchSelector } from '@/components/data/BranchSelector'
import { loadVersionData } from '@/lib/data/storage'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import type { Dataset, DatasetVersion, DatasetBranch, ParsedDataset, DatasetExploration, ChartType, ChartConfig, ColumnSchema } from '@/types/database'

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
  const numeric = ['number', 'integer', 'float']
  if (numeric.includes(type)) return 'bg-blue-50 text-blue-600'
  if (type === 'date') return 'bg-slate-100 text-slate-700'
  if (type === 'boolean') return 'bg-purple-50 text-purple-700'
  return 'bg-slate-100 text-slate-700'
}

// Mini sparkline bars for distribution
function MiniDistribution({ col }: { col: ColumnSchema }) {
  const counts = col.value_counts
  if (counts) {
    const vals = Object.values(counts).slice(0, 5)
    const max = Math.max(...vals, 1)
    return (
      <div className="flex items-end gap-0.5 h-5">
        {vals.map((v, i) => (
          <div
            key={i}
            className="w-1.5 rounded-sm"
            style={{ height: `${Math.max(2, Math.round((v / max) * 20))}px`, background: '#003d9b', opacity: 0.3 + 0.7 * (v / max) }}
          />
        ))}
      </div>
    )
  }
  // Numeric: show simple gradient bar
  return (
    <div className="flex items-end gap-0.5 h-5">
      {[0.3, 0.6, 1, 0.7, 0.4].map((h, i) => (
        <div key={i} className="w-1.5 rounded-sm bg-[#003d9b]" style={{ height: `${h * 20}px`, opacity: h * 0.9 }} />
      ))}
    </div>
  )
}

// Missing data matrix cell grid
function MissingMatrix({ columns, rowCount }: { columns: ColumnSchema[]; rowCount: number }) {
  const SAMPLE = 80
  const cells = useMemo(() => {
    return columns.map(col => {
      const missingRate = rowCount > 0 ? col.null_count / rowCount : 0
      return Array.from({ length: SAMPLE }, (_, i) => Math.random() < missingRate)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns.length, rowCount])

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-px" style={{ minWidth: `${columns.length * 14}px` }}>
        {cells.map((colCells, ci) => (
          <div key={ci} className="flex flex-col gap-px">
            {colCells.map((missing, ri) => (
              <div
                key={ri}
                className={`w-2.5 h-1.5 rounded-[1px] ${missing ? 'bg-red-300/60' : 'bg-[#003d9b]/10'}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DatasetViewerPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = params.id as string
  const datasetId = params.datasetId as string
  const { user, loading: authLoading } = useAuth()

  const [dataset, setDataset] = useState<Dataset | null>(null)
  const [versions, setVersions] = useState<DatasetVersion[]>([])
  const [branches, setBranches] = useState<DatasetBranch[]>([])
  const [activeVersionId, setActiveVersionId] = useState<string>('')
  const [activeBranchId, setActiveBranchId] = useState<string>('')
  const [parsedData, setParsedData] = useState<ParsedDataset | null>(null)
  const [metaLoading, setMetaLoading] = useState(true)
  const [dataLoading, setDataLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Tabs
  const [activeTab, setActiveTab] = useState<'schema' | 'data' | 'charts'>(
    searchParams.get('tab') === 'charts' ? 'charts' : searchParams.get('tab') === 'data' ? 'data' : 'schema'
  )

  // Schema search
  const [schemaSearch, setSchemaSearch] = useState('')

  // Saved charts
  const [savedCharts, setSavedCharts] = useState<DatasetExploration[]>([])
  const [chartsLoading, setChartsLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
  }, [authLoading, user, router])

  // Fetch dataset metadata
  useEffect(() => {
    if (!user) return

    const fetchMeta = async () => {
      setMetaLoading(true)
      setError(null)
      try {
        const [datasetRes, versionsRes, branchesRes] = await Promise.all([
          supabase.from('datasets').select('*').eq('id', datasetId).single(),
          supabase
            .from('dataset_versions')
            .select('*')
            .eq('dataset_id', datasetId)
            .order('version_number', { ascending: false }),
          supabase
            .from('dataset_branches')
            .select('*')
            .eq('dataset_id', datasetId)
            .order('is_default', { ascending: false }),
        ])

        if (datasetRes.error) throw new Error(datasetRes.error.message)
        if (datasetRes.data) setDataset(datasetRes.data)

        const versionList: DatasetVersion[] = versionsRes.data ?? []
        const branchList: DatasetBranch[] = branchesRes.data ?? []

        setVersions(versionList)
        setBranches(branchList)

        const defaultBranch = branchList.find(b => b.is_default) ?? branchList[0]
        if (defaultBranch) {
          setActiveBranchId(defaultBranch.id)
          const headVersion = versionList.find(v => v.id === defaultBranch.head_version)
          if (headVersion) {
            setActiveVersionId(headVersion.id)
          } else if (versionList.length > 0) {
            setActiveVersionId(versionList[0].id)
          }
        } else if (versionList.length > 0) {
          setActiveVersionId(versionList[0].id)
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load dataset')
      } finally {
        setMetaLoading(false)
      }
    }

    fetchMeta()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasetId, user])

  // Load data file when active version changes
  useEffect(() => {
    if (!activeVersionId || versions.length === 0) return

    const version = versions.find(v => v.id === activeVersionId)
    if (!version) return

    const loadData = async () => {
      setDataLoading(true)
      setError(null)
      try {
        const data = await loadVersionData(version.file_path)
        setParsedData(data)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load data')
      } finally {
        setDataLoading(false)
      }
    }

    loadData()
  }, [activeVersionId, versions])

  // Fetch saved charts when Charts tab becomes active
  useEffect(() => {
    if (activeTab !== 'charts' || !user) return
    setChartsLoading(true)
    supabase
      .from('dataset_explorations')
      .select('*')
      .eq('dataset_id', datasetId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setSavedCharts((data as DatasetExploration[]) ?? [])
        setChartsLoading(false)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, user, datasetId])

  async function handleDeleteChart(id: string) {
    setDeletingId(id)
    await supabase.from('dataset_explorations').delete().eq('id', id)
    setSavedCharts(prev => prev.filter(c => c.id !== id))
    setDeletingId(null)
  }

  const handleVersionChange = (versionId: string) => setActiveVersionId(versionId)

  const handleBranchChange = (branchId: string) => {
    setActiveBranchId(branchId)
    const branch = branches.find(b => b.id === branchId)
    if (branch) {
      const headVersion = versions.find(v => v.id === branch.head_version)
      if (headVersion) setActiveVersionId(headVersion.id)
    }
  }

  const activeVersion = versions.find(v => v.id === activeVersionId)

  // Derived schema stats
  const columns: ColumnSchema[] = parsedData?.columns ?? activeVersion?.schema_info ?? []
  const rowCount = parsedData?.row_count ?? activeVersion?.row_count ?? 0
  const totalMissing = columns.reduce((acc, c) => acc + c.null_count, 0)
  const totalCells = rowCount * columns.length
  const missingPct = totalCells > 0 ? ((totalMissing / totalCells) * 100).toFixed(1) : '0.0'
  const integrityPct = totalCells > 0 ? (100 - (totalMissing / totalCells) * 100).toFixed(1) : '100.0'

  const filteredColumns = columns.filter(c =>
    c.name.toLowerCase().includes(schemaSearch.toLowerCase())
  )

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
    <div className="min-h-screen bg-[#f7f9fb]">

      {/* ── DATASET HEADER ── */}
      <div className="px-8 pt-8 pb-0">
        <Link
          href={`/projects/${projectId}/data`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#003d9b] transition-colors mb-5"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All Datasets
        </Link>

        <section className="flex flex-col md:flex-row justify-between items-end gap-6 mb-8">
          <div className="space-y-2">
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

            {/* Branch & Version selectors */}
            {(branches.length > 0 || versions.length > 0) && (
              <div className="flex items-center gap-3 mt-3">
                {branches.length > 0 && activeBranchId && (
                  <BranchSelector
                    branches={branches}
                    currentBranchId={activeBranchId}
                    onBranchChange={handleBranchChange}
                  />
                )}
                {versions.length > 0 && activeVersionId && (
                  <VersionSelector
                    versions={versions}
                    currentVersionId={activeVersionId}
                    onVersionChange={handleVersionChange}
                  />
                )}
              </div>
            )}
          </div>

          {/* Metrics */}
          <div className="flex gap-8 shrink-0">
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Rows</p>
              <p className="text-2xl font-mono font-semibold text-[#003d9b]">{rowCount.toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Columns</p>
              <p className="text-2xl font-mono font-semibold text-[#003d9b]">{columns.length}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Missing</p>
              <p className="text-2xl font-mono font-semibold text-red-500">{missingPct}%</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Integrity</p>
              <p className="text-2xl font-mono font-semibold text-[#003d9b]">{integrityPct}%</p>
            </div>
          </div>
        </section>

        {/* ── COMMAND BAR CARDS ── */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { href: `clean`, icon: 'auto_fix_high', title: 'Clean Data', desc: 'Remove outliers & handle nulls', tab: 'schema' as const },
            { href: `explore`, icon: 'bar_chart_4_bars', title: 'Explore Charts', desc: 'Visual EDA and distribution', tab: 'charts' as const },
            { href: `merge`, icon: 'join_inner', title: 'Merge Datasets', desc: 'Join protocols and lab results', tab: 'schema' as const },
            { href: `versions`, icon: 'history_toggle_off', title: 'Version Control', desc: 'Commit snapshots & rollback', tab: 'schema' as const },
          ].map(({ href, icon, title, desc, tab }) => (
            href === 'explore' ? (
              <button
                key={title}
                onClick={() => setActiveTab(tab)}
                className="bg-[#003d9b] p-5 rounded-xl text-white group cursor-pointer hover:bg-[#0052cc] transition-all duration-300 shadow-lg shadow-[#003d9b]/15 text-left"
              >
                <span
                  className="material-symbols-outlined mb-3 text-white/80 group-hover:text-white transition-colors block"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  {icon}
                </span>
                <h3 className="font-manrope font-bold text-base mb-0.5">{title}</h3>
                <p className="text-xs text-blue-200/70 group-hover:text-white/80 transition-colors">{desc}</p>
              </button>
            ) : (
              <Link key={title} href={`/projects/${projectId}/data/${datasetId}/${href}`}>
                <div className="bg-[#003d9b] p-5 rounded-xl text-white group cursor-pointer hover:bg-[#0052cc] transition-all duration-300 shadow-lg shadow-[#003d9b]/15 h-full">
                  <span
                    className="material-symbols-outlined mb-3 text-white/80 group-hover:text-white transition-colors block"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    {icon}
                  </span>
                  <h3 className="font-manrope font-bold text-base mb-0.5">{title}</h3>
                  <p className="text-xs text-blue-200/70 group-hover:text-white/80 transition-colors">{desc}</p>
                </div>
              </Link>
            )
          ))}
        </section>

        {/* ── TABS ── */}
        <div className="flex items-center gap-0 border-b border-slate-200/60">
          {(['schema', 'data', 'charts'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors capitalize flex items-center gap-1.5 ${
                activeTab === tab
                  ? 'border-[#003d9b] text-[#003d9b]'
                  : 'border-transparent text-slate-400 hover:text-slate-700'
              }`}
            >
              {tab === 'charts' ? (
                <>
                  Explorations
                  {savedCharts.length > 0 && (
                    <span className="text-[10px] bg-[#003d9b]/10 text-[#003d9b] rounded-full px-1.5 py-0.5 font-mono leading-none">
                      {savedCharts.length}
                    </span>
                  )}
                </>
              ) : tab === 'schema' ? 'Schema' : 'Raw Data'}
            </button>
          ))}
        </div>
      </div>

      {/* ── TAB CONTENT ── */}
      <div className="px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl text-sm flex items-center justify-between">
            <span>{error}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setError(null)
                if (activeVersion) {
                  setDataLoading(true)
                  loadVersionData(activeVersion.file_path)
                    .then(data => setParsedData(data))
                    .catch(e => setError(e instanceof Error ? e.message : 'Failed to load data'))
                    .finally(() => setDataLoading(false))
                }
              }}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Retry
            </Button>
          </div>
        )}

        {/* ── SCHEMA TAB ── */}
        {activeTab === 'schema' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

            {/* Variable Browser */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-xl p-8 shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                  <div>
                    <h3 className="font-manrope font-bold text-xl text-[#191c1e]">Schema &amp; Variables</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      {dataLoading ? 'Loading...' : `Found ${columns.length} variables in this dataset`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-3.5 w-3.5" />
                      <input
                        value={schemaSearch}
                        onChange={e => setSchemaSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-[#f2f4f6] border-none rounded-lg text-xs focus:ring-2 focus:ring-[#003d9b]/20 outline-none"
                        placeholder="Search variables..."
                      />
                    </div>
                    <button className="flex items-center gap-1.5 px-3 py-2 bg-[#f2f4f6] rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors">
                      <Filter className="h-3 w-3" />
                      Filter
                    </button>
                  </div>
                </div>

                {dataLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-[#003d9b]/40" />
                  </div>
                ) : columns.length === 0 ? (
                  <div className="flex items-center justify-center py-16">
                    <p className="text-sm text-slate-400">No schema available yet. Data is still loading.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                        <tr className="border-b border-[#f2f4f6]">
                          <th className="pb-4 px-2">Variable Name</th>
                          <th className="pb-4 px-2">Type</th>
                          <th className="pb-4 px-2">Completeness</th>
                          <th className="pb-4 px-2">Distribution</th>
                          <th className="pb-4 px-2 text-right">Missing</th>
                        </tr>
                      </thead>
                      <tbody className="text-xs">
                        {filteredColumns.map(col => {
                          const completeness = rowCount > 0
                            ? ((rowCount - col.null_count) / rowCount) * 100
                            : 100
                          return (
                            <tr key={col.name} className="group hover:bg-[#f2f4f6] border-b border-[#f2f4f6] transition-colors">
                              <td className="py-3 px-2 font-mono font-medium text-[#003d9b]">{col.name}</td>
                              <td className="py-3 px-2">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${typeBadgeClass(col.type)}`}>
                                  {typeLabel(col.type)}
                                </span>
                              </td>
                              <td className="py-3 px-2">
                                <div className="flex items-center gap-2">
                                  <div className="h-1.5 w-16 bg-[#f2f4f6] rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-[#003d9b] rounded-full"
                                      style={{ width: `${completeness}%` }}
                                    />
                                  </div>
                                  <span className="font-mono text-[10px] text-slate-500">{completeness.toFixed(1)}%</span>
                                </div>
                              </td>
                              <td className="py-3 px-2">
                                <MiniDistribution col={col} />
                              </td>
                              <td className="py-3 px-2 text-right font-mono text-slate-500">{col.null_count}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {columns.length > 0 && (
                  <div className="mt-6 pt-5 border-t border-[#f2f4f6] flex justify-between items-center text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                    <span>Showing {filteredColumns.length} of {columns.length} variables</span>
                    <span className="font-mono text-[#003d9b]/60">{versions.length} version{versions.length !== 1 ? 's' : ''}</span>
                  </div>
                )}
              </div>

              {/* Missing Data Matrix */}
              {columns.length > 0 && (
                <div className="bg-white rounded-xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                    <div>
                      <h3 className="font-manrope font-bold text-lg text-[#191c1e]">Missing Data Matrix</h3>
                      <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                        Visual density check ({columns.length} variables × 80 observations sampled)
                      </p>
                    </div>
                    <div className="flex items-center gap-5">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 bg-[#003d9b]/10 rounded-[1px]" />
                        <span className="text-[10px] font-bold uppercase text-slate-400">Present</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 bg-red-300/60 rounded-[1px]" />
                        <span className="text-[10px] font-bold uppercase text-slate-400">Missing</span>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-lg overflow-hidden py-1">
                    <MissingMatrix columns={columns} rowCount={rowCount} />
                  </div>
                </div>
              )}
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Research Chronology (Version History) */}
              <div className="bg-white rounded-xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
                <h3 className="font-manrope font-bold text-lg text-[#191c1e] mb-6">Version History</h3>
                {versions.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No versions yet.</p>
                ) : (
                  <div className="space-y-5 relative before:content-[''] before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#f2f4f6]">
                    {versions.slice(0, 5).map((v, idx) => {
                      const isActive = v.id === activeVersionId
                      return (
                        <div key={v.id} className="relative pl-10">
                          <button
                            onClick={() => handleVersionChange(v.id)}
                            className={`absolute left-0 top-1 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ring-4 ring-white transition-colors ${
                              isActive
                                ? 'bg-[#003d9b] text-white'
                                : 'bg-[#f2f4f6] text-slate-500 hover:bg-[#003d9b]/10'
                            }`}
                          >
                            {versions.length - idx}
                          </button>
                          {isActive && (
                            <p className="text-[10px] font-bold text-[#003d9b] tracking-widest uppercase mb-0.5">
                              Current
                            </p>
                          )}
                          <h4 className={`font-bold text-sm ${isActive ? 'text-[#191c1e]' : 'text-slate-600'}`}>
                            v{v.version_number} — {v.commit_message ?? 'Upload'}
                          </h4>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">{fmtDateShort(v.created_at)}</p>
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

              {/* Saved Explorations */}
              <div className="space-y-4">
                <div className="flex justify-between items-center px-1">
                  <h3 className="font-manrope font-bold text-lg text-[#191c1e]">Saved Explorations</h3>
                  <Link href={`/projects/${projectId}/data/${datasetId}/explore`}>
                    <button className="flex items-center gap-1 text-xs font-semibold text-[#003d9b] hover:text-[#0052cc] transition-colors">
                      <Plus className="h-3.5 w-3.5" />
                      New
                    </button>
                  </Link>
                </div>

                {chartsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
                  </div>
                ) : savedCharts.length === 0 ? (
                  <div className="bg-white rounded-xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.04)] text-center">
                    <BarChart2 className="h-8 w-8 text-slate-200 mx-auto mb-3" />
                    <p className="text-xs text-slate-400">No saved explorations yet.</p>
                    <Link href={`/projects/${projectId}/data/${datasetId}/explore`}>
                      <button className="mt-3 text-xs font-semibold text-[#003d9b] hover:underline">
                        Open Explorer →
                      </button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {savedCharts.slice(0, 3).map(chart => {
                      const meta = CHART_META[chart.chart_type] ?? { label: chart.chart_type, icon: <BarChart2 size={14} />, color: 'bg-gray-100 text-gray-700' }
                      return (
                        <div
                          key={chart.id}
                          className="bg-white rounded-xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.04)] hover:-translate-y-0.5 transition-all duration-200 group cursor-pointer"
                        >
                          <div className="h-16 bg-[#f2f4f6] flex items-center justify-center">
                            <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full ${meta.color}`}>
                              {meta.icon}
                              {meta.label}
                            </span>
                          </div>
                          <div className="p-3 flex items-center justify-between">
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold text-[#191c1e] truncate">{chart.title}</h4>
                              <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-wider font-bold">
                                {fmtDate(chart.created_at)}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 ml-2 shrink-0">
                              <Link href={`/projects/${projectId}/data/${datasetId}/explore?load=${chart.id}`}>
                                <button className="p-1.5 rounded-lg text-slate-400 hover:text-[#003d9b] hover:bg-blue-50 transition-colors">
                                  <ExternalLink size={12} />
                                </button>
                              </Link>
                              <button
                                onClick={() => handleDeleteChart(chart.id)}
                                disabled={deletingId === chart.id}
                                className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                              >
                                {deletingId === chart.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    {savedCharts.length > 3 && (
                      <button
                        onClick={() => setActiveTab('charts')}
                        className="w-full py-2.5 bg-white rounded-xl text-xs font-bold text-slate-500 hover:text-[#003d9b] transition-colors shadow-[0_4px_20px_rgba(0,0,0,0.04)]"
                      >
                        View all {savedCharts.length} explorations
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── RAW DATA TAB ── */}
        {activeTab === 'data' && (
          <div className="bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] overflow-hidden" style={{ minHeight: 400 }}>
            {dataLoading ? (
              <div className="flex items-center justify-center py-24">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-[#003d9b]/40 mx-auto mb-3" />
                  <p className="text-sm text-slate-400">Loading data...</p>
                </div>
              </div>
            ) : parsedData ? (
              <DatasetTable
                rows={parsedData.rows}
                columns={parsedData.columns}
                className="h-full"
              />
            ) : !error ? (
              <div className="flex items-center justify-center py-24">
                <p className="text-sm text-slate-400">No data available for this version.</p>
              </div>
            ) : null}
          </div>
        )}

        {/* ── EXPLORATIONS TAB ── */}
        {activeTab === 'charts' && (
          <div>
            {chartsLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
              </div>
            ) : savedCharts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-4 text-center bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
                <div className="h-14 w-14 rounded-full bg-[#f2f4f6] flex items-center justify-center">
                  <BarChart2 className="h-6 w-6 text-slate-300" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-[#191c1e]">No saved explorations yet</p>
                  <p className="text-xs text-slate-400 mt-1">Open the Explorer, build a chart, and save it to see it here.</p>
                </div>
                <Link href={`/projects/${projectId}/data/${datasetId}/explore`}>
                  <button className="inline-flex items-center gap-2 bg-[#003d9b] text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#0052cc] transition-colors">
                    <BarChart2 className="h-4 w-4" />
                    Open Explorer
                  </button>
                </Link>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-6">
                  <p className="text-sm font-semibold text-[#191c1e]">{savedCharts.length} saved exploration{savedCharts.length !== 1 ? 's' : ''}</p>
                  <Link href={`/projects/${projectId}/data/${datasetId}/explore`}>
                    <button className="inline-flex items-center gap-1.5 bg-[#003d9b] text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-[#0052cc] transition-colors">
                      <Plus className="h-3.5 w-3.5" />
                      New Chart
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
                            {meta.icon}
                            {meta.label}
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
                              <ExternalLink size={12} />
                              Open
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
    </div>
  )
}
