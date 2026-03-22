"use client"

import { useWorkspaceContext } from '@/components/workspace/WorkspaceProvider'
import { StudentProgressCard } from './StudentProgressCard'
import { GraduationCap } from 'lucide-react'

export function MyStudentsPanel() {
  const { assignedStudents } = useWorkspaceContext()

  if (assignedStudents.length === 0) {
    return (
      <div className="p-6 text-center">
        <GraduationCap className="h-10 w-10 text-[var(--text-tertiary)] mx-auto mb-3" />
        <p className="text-sm text-[var(--text-secondary)]">No students assigned yet.</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center gap-2 mb-6">
        <GraduationCap className="h-5 w-5 text-[var(--text-primary)]" />
        <h1 className="text-xl font-bold text-[var(--text-primary)]">
          My Students ({assignedStudents.length})
        </h1>
      </div>

      <div className="space-y-4">
        {assignedStudents.map(assignment => (
          <StudentProgressCard key={assignment.id} assignment={assignment} />
        ))}
      </div>
    </div>
  )
}
