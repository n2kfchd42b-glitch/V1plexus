"use client"

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type {
  Workspace,
  WorkspaceMembership,
  SupervisorAssignment,
  WorkspaceMemberRole
} from '@/types/database'

interface WorkspaceContextValue {
  activeWorkspace: Workspace | null
  allWorkspaces: Workspace[]
  membership: WorkspaceMembership | null
  switchWorkspace: (id: string) => void
  isPersonal: boolean
  isInstitutional: boolean
  isAdmin: boolean
  isSupervisor: boolean
  isStudent: boolean
  isDepartmentHead: boolean
  isPI: boolean
  supervisorAssignment: SupervisorAssignment | null
  assignedStudents: SupervisorAssignment[]
  loading: boolean
  refetch: () => void
}

const WorkspaceContext = createContext<WorkspaceContextValue>({
  activeWorkspace: null,
  allWorkspaces: [],
  membership: null,
  switchWorkspace: () => {},
  isPersonal: false,
  isInstitutional: false,
  isAdmin: false,
  isSupervisor: false,
  isStudent: false,
  isDepartmentHead: false,
  isPI: false,
  supervisorAssignment: null,
  assignedStudents: [],
  loading: true,
  refetch: () => {},
})

const ACTIVE_WORKSPACE_KEY = 'plexus_active_workspace_id'

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [allWorkspaces, setAllWorkspaces] = useState<Workspace[]>([])
  const [memberships, setMemberships] = useState<WorkspaceMembership[]>([])
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null)
  const [supervisorAssignment, setSupervisorAssignment] = useState<SupervisorAssignment | null>(null)
  const [assignedStudents, setAssignedStudents] = useState<SupervisorAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = useMemo(() => createClient(), [])

  const fetchWorkspaces = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Fetch all workspaces + memberships
      const { data: wsMemberships, error: wsMembershipError } = await supabase
        .from('workspace_memberships')
        .select('*, workspace:workspaces(*, institution:institutions(*))')
        .eq('user_id', user.id)
        .eq('status', 'active')
      if (wsMembershipError) console.error('[WorkspaceProvider] workspace_memberships error:', wsMembershipError)

      if (wsMemberships) {
        const workspaces = wsMemberships
          .map(m => m.workspace as Workspace)
          .filter(Boolean)
        setAllWorkspaces(workspaces)
        setMemberships(wsMemberships as WorkspaceMembership[])

        // Set active workspace from localStorage or default to personal
        const saved = typeof window !== 'undefined'
          ? localStorage.getItem(ACTIVE_WORKSPACE_KEY)
          : null
        const savedExists = saved && workspaces.find(w => w.id === saved)
        if (savedExists) {
          setActiveWorkspaceId(saved)
        } else {
          // Default to personal workspace
          const personal = workspaces.find(w => w.type === 'personal')
          if (personal) {
            setActiveWorkspaceId(personal.id)
            if (typeof window !== 'undefined') {
              localStorage.setItem(ACTIVE_WORKSPACE_KEY, personal.id)
            }
          } else if (workspaces[0]) {
            setActiveWorkspaceId(workspaces[0].id)
          }
        }

        // Fetch supervisor assignments
        const currentMembership = wsMemberships.find(
          m => m.workspace_id === (savedExists ? saved : workspaces.find(w => w.type === 'personal')?.id)
        )
        if (currentMembership?.role === 'student') {
          const { data: sa } = await supabase
            .from('supervisor_assignments')
            .select('*, supervisor:profiles!supervisor_id(*), department:departments(*)')
            .eq('student_id', user.id)
            .eq('status', 'active')
            .maybeSingle()
          setSupervisorAssignment(sa as SupervisorAssignment | null)
        }

        if (currentMembership?.role === 'supervisor' || currentMembership?.role === 'department_head') {
          const { data: students } = await supabase
            .from('supervisor_assignments')
            .select('*, student:profiles!student_id(*), department:departments(*)')
            .eq('supervisor_id', user.id)
            .eq('status', 'active')
          setAssignedStudents((students ?? []) as SupervisorAssignment[])
        }
      }
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchWorkspaces()
  }, [fetchWorkspaces])

  const switchWorkspace = useCallback((id: string) => {
    setActiveWorkspaceId(id)
    if (typeof window !== 'undefined') {
      localStorage.setItem(ACTIVE_WORKSPACE_KEY, id)
    }
  }, [])

  const activeWorkspace = allWorkspaces.find(w => w.id === activeWorkspaceId) ?? null
  const membership = memberships.find(m => m.workspace_id === activeWorkspaceId) ?? null

  const role: WorkspaceMemberRole | null = (membership?.role as WorkspaceMemberRole) ?? null

  return (
    <WorkspaceContext.Provider value={{
      activeWorkspace,
      allWorkspaces,
      membership,
      switchWorkspace,
      isPersonal: activeWorkspace?.type === 'personal',
      isInstitutional: activeWorkspace?.type === 'institutional',
      isAdmin: role === 'admin' || role === 'owner',
      isSupervisor: role === 'supervisor',
      isStudent: role === 'student',
      isDepartmentHead: role === 'department_head',
      isPI: role === 'pi',
      supervisorAssignment,
      assignedStudents,
      loading,
      refetch: fetchWorkspaces,
    }}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspaceContext() {
  return useContext(WorkspaceContext)
}
