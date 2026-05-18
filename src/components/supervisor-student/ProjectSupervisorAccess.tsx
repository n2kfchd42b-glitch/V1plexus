'use client'

import { useEffect, useState } from 'react'
import { UserCheck, UserX, Eye, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SupervisorEntry {
  supervisorId: string
  name: string
  hasAccess: boolean
}

interface Props {
  projectId: string
}

export function ProjectSupervisorAccess({ projectId }: Props) {
  const [supervisors, setSupervisors] = useState<SupervisorEntry[]>([])
  const [loading, setLoading]         = useState(true)
  const [toggling, setToggling]       = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/projects/${projectId}/supervisor-access`)
      .then(r => r.ok ? r.json() : [])
      .then(setSupervisors)
      .finally(() => setLoading(false))
  }, [projectId])

  if (loading) return (
    <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
      <Loader2 className="h-3 w-3 animate-spin" /> Loading supervisors…
    </div>
  )

  // No supervisors assigned at all
  if (supervisors.length === 0) return (
    <p className="text-xs text-slate-400 italic">No supervisors assigned to you yet.</p>
  )

  async function toggle(entry: SupervisorEntry) {
    setToggling(entry.supervisorId)
    try {
      const method = entry.hasAccess ? 'DELETE' : 'POST'
      const res = await fetch(`/api/projects/${projectId}/supervisor-access`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supervisorId: entry.supervisorId }),
      })
      if (res.ok) {
        setSupervisors(prev =>
          prev.map(s => s.supervisorId === entry.supervisorId
            ? { ...s, hasAccess: !s.hasAccess }
            : s
          )
        )
      }
    } finally {
      setToggling(null)
    }
  }

  return (
    <div className="space-y-2">
      {supervisors.map(entry => (
        <div
          key={entry.supervisorId}
          className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-lg bg-white border border-slate-100 shadow-sm"
        >
          <div className="flex items-center gap-2.5">
            <div className={cn(
              'w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold',
              entry.hasAccess ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-400'
            )}>
              {entry.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-800">{entry.name}</p>
              <p className="text-[10px] text-slate-400">
                {entry.hasAccess ? 'Can view this project' : 'No access to this project'}
              </p>
            </div>
          </div>

          <button
            onClick={() => toggle(entry)}
            disabled={toggling === entry.supervisorId}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all',
              entry.hasAccess
                ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-100'
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
            )}
          >
            {toggling === entry.supervisorId ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : entry.hasAccess ? (
              <>
                <UserX className="h-3 w-3" />
                Revoke access
              </>
            ) : (
              <>
                <Eye className="h-3 w-3" />
                Share with supervisor
              </>
            )}
          </button>
        </div>
      ))}

      <p className="text-[10px] text-slate-400 pt-1">
        Supervisors with access can view your datasets, analyses, and documents — but cannot edit anything.
      </p>
    </div>
  )
}
