'use client'

import { useCallback, useEffect, useState } from 'react'
import { UserX, Eye, Loader2, GraduationCap, Plus, ChevronDown, Clock } from 'lucide-react'
import { FindSupervisorModal } from '@/components/supervisor-student/FindSupervisorModal'
import { cn } from '@/lib/utils'

type SupervisorRole = 'primary' | 'co_supervisor'
type AssignmentStatus = 'active' | 'pending'

interface SupervisorEntry {
  assignmentId: string
  supervisorId: string
  role: SupervisorRole
  status: AssignmentStatus
  name: string
  hasAccess: boolean
}

const ROLE_LABELS: Record<SupervisorRole, string> = {
  primary: 'Main Supervisor',
  co_supervisor: 'Co-supervisor',
}

interface Props {
  projectId: string
}

export function ProjectSupervisorAccess({ projectId }: Props) {
  const [supervisors, setSupervisors] = useState<SupervisorEntry[]>([])
  const [loading, setLoading]         = useState(true)
  const [toggling, setToggling]       = useState<string | null>(null)
  const [roleSaving, setRoleSaving]   = useState<string | null>(null)
  const [findOpen, setFindOpen]       = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/projects/${projectId}/supervisor-access`)
      .then(r => r.ok ? r.json() : [])
      .then(setSupervisors)
      .finally(() => setLoading(false))
  }, [projectId])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)] py-2">
      <Loader2 className="h-3 w-3 animate-spin" /> Loading supervisors…
    </div>
  )

  if (supervisors.length === 0) return (
    <>
      <div className="rounded-lg border border-dashed border-[var(--border-default)] bg-[var(--bg-app)] p-4 text-center">
        <GraduationCap className="h-6 w-6 mx-auto text-[var(--text-tertiary)] mb-2" />
        <p className="text-xs font-medium text-[var(--text-secondary)] mb-1">No supervisors assigned yet</p>
        <p className="text-[11px] text-[var(--text-tertiary)] mb-3">
          Add your main supervisor — they&apos;ll get an email and an in-app request to accept.
        </p>
        <button
          onClick={() => setFindOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-[var(--accent-blue)] text-white hover:bg-[var(--accent-blue-hover)] transition-colors"
        >
          <Plus className="h-3 w-3" />
          Find a supervisor
        </button>
      </div>
      {findOpen && (
        <FindSupervisorModal
          onClose={() => setFindOpen(false)}
          onRequested={() => { setFindOpen(false); load() }}
        />
      )}
    </>
  )

  async function toggleAccess(entry: SupervisorEntry) {
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

  async function changeRole(entry: SupervisorEntry, newRole: SupervisorRole) {
    if (newRole === entry.role) return
    setRoleSaving(entry.assignmentId)
    try {
      const res = await fetch(`/api/projects/${projectId}/supervisor-access`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignmentId: entry.assignmentId, role: newRole }),
      })
      if (res.ok) {
        setSupervisors(prev =>
          prev.map(s => s.assignmentId === entry.assignmentId
            ? { ...s, role: newRole }
            : s
          )
        )
      }
    } finally {
      setRoleSaving(null)
    }
  }

  return (
    <div className="space-y-2">
      {supervisors.map(entry => entry.status === 'pending' ? (
        <div
          key={entry.supervisorId}
          className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-lg bg-[var(--bg-app)] border border-dashed border-[var(--border-default)]"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-full bg-[var(--bg-inset)] text-[var(--text-tertiary)] flex items-center justify-center text-[11px] font-bold flex-shrink-0 opacity-60">
              {entry.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[var(--text-secondary)] truncate">{entry.name}</p>
              <p className="text-[10px] text-[var(--text-tertiary)] truncate">
                {ROLE_LABELS[entry.role]} · awaiting their acceptance
              </p>
            </div>
          </div>
          <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-amber-100 text-amber-800">
            <Clock className="h-2.5 w-2.5" />
            Pending
          </span>
        </div>
      ) : (
        <div
          key={entry.supervisorId}
          className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-default)] shadow-[var(--shadow-xs)]"
        >
          {/* Avatar + name + role selector */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={cn(
              'w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0',
              entry.hasAccess ? 'bg-[var(--accent-blue-subtle)] text-[var(--accent-blue)]' : 'bg-[var(--bg-inset)] text-[var(--text-tertiary)]'
            )}>
              {entry.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{entry.name}</p>
              <p className="text-[10px] text-[var(--text-tertiary)]">
                {entry.hasAccess ? 'Can view this project' : 'No project access'}
              </p>
            </div>
          </div>

          {/* Role selector + access toggle */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Role pill / dropdown */}
            <div className="relative">
              <select
                value={entry.role}
                disabled={roleSaving === entry.assignmentId}
                onChange={e => changeRole(entry, e.target.value as SupervisorRole)}
                className={cn(
                  'appearance-none text-[11px] font-medium pl-2.5 pr-6 py-1 rounded-md border transition-colors cursor-pointer',
                  'bg-[var(--bg-app)] border-[var(--border-default)] text-[var(--text-secondary)]',
                  'hover:bg-[var(--bg-surface-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]',
                  roleSaving === entry.assignmentId && 'opacity-50 cursor-not-allowed'
                )}
              >
                <option value="primary">Main Supervisor</option>
                <option value="co_supervisor">Co-supervisor</option>
              </select>
              {roleSaving === entry.assignmentId ? (
                <Loader2 className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 animate-spin text-[var(--text-tertiary)] pointer-events-none" />
              ) : (
                <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-[var(--text-tertiary)] pointer-events-none" />
              )}
            </div>

            {/* Grant / Revoke access */}
            <button
              onClick={() => toggleAccess(entry)}
              disabled={toggling === entry.supervisorId}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all active:scale-[0.98]',
                entry.hasAccess
                  ? 'bg-[var(--status-error-bg)] text-[var(--status-error-text)] hover:bg-red-100 border border-[var(--border-status-error)]'
                  : 'bg-[var(--accent-blue)] text-white hover:bg-[var(--accent-blue-hover)]'
              )}
            >
              {toggling === entry.supervisorId ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : entry.hasAccess ? (
                <>
                  <UserX className="h-3 w-3" />
                  Revoke
                </>
              ) : (
                <>
                  <Eye className="h-3 w-3" />
                  Share
                </>
              )}
            </button>
          </div>
        </div>
      ))}

      <button
        onClick={() => setFindOpen(true)}
        className="w-full flex items-center justify-center gap-1.5 mt-1 py-2 rounded-lg border border-dashed border-[var(--border-default)] text-[11px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)] transition-colors"
      >
        <Plus className="h-3 w-3" />
        Add another supervisor
      </button>

      <p className="text-[10px] text-[var(--text-tertiary)] pt-1">
        Supervisors with access can view your datasets, analyses, and documents — but cannot edit anything.
      </p>

      {findOpen && (
        <FindSupervisorModal
          onClose={() => setFindOpen(false)}
          onRequested={() => { setFindOpen(false); load() }}
        />
      )}
    </div>
  )
}
