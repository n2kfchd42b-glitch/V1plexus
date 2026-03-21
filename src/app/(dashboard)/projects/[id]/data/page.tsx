"use client"

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, Database } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { DatasetCard } from '@/components/data/DatasetCard'
import { DatasetUpload } from '@/components/data/DatasetUpload'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import type { Dataset } from '@/types/database'

export default function DataPage() {
  const params = useParams()
  const projectId = params.id as string
  const { profile } = useAuth()
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [showUpload, setShowUpload] = useState(false)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  async function fetchDatasets() {
    const { data } = await supabase
      .from('datasets')
      .select('*')
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
    if (data) setDatasets(data)
    setLoading(false)
  }

  useEffect(() => {
    fetchDatasets()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  function handleUploaded() {
    setShowUpload(false)
    fetchDatasets()
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <Link href={`/projects/${projectId}`}>
          <Button variant="ghost" size="sm" className="mb-3 h-7 text-xs -ml-2">
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            Back to Project
          </Button>
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Datasets</h1>
            <p className="text-muted-foreground text-sm mt-1">Upload and manage research data files</p>
          </div>
          <Button onClick={() => setShowUpload(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Upload Dataset
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Loading datasets…</div>
      ) : datasets.length === 0 ? (
        <div className="text-center py-16 border rounded-lg bg-muted/20">
          <Database className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground text-sm font-medium">No datasets yet</p>
          <p className="text-muted-foreground text-xs mt-1 mb-4">Upload CSV, Excel, or SPSS files to get started</p>
          <Button size="sm" onClick={() => setShowUpload(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Upload First Dataset
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {datasets.map(ds => (
            <DatasetCard key={ds.id} dataset={ds} projectId={projectId} />
          ))}
        </div>
      )}

      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload Dataset</DialogTitle>
            <DialogDescription>Upload a CSV, Excel, or SPSS file to this project.</DialogDescription>
          </DialogHeader>
          {profile && (
            <DatasetUpload
              projectId={projectId}
              profile={profile}
              onUploaded={handleUploaded}
              onCancel={() => setShowUpload(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
