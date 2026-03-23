'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Wand2, BarChart2, GitMerge, GitCommit, Loader2, RefreshCw,
  BarChart, LineChart, ScatterChart, TrendingUp, PieChart, Box, Grid3x3,
  Trash2, ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DatasetTable } from '@/components/data/DatasetTable'
import { VersionSelector } from '@/components/data/VersionSelector'
import { BranchSelector } from '@/components/data/BranchSelector'
import { loadVersionData } from '@/lib/data/storage'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import type { Dataset, DatasetVersion, DatasetBranch, ParsedDataset, DatasetExploration, ChartType, ChartConfig } from '@/types/database'

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
  const [activeTab, setActiveTab] = useState<'data' | 'charts'>(
    searchParams.get('tab') === 'charts' ? 'charts' : 'data'
  )

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
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-0 border-b bg-white shrink-0">
        <Link href={`/projects/${projectId}/data`}>
          <Button variant="ghost" size="sm" className="mb-3 h-7 text-xs -ml-2">
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            All Datasets
          </Button>
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900 truncate">{dataset.name}</h1>
            {dataset.description && (
              <p className="text-sm text-muted-foreground mt-0.5 truncate">{dataset.description}</p>
            )}
            {activeVersion && (
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                <span>{activeVersion.row_count.toLocaleString()} rows</span>
                <span>{activeVersion.column_count} columns</span>
                <span>{versions.length} version{versions.length !== 1 ? 's' : ''}</span>
              </div>
            )}
          </div>

          {/* Navigation actions */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <Link href={`/projects/${projectId}/data/${datasetId}/clean`}>
              <Button variant="outline" size="sm">
                <Wand2 className="h-4 w-4 mr-1.5" />
                Clean
              </Button>
            </Link>
            <Link href={`/projects/${projectId}/data/${datasetId}/explore`}>
              <Button variant="outline" size="sm">
                <BarChart2 className="h-4 w-4 mr-1.5" />
                Explore
              </Button>
            </Link>
<Link href={`/projects/${projectId}/data/${datasetId}/versions`}>
              <Button variant="outline" size="sm">
                <GitCommit className="h-4 w-4 mr-1.5" />
                Versions
              </Button>
            </Link>
            <Link href={`/projects/${projectId}/data/${datasetId}/merge`}>
              <Button variant="outline" size="sm">
                <GitMerge className="h-4 w-4 mr-1.5" />
                Merge
              </Button>
            </Link>
          </div>
        </div>

        {/* Branch and Version selectors */}
        {(branches.length > 0 || versions.length > 0) && (
          <div className="flex items-center gap-4 mt-4">
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

        {/* Tabs */}
        <div className="flex items-center gap-0 mt-4">
          {(['data', 'charts'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === tab
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab === 'data' ? 'Data' : (
                <>
                  Charts
                  {savedCharts.length > 0 && (
                    <span className="text-[10px] bg-primary/10 text-primary rounded-full px-1.5 py-0.5 font-mono leading-none">
                      {savedCharts.length}
                    </span>
                  )}
                </>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden">
        {error && (
          <div className="m-6 p-4 bg-red-50 text-red-700 rounded-lg text-sm flex items-center justify-between">
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

        {/* ── Data tab ── */}
        {activeTab === 'data' && (
          dataLoading ? (
            <div className="flex items-center justify-center h-full min-h-[300px]">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Loading data...</p>
              </div>
            </div>
          ) : parsedData ? (
            <DatasetTable
              rows={parsedData.rows}
              columns={parsedData.columns}
              className="h-full"
            />
          ) : !error ? (
            <div className="flex items-center justify-center h-full min-h-[300px]">
              <p className="text-sm text-muted-foreground">No data available for this version.</p>
            </div>
          ) : null
        )}

        {/* ── Charts tab ── */}
        {activeTab === 'charts' && (
          <div className="h-full overflow-y-auto p-6">
            {chartsLoading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : savedCharts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
                <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
                  <BarChart2 className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium text-sm">No saved charts yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Open the Explorer, build a chart, and save it to see it here.
                  </p>
                </div>
                <Link href={`/projects/${projectId}/data/${datasetId}/explore`}>
                  <Button size="sm">
                    <BarChart2 className="h-3.5 w-3.5 mr-1.5" />
                    Open Explorer
                  </Button>
                </Link>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-medium">{savedCharts.length} saved chart{savedCharts.length !== 1 ? 's' : ''}</p>
                  <Link href={`/projects/${projectId}/data/${datasetId}/explore`}>
                    <Button variant="outline" size="sm">
                      <BarChart2 className="h-3.5 w-3.5 mr-1.5" />
                      New Chart
                    </Button>
                  </Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {savedCharts.map(chart => {
                    const meta = CHART_META[chart.chart_type] ?? { label: chart.chart_type, icon: <BarChart2 size={14} />, color: 'bg-gray-100 text-gray-700' }
                    const cfg = chart.config as ChartConfig
                    return (
                      <div
                        key={chart.id}
                        className="border rounded-xl bg-white p-4 flex flex-col gap-3 hover:shadow-md transition-shadow"
                      >
                        {/* Type badge */}
                        <div className="flex items-center justify-between">
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${meta.color}`}>
                            {meta.icon}
                            {meta.label}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{fmtDate(chart.created_at)}</span>
                        </div>

                        {/* Title */}
                        <div>
                          <p className="font-semibold text-sm truncate">{chart.title}</p>
                          {(cfg.x_axis || cfg.y_axis) && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              {[cfg.x_axis, cfg.y_axis].filter(Boolean).join(' → ')}
                            </p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 mt-auto pt-1">
                          <Link
                            href={`/projects/${projectId}/data/${datasetId}/explore?load=${chart.id}`}
                            className="flex-1"
                          >
                            <Button variant="outline" size="sm" className="w-full gap-1.5">
                              <ExternalLink size={12} />
                              Open
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:text-destructive px-2"
                            onClick={() => handleDeleteChart(chart.id)}
                            disabled={deletingId === chart.id}
                          >
                            {deletingId === chart.id
                              ? <Loader2 size={13} className="animate-spin" />
                              : <Trash2 size={13} />
                            }
                          </Button>
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
