'use client'

import { useEffect, useState, useCallback } from 'react'
import { SupervisorCohortView } from '@/components/supervisor-student/SupervisorCohortView'
import { InviteStudentModal } from '@/components/supervisor-student/InviteStudentModal'
import { Users, UserPlus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function SupervisorDashboardPage() {
  const [students, setStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [workspaceName, setWorkspaceName] = useState('')
  const [supervisorId, setSupervisorId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/supervisor/students')
    if (res.ok) setStudents(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      setSupervisorId(user.id)
      const { data } = await supabase
        .from('workspace_memberships')
        .select('workspace_id, workspace:workspaces(name)')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single()
      if (data) {
        setWorkspaceId(data.workspace_id)
        setWorkspaceName((data.workspace as { name?: string } | null)?.name ?? 'your workspace')
      }
    })
  }, [load])

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
      Loading your students…
    </div>
  )

  return (
    <div className="px-8 py-6 max-w-6xl mx-auto">
      <div className="mb-8 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
            <Users className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">My Students</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {students.length} student{students.length !== 1 ? 's' : ''} under your supervision
            </p>
          </div>
        </div>

        {workspaceId && supervisorId && (
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <UserPlus className="h-4 w-4" />
            Invite Student
          </button>
        )}
      </div>

      <SupervisorCohortView students={students} onRefresh={load} />

      {showInvite && workspaceId && supervisorId && (
        <InviteStudentModal
          workspaceId={workspaceId}
          workspaceName={workspaceName}
          supervisorId={supervisorId}
          onClose={() => setShowInvite(false)}
        />
      )}
    </div>
  )
}
