'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Plus, Database, Upload, Loader2, Archive } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DatasetCard } from '@/components/data/DatasetCard'
import { DatasetUpload } from '@/components/data/DatasetUpload'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Dataset, DatasetVersion } from '@/types/database'

export default function ProjectDataPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string
  const { user, loading: authLoading } = useAuth()

  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
  }, [authLoading, user, router])

  const fetchDatasets = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('datasets')
        .select('*')
        .eq('project_id', projectId)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })

      if (showArchived) {
        query = supabase
          .from('datasets')
          .select('*')
          .eq('project_id', projectId)
          .is('deleted_at', null)
          .not('archived_at', 'is', null)
          .order('updated_at', { ascending: false })
      } else {
        query = supabase
          .from('datasets')
          .select('*')
          .eq('project_id', projectId)
          .is('deleted_at', null)
          .is('archived_at', null)
          .order('updated_at', { ascending: false })
      }

      const datasetsRes = await query

      if (!datasetsRes.data?.length) {
        setDatasets([])
        return
      }

      const datasetList: Dataset[] = datasetsRes.data
      const datasetIds = datasetList.map(d => d.id)
      const versionsRes = await supabase
        .from('dataset_versions')
        .select('*')
        .in('dataset_id', datasetIds)
        .order('version_number', { ascending: false })

      const latestVersionMap = new Map<string, DatasetVersion>()
      if (versionsRes.data) {
        for (const version of versionsRes.data as DatasetVersion[]) {
          if (!latestVersionMap.has(version.dataset_id)) {
            latestVersionMap.set(version.dataset_id, version)
          }
        }
      }

      const datasetsWithVersions: Dataset[] = datasetList.map(ds => ({
        ...ds,
        latest_version: latestVersionMap.get(ds.id) ?? undefined,
      }))

      setDatasets(datasetsWithVersions)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) {
      fetchDatasets()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, user, showArchived])

  const handleUploadSuccess = (datasetId: string) => {
    setShowUpload(false)
    router.push(`/projects/${projectId}/data/${datasetId}`)
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('datasets')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      toast.error('Failed to delete dataset')
      return
    }
    setDatasets(prev => prev.filter(d => d.id !== id))
    toast.success('Dataset deleted')
  }

  const handleArchive = async (id: string, archive: boolean) => {
    const { error } = await supabase
      .from('datasets')
      .update({ archived_at: archive ? new Date().toISOString() : null })
      .eq('id', id)

    if (error) {
      toast.error(archive ? 'Failed to archive dataset' : 'Failed to unarchive dataset')
      return
    }
    setDatasets(prev => prev.filter(d => d.id !== id))
    toast.success(archive ? 'Dataset archived' : 'Dataset unarchived')
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="h-6 w-6 animate-spin text-on-surface-variant" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  const totalRecords = datasets.reduce((acc, d) => acc + (d.latest_version?.row_count ?? 0), 0)
  const totalColumns = datasets.reduce((acc, d) => acc + (d.latest_version?.column_count ?? 0), 0)

  return (
    <div className="p-8 min-h-screen bg-[#f7f9fb]">

      {/* ── PAGE HEADER ── */}
      <section className="mb-10 flex flex-col gap-6">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="font-manrope text-4xl font-extrabold text-[#191c1e] tracking-tight">Dataset Hub</h1>
            <p className="text-on-surface-variant font-mono text-xs mt-1">
              Manage and explore project datasets
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowArchived(v => !v)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                showArchived
                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              <Archive className="h-4 w-4" />
              {showArchived ? 'View Active' : 'View Archived'}
            </button>
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-2 bg-gradient-to-br from-[#003d9b] to-[#0052cc] text-white px-6 py-2.5 rounded-lg font-semibold shadow-xl hover:opacity-90 active:scale-95 transition-all"
            >
              <Upload className="h-4 w-4" />
              Import Dataset
            </button>
          </div>
        </div>

        {/* Status Strip */}
        <div className="flex gap-8 p-6 bg-white rounded-xl shadow-[0_20px_50px_rgba(0,24,72,0.04)]">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Total Datasets</span>
            <span className="text-2xl font-mono font-medium text-[#003d9b]">{datasets.length}</span>
          </div>
          <div className="w-px h-10 bg-outline-variant/20 self-center" />
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Total Records</span>
            <span className="text-2xl font-mono font-medium text-[#191c1e]">{totalRecords.toLocaleString()}</span>
          </div>
          <div className="w-px h-10 bg-outline-variant/20 self-center" />
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Total Columns</span>
            <span className="text-2xl font-mono font-medium text-[#191c1e]">{totalColumns.toLocaleString()}</span>
          </div>
        </div>
      </section>

      {/* ── IMPORT ZONE ── */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
        <div
          onClick={() => setShowUpload(true)}
          className="lg:col-span-2 bg-white p-8 rounded-xl shadow-[0_20px_50px_rgba(0,24,72,0.04)] border-dashed border-2 border-outline-variant/30 flex flex-col items-center justify-center min-h-[200px] hover:bg-surface-container-low transition-colors group cursor-pointer"
        >
          <div className="flex gap-8 mb-6 opacity-40 grayscale group-hover:grayscale-0 group-hover:opacity-100 transition-all">
            <Database className="h-10 w-10 text-[#003d9b]" />
            <Upload className="h-10 w-10 text-[#003d9b]" />
          </div>
          <p className="text-on-surface-variant font-medium">Drag and drop files or connect to source</p>
          <div className="flex gap-4 mt-6">
            <span className="px-4 py-1.5 bg-surface-container rounded font-mono text-xs text-slate-600">KoboToolbox</span>
            <span className="px-4 py-1.5 bg-surface-container rounded font-mono text-xs text-slate-600">REDCap</span>
            <span className="px-4 py-1.5 bg-surface-container rounded font-mono text-xs text-slate-600">CSV / JSON</span>
          </div>
        </div>

        {/* Quick Overview Panel */}
        <div className="bg-surface-container-low p-6 rounded-xl shadow-[0_20px_50px_rgba(0,24,72,0.04)]">
          <h3 className="font-bold text-sm text-[#003d9b] mb-4">
            {showArchived ? 'Archived Datasets' : 'Recent Datasets'}
          </h3>
          <div className="space-y-4">
            {datasets.length === 0 ? (
              <p className="text-xs text-on-surface-variant italic">No datasets yet</p>
            ) : (
              datasets.slice(0, 4).map(d => (
                <div key={d.id} className="flex justify-between items-center border-b border-outline-variant/10 pb-2">
                  <span className="text-xs text-on-surface-variant truncate max-w-[120px]">{d.name}</span>
                  <span className="text-xs font-mono font-medium text-[#191c1e]">
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
          <Loader2 className="h-6 w-6 animate-spin text-on-surface-variant" />
        </div>
      ) : datasets.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl shadow-[0_20px_50px_rgba(0,24,72,0.04)]">
          <Database className="h-12 w-12 mx-auto text-[#003d9b]/20 mb-4" />
          {showArchived ? (
            <>
              <p className="text-lg font-semibold font-manrope text-on-surface-variant">No archived datasets</p>
              <p className="text-sm text-on-surface-variant mt-1">Archived datasets will appear here</p>
            </>
          ) : (
            <>
              <p className="text-lg font-semibold font-manrope text-on-surface-variant">No datasets yet</p>
              <p className="text-sm text-on-surface-variant mt-1 mb-6">Upload your first dataset to get started</p>
              <button
                onClick={() => setShowUpload(true)}
                className="inline-flex items-center gap-2 bg-gradient-to-br from-[#003d9b] to-[#0052cc] text-white px-6 py-2.5 rounded-lg font-semibold shadow-xl hover:opacity-90 active:scale-95 transition-all"
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
