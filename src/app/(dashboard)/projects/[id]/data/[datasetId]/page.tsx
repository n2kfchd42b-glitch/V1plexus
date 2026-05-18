'use client'

import { useParams } from 'next/navigation'
import { DatasetDetailPanel } from '@/components/data/DatasetDetailPanel'
import { StudentSupervisorNotes } from '@/components/supervisor-student/StudentSupervisorNotes'

export default function DatasetViewerPage() {
  const params    = useParams()
  const projectId = params.id as string
  const datasetId = params.datasetId as string

  return (
    <div className="min-h-screen bg-[#f7f9fb] flex flex-col">
      {/* Supervisor feedback — only renders if annotations exist */}
      <div className="px-6 pt-4">
        <StudentSupervisorNotes
          artifactId={datasetId}
          artifactType="dataset"
        />
      </div>

      <DatasetDetailPanel
        datasetId={datasetId}
        projectId={projectId}
        showBackLink
      />
    </div>
  )
}
