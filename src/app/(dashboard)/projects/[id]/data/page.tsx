'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Plus, Database, Upload, Loader2, Archive } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DatasetCard } from '@/components/data/DatasetCard'
import { DatasetUpload } from '@/components/data/DatasetUpload'
import { LatestAnalysisCards } from '@/components/analysis/LatestAnalysisCards'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Dataset, DatasetVersion } from '@/types/database'

type ForestRow = { name: string; value: number; ciLow: number; ciHigh: number; p: string }
type KMPoint   = { time: number; survival: number; ciLow: number; ciHigh: number; group: string }

export default function ProjectDataPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string
  const { user, loading: authLoading } = useAuth()

  const [datasets, setDatasets]         = useState<Dataset[]>([])
  const [archivedCount, setArchivedCount] = useState(0)
  const [loading, setLoading]           = useState(true)
  const [showUpload, setShowUpload]     = useState(false)
  const [showArchived, setShowArchived] = useState(false)

  // Latest analysis state
  const [latestRunId,     setLatestRunId]     = useState<string | null>(null)
  const [latestRunTitle,  setLatestRunTitle]  = useState<string | null>(null)
  const [latestRunType,   setLatestRunType]   = useState<string>('')
  const [forestRows,      setForestRows]      = useState<ForestRow[]>([])
  const [kmData,          setKmData]          = useState<KMPoint[]>([])
  const [kmGroups,        setKmGroups]        = useState<string[]>([])
  const [plainLanguage,   setPlainLanguage]   = useState<string | null>(null)
  const [interpretation,  setInterpretation]  = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [authLoading, user, router])

  const fetchDatasets = async () => {
    setLoading(true)
    try {
      let query
      if (showArchived) {
        query = supabase
          .from('datasets').select('*').eq('project_id', projectId)
          .is('deleted_at', null).not('archived_at', 'is', null)
          .order('updated_at', { ascending: false })
      } else {
        query = supabase
          .from('datasets').select('*').eq('project_id', projectId)
          .is('deleted_at', null).is('archived_at', null)
          .order('updated_at', { ascending: false })
      }

      const [datasetsRes, archivedRes] = await Promise.all([
        query,
        supabase
          .from('datasets').select('id', { count: 'exact', head: true })
          .eq('project_id', projectId).is('deleted_at', null)
          .not('archived_at', 'is', null),
      ])

      setArchivedCount(archivedRes.count ?? 0)

      if (!datasetsRes.data?.length) { setDatasets([]); return }

      const datasetList: Dataset[] = datasetsRes.data
      const versionsRes = await supabase
        .from('dataset_versions').select('*')
        .in('dataset_id', datasetList.map(d => d.id))
        .order('version_number', { ascending: false })

      const latestVersionMap = new Map<string, DatasetVersion>()
      for (const v of (versionsRes.data ?? []) as DatasetVersion[]) {
        if (!latestVersionMap.has(v.dataset_id)) latestVersionMap.set(v.dataset_id, v)
      }

      setDatasets(datasetList.map(ds => ({ ...ds, latest_version: latestVersionMap.get(ds.id) ?? undefined })))
    } finally {
      setLoading(false)
    }
  }

  const fetchLatestAnalysis = async () => {
    const { data: runs } = await supabase
      .from('analysis_runs')
      .select('id, title, analysis_type, results, interpretation')
      .eq('project_id', projectId)
      .eq('status', 'completed')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1)

    const run = runs?.[0]
    if (!run) return
    setLatestRunId(run.id)
    setLatestRunTitle(run.title ?? null)
    setLatestRunType(run.analysis_type ?? '')
    setInterpretation(run.interpretation ?? null)

    if (!run.results) return
    const res = run.results as Record<string, unknown>
    setPlainLanguage((res.plainLanguage as string) ?? null)
    const charts = (res.charts as Array<{ type: string; data: unknown[]; config?: Record<string, unknown> }>) ?? []

    const forestChart = charts.find(c =>
      ['forest_or', 'forest_hr', 'forest_irr', 'coefficient_plot'].includes(c.type)
    )
    if (forestChart?.data) {
      setForestRows((forestChart.data as Array<Record<string, unknown>>).map(d => ({
        name:   String(d.name ?? ''),
        value:  Number(d.or ?? d.hr ?? d.irr ?? d.estimate ?? 0),
        ciLow:  Number(d.ciLow ?? 0),
        ciHigh: Number(d.ciHigh ?? 0),
        p:      String(d.p ?? ''),
      })))
      return
    }

    const kmChart = charts.find(c => c.type === 'km_curve')
    if (kmChart?.data) {
      const points = (kmChart.data as Array<Record<string, unknown>>).map(d => ({
        time:     Number(d.time ?? 0),
        survival: Number(d.survival ?? 0),
        ciLow:    Number(d.ciLow ?? 0),
        ciHigh:   Number(d.ciHigh ?? 0),
        group:    String(d.group ?? 'All'),
      }))
      setKmData(points)
      const cfgGroups = (kmChart.config as Record<string, unknown>)?.groups as string[] | undefined
      setKmGroups(cfgGroups ?? [...new Set(points.map(d => d.group))])
    }
  }

  useEffect(() => {
    if (user) { fetchDatasets(); fetchLatestAnalysis() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, user, showArchived])

  const handleUploadSuccess = (datasetId: string) => {
    setShowUpload(false)
    router.push(`/projects/${projectId}/data/${datasetId}`)
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('datasets').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    if (error) { toast.error('Failed to delete dataset'); return }
    setDatasets(prev => prev.filter(d => d.id !== id))
    toast.success('Dataset deleted')
  }

  const handleArchive = async (id: string, archive: boolean) => {
    const { error } = await supabase
      .from('datasets').update({ archived_at: archive ? new Date().toISOString() : null }).eq('id', id)
    if (error) { toast.error(archive ? 'Failed to archive dataset' : 'Failed to unarchive dataset'); return }
    setDatasets(prev => prev.filter(d => d.id !== id))
    toast.success(archive ? 'Dataset archived' : 'Dataset unarchived')
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    )
  }
  if (!user) return null

  const totalRecords = datasets.reduce((acc, d) => acc + (d.latest_version?.row_count ?? 0), 0)
  const totalColumns = datasets.reduce((acc, d) => acc + (d.latest_version?.column_count ?? 0), 0)

  const metrics = [
    { label: 'Total Datasets',  value: datasets.length.toString(),             icon: 'database' },
    { label: 'Total Records',   value: totalRecords.toLocaleString(),           icon: 'table_rows' },
    { label: 'Total Columns',   value: totalColumns.toLocaleString(),           icon: 'view_column' },
    { label: 'Archived',        value: archivedCount.toString(),                icon: 'inventory_2' },
  ]

  return (
    <div className="p-8 min-h-screen bg-[#f7f9fb]">

      {/* ── PAGE HEADER ── */}
      <section className="mb-10 flex flex-col gap-6">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="font-manrope text-4xl font-extrabold text-[#191c1e] tracking-tight">Dataset Hub</h1>
            <p className="text-slate-500 text-xs mt-1">Manage and explore project datasets</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowArchived(v => !v)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                showArchived
                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                  : 'bg-white text-slate-600 border border-slate-200 hover:border-[#003d9b]/20 hover:text-[#003d9b]'
              }`}
            >
              <Archive className="h-4 w-4" />
              {showArchived ? 'View Active' : 'View Archived'}
            </button>
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-2 bg-gradient-to-br from-[#003d9b] to-[#0052cc] text-white px-6 py-2.5 rounded-lg font-semibold shadow-lg hover:opacity-90 active:scale-95 transition-all"
            >
              <Upload className="h-4 w-4" />
              Import Dataset
            </button>
          </div>
        </div>

        {/* ── 4-card dark metrics strip ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.map(({ label, value, icon }) => (
            <div
              key={label}
              className="relative bg-[#003d9b] rounded-xl p-5 overflow-hidden shadow-lg shadow-[#003d9b]/15"
            >
              {/* ambient glow */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute -top-4 -right-4 w-24 h-24 bg-white/5 rounded-full blur-2xl" />
              </div>
              <div className="relative z-10 flex items-start justify-between">
                <div>
                  <p className="text-[9px] font-bold text-blue-200/60 uppercase tracking-widest mb-1">{label}</p>
                  <p className="text-3xl font-bold text-white font-manrope leading-none">{value}</p>
                </div>
                <span
                  className="material-symbols-outlined text-2xl text-white/20"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  {icon}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── IMPORT ZONE ── */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
        <div
          onClick={() => setShowUpload(true)}
          className="lg:col-span-2 bg-white p-8 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center min-h-[200px] hover:border-[#003d9b]/30 hover:bg-slate-50 transition-colors group cursor-pointer"
        >
          <div className="flex gap-8 mb-6 opacity-30 grayscale group-hover:grayscale-0 group-hover:opacity-100 transition-all">
            <Database className="h-10 w-10 text-[#003d9b]" />
            <Upload className="h-10 w-10 text-[#003d9b]" />
          </div>
          <p className="text-slate-400 font-medium text-sm">Drag and drop files or connect to source</p>
          <div className="flex gap-4 mt-6">
            {['KoboToolbox', 'REDCap', 'CSV / JSON'].map(src => (
              <span key={src} className="px-4 py-1.5 bg-slate-100 rounded font-mono text-xs text-slate-500">{src}</span>
            ))}
          </div>
        </div>

        {/* Quick Overview Panel */}
        <div className="bg-white p-6 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-slate-100">
          <h3 className="font-bold text-sm text-[#003d9b] mb-4">
            {showArchived ? 'Archived Datasets' : 'Recent Datasets'}
          </h3>
          <div className="space-y-3">
            {datasets.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No datasets yet</p>
            ) : (
              datasets.slice(0, 4).map(d => (
                <div key={d.id} className="flex justify-between items-center border-b border-slate-100 pb-2.5">
                  <span className="text-xs text-slate-600 truncate max-w-[120px]">{d.name}</span>
                  <span className="text-xs font-mono font-semibold text-[#003d9b]">
                    {d.latest_version?.row_count?.toLocaleString() ?? '—'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* ── DATASET CARDS GRID ── */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
        </div>
      ) : datasets.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-slate-100">
          <Database className="h-12 w-12 mx-auto text-[#003d9b]/20 mb-4" />
          {showArchived ? (
            <>
              <p className="text-lg font-semibold font-manrope text-slate-500">No archived datasets</p>
              <p className="text-sm text-slate-400 mt-1">Archived datasets will appear here</p>
            </>
          ) : (
            <>
              <p className="text-lg font-semibold font-manrope text-slate-500">No datasets yet</p>
              <p className="text-sm text-slate-400 mt-1 mb-6">Upload your first dataset to get started</p>
              <button
                onClick={() => setShowUpload(true)}
                className="inline-flex items-center gap-2 bg-gradient-to-br from-[#003d9b] to-[#0052cc] text-white px-6 py-2.5 rounded-lg font-semibold shadow-lg hover:opacity-90 active:scale-95 transition-all"
              >
                <Plus className="h-4 w-4" />
                Import Dataset
              </button>
            </>
          )}
        </div>
      ) : (
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {datasets.map(dataset => (
            <DatasetCard
              key={dataset.id}
              dataset={dataset}
              projectId={projectId}
              onDelete={handleDelete}
              onArchive={handleArchive}
            />
          ))}
        </section>
      )}

      {/* ── LATEST ANALYSIS ── */}
      {latestRunId && (
        <div className="mt-12">
          <LatestAnalysisCards
            projectId={projectId}
            runId={latestRunId}
            runTitle={latestRunTitle}
            analysisType={latestRunType}
            forestRows={forestRows}
            kmData={kmData}
            kmGroups={kmGroups}
            plainLanguage={plainLanguage}
            interpretation={interpretation}
          />
        </div>
      )}

      {/* Upload Dialog */}
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
