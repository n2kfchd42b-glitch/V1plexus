'use client'

import { useParams } from 'next/navigation'
import { DatasetDetailPanel } from '@/components/data/DatasetDetailPanel'

export default function DatasetViewerPage() {
  const params    = useParams()
  const projectId = params.id as string
  const datasetId = params.datasetId as string

  return (
    <div className="min-h-screen bg-[#f7f9fb]">
      <DatasetDetailPanel
        datasetId={datasetId}
        projectId={projectId}
        showBackLink
      />
    </div>
  )
}
