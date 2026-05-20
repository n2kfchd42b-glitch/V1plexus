'use client'

import { useEffect, useState } from 'react'
import { ProjectGantt } from '@/components/project/ProjectGantt'
import type { GanttPhase, GanttNote } from '@/components/project/ProjectGantt'

interface Props {
  projectId: string
  userId: string
}

export function SupervisorGanttPanel({ projectId, userId }: Props) {
  const [phases, setPhases] = useState<GanttPhase[] | null>(null)
  const [notes,  setNotes]  = useState<GanttNote[]>([])

  useEffect(() => {
    async function load() {
      const [phasesRes, notesRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/phases`),
        fetch(`/api/projects/${projectId}/gantt-notes`),
      ])
      if (phasesRes.ok) {
        const data = await phasesRes.json()
        setPhases(data.phases ?? [])
      } else {
        setPhases([])
      }
      if (notesRes.ok) {
        const data = await notesRes.json()
        setNotes(Array.isArray(data) ? data : [])
      }
    }
    load()
  }, [projectId])

  if (phases === null) {
    return (
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm flex items-center justify-center" style={{ height: 420 }}>
        <div className="flex flex-col items-center gap-2">
          <div className="w-48 h-3 rounded skeleton" />
          <div className="w-32 h-2 rounded skeleton" />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden" style={{ height: 420 }}>
      <ProjectGantt
        projectId={projectId}
        userId={userId}
        initialPhases={phases}
        initialNotes={notes}
        readOnly
      />
    </div>
  )
}
