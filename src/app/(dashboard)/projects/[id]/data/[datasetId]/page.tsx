'use client'

import { useParams } from 'next/navigation'
import { DatasetDetailPanel } from '@/components/data/DatasetDetailPanel'
import { StudentSupervisorNotes } from '@/components/supervisor-student/StudentSupervisorNotes'

export default function DatasetViewerPage() {
  const params    = useParams()
  const projectId = params.id as string
  const datasetId = params.datasetId as string

  return (
    <div className="flex flex-col bg-[#f7f9fb] h-[calc(100vh-6.5rem)]">
      {/* Supervisor feedback — only renders if annotations exist */}
      <div className="px-6 pt-4 flex-shrink-0">
        <StudentSupervisorNotes
          artifactId={datasetId}
          artifactType="dataset"
        />
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <DatasetDetailPanel
          datasetId={datasetId}
          projectId={projectId}
          showBackLink
        />
      </div>
    </div>
  )
}
