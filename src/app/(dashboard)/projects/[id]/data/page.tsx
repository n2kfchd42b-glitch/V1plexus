'use client'

import { useState, useEffect } from 'react'
import { motion, type Variants } from 'framer-motion'
import { useParams, useRouter } from 'next/navigation'
import { Upload, Database } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DatasetCard } from '@/components/data/DatasetCard'
import { DatasetUpload } from '@/components/data/DatasetUpload'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { logAudit } from '@/lib/audit'
import type { Dataset, DatasetVersion } from '@/types/database'

const datasetContainer: Variants = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.06 } },
}
const datasetItem: Variants = {
  hidden:  { opacity: 0, y: 4 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.15, ease: 'easeOut' } },
}

export default function ProjectDataPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string
  const { user, loading: authLoading } = useAuth()

  const [datasets, setDatasets]           = useState<Dataset[]>([])
  const [archivedCount, setArchivedCount] = useState(0)
  const [loading, setLoading]             = useState(true)
  const [showUpload, setShowUpload]       = useState(false)
  const [showArchived, setShowArchived]   = useState(false)

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

  useEffect(() => {
    if (user) fetchDatasets()
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
    logAudit('dataset.deleted', 'dataset', id, {}, projectId)
    toast.success('Dataset deleted')
  }

  const handleArchive = async (id: string, archive: boolean) => {
    const { error } = await supabase
      .from('datasets').update({ archived_at: archive ? new Date().toISOString() : null }).eq('id', id)
    if (error) { toast.error(archive ? 'Failed to archive' : 'Failed to unarchive'); return }
    setDatasets(prev => prev.filter(d => d.id !== id))
    logAudit(archive ? 'dataset.archived' : 'dataset.unarchived', 'dataset', id, {}, projectId)
    toast.success(archive ? 'Dataset archived' : 'Dataset unarchived')
  }

  if (authLoading || !user) return null

  return (
    <div className="page-shell">

      {/* Page header */}
      <div className="px-6 pt-6 pb-4 flex-shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="page-title">Data</h1>
            <p className="text-xs text-[var(--text-tertiary)] mt-1">
              {datasets.length} {datasets.length === 1 ? 'dataset' : 'datasets'}
              {archivedCount > 0 && ` · ${archivedCount} archived`}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {archivedCount > 0 && (
              <button
                onClick={() => setShowArchived(v => !v)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                  showArchived
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'border-[var(--border-strong)] text-[var(--text-secondary)] hover:bg-[var(--bg-row-hover)]'
                }`}
              >
                {showArchived ? 'View Active' : 'View Archived'}
              </button>
            )}
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-white bg-[var(--accent-blue)] hover:opacity-90 transition-opacity"
            >
              <Upload className="h-3.5 w-3.5" />
              Import Dataset
            </button>
          </div>
        </div>
      </div>

      {/* Dataset list */}
      <div className="flex-1 overflow-y-auto border-t border-[var(--border-row)]">

        {loading ? (
          <>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="row-item pointer-events-none">
                <div className="skeleton h-3.5 w-3.5 rounded flex-shrink-0" />
                <div className="flex-1 space-y-1.5 min-w-0">
                  <div className="skeleton h-3.5 w-48 rounded" />
                  <div className="skeleton h-3 w-32 rounded" />
                </div>
                <div className="skeleton h-3 w-20 rounded flex-shrink-0" />
              </div>
            ))}
          </>
        ) : datasets.length === 0 ? (
          <div className="flex items-center justify-center flex-1 min-h-[300px]">
            <div className="empty-state">
              <Database className="empty-state-icon h-8 w-8" />
              <p className="empty-state-title">
                {showArchived ? 'No archived datasets' : 'No datasets yet'}
              </p>
              <p className="empty-state-description">
                {showArchived
                  ? 'Archived datasets will appear here.'
                  : 'Import a CSV, Excel, or SPSS file to start your research record.'}
              </p>
              {!showArchived && (
                <button
                  onClick={() => setShowUpload(true)}
                  className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-white bg-[var(--accent-blue)] hover:opacity-90 transition-opacity"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Import Dataset
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            <p className="section-label">
              {showArchived ? 'Archived' : 'Datasets'}
            </p>
            <motion.div
              initial="hidden"
              animate="visible"
              variants={datasetContainer}
            >
              {datasets.map(dataset => (
                <motion.div
                  key={dataset.id}
                  variants={datasetItem}
                >
                  <DatasetCard
                    dataset={dataset}
                    projectId={projectId}
                    onDelete={handleDelete}
                    onArchive={handleArchive}
                  />
                </motion.div>
              ))}
            </motion.div>
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
