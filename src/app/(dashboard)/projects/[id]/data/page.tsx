'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Plus, Database, Upload, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DatasetCard } from '@/components/data/DatasetCard'
import { DatasetUpload } from '@/components/data/DatasetUpload'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import type { Dataset, DatasetVersion } from '@/types/database'

export default function ProjectDataPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string
  const { user, loading: authLoading } = useAuth()

  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
  }, [authLoading, user, router])

  const fetchDatasets = async () => {
    setLoading(true)
    try {
      const datasetsRes = await supabase
        .from('datasets')
        .select('*')
        .eq('project_id', projectId)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })

      if (!datasetsRes.data?.length) {
        setDatasets([])
        return
      }

      const datasetList: Dataset[] = datasetsRes.data

      // Fetch only versions for this project's datasets (not the entire table)
      const datasetIds = datasetList.map(d => d.id)
      const versionsRes = await supabase
        .from('dataset_versions')
        .select('*')
        .in('dataset_id', datasetIds)
        .order('version_number', { ascending: false })

      // Build a map of dataset_id -> latest version
      const latestVersionMap = new Map<string, DatasetVersion>()
      if (versionsRes.data) {
        for (const version of versionsRes.data as DatasetVersion[]) {
          if (!latestVersionMap.has(version.dataset_id)) {
            latestVersionMap.set(version.dataset_id, version)
          }
        }
      }

      // Attach latest_version to each dataset
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
  }, [projectId, user])

  const handleUploadSuccess = (datasetId: string) => {
    setShowUpload(false)
    router.push(`/projects/${projectId}/data/${datasetId}`)
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Database className="h-6 w-6 text-blue-600" />
            Datasets
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage and explore datasets for this project
          </p>
        </div>
        <Button onClick={() => setShowUpload(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Upload Dataset
        </Button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : datasets.length === 0 ? (
        <div className="text-center py-20 border rounded-lg bg-muted/20">
          <Database className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
          <p className="text-lg font-medium text-muted-foreground">No datasets yet</p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Upload your first dataset to get started
          </p>
          <Button onClick={() => setShowUpload(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Upload Dataset
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {datasets.map(dataset => (
            <DatasetCard
              key={dataset.id}
              dataset={dataset}
              projectId={projectId}
            />
          ))}
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Upload Dataset</DialogTitle>
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
