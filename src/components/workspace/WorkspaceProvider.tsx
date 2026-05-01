"use client"

import { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react'
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
  const fetchingRef = useRef(false)

  const fetchWorkspaces = useCallback(async (userId: string) => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    setLoading(true)
    try {
      // Fetch workspaces + memberships — abort after 8 s so loading always clears
      const controller = new AbortController()
      const abortTimer = setTimeout(() => controller.abort(), 8_000)

      const { data: wsMemberships, error: wsMembershipError } = await supabase
        .from('workspace_memberships')
        .select('*, workspace:workspaces(*, institution:institutions(*))')
        .eq('user_id', userId)
        .eq('status', 'active')
        .abortSignal(controller.signal)

      clearTimeout(abortTimer)
      if (wsMembershipError) {
        const isAbort = wsMembershipError.message?.includes('AbortError') ||
          wsMembershipError.message?.includes('Lock') ||
          wsMembershipError.message?.includes('abort')
        if (!isAbort) {
          console.error('[WorkspaceProvider] workspace_memberships error:', wsMembershipError)
        }
        // Don't early-return — fall through to finally so loading clears.
        // activeWorkspace stays null, which is fine (dashboard handles it).
      }

      if (!wsMemberships?.length) return

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

      // Fetch supervisor/student assignments in parallel if applicable
      const activeId = savedExists ? saved : workspaces.find(w => w.type === 'personal')?.id
      const currentMembership = wsMemberships.find(m => m.workspace_id === activeId)
      const role = currentMembership?.role

      const [saResult, studentsResult] = await Promise.all([
        role === 'student'
          ? supabase
              .from('supervisor_assignments')
              .select('*, supervisor:profiles!supervisor_id(*), department:departments!department_id(*)')
              .eq('student_id', userId)
              .eq('status', 'active')
              .maybeSingle()
          : Promise.resolve({ data: null }),
        role === 'supervisor' || role === 'department_head'
          ? supabase
              .from('supervisor_assignments')
              .select('*, student:profiles!student_id(*), department:departments!department_id(*)')
              .eq('supervisor_id', userId)
              .eq('status', 'active')
          : Promise.resolve({ data: [] }),
      ])

      setSupervisorAssignment((saResult.data as SupervisorAssignment | null) ?? null)
      setAssignedStudents(((studentsResult.data ?? []) as SupervisorAssignment[]))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      const isAbort = msg.includes('AbortError') || msg.includes('Lock') || msg.includes('abort') || msg.includes('stolen')
      if (!isAbort) {
        console.error('[WorkspaceProvider] fetchWorkspaces error:', err)
      }
    } finally {
      fetchingRef.current = false
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    // Use onAuthStateChange so we don't make a separate getUser() network call.
    // It fires immediately with the current session on mount.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (session?.user) {
        fetchWorkspaces(session.user.id)
      } else {
        // Signed out — clear state immediately, no spinner
        setAllWorkspaces([])
        setMemberships([])
        setActiveWorkspaceId(null)
        setSupervisorAssignment(null)
        setAssignedStudents([])
        setLoading(false)
      }
    })
    return () => subscription.unsubscribe()
  }, [supabase, fetchWorkspaces])

  const switchWorkspace = useCallback((id: string) => {
    setActiveWorkspaceId(id)
    if (typeof window !== 'undefined') {
      localStorage.setItem(ACTIVE_WORKSPACE_KEY, id)
    }
  }, [])

  const refetch = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) fetchWorkspaces(user.id)
  }, [supabase, fetchWorkspaces])

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
      refetch,
    }}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspaceContext() {
  return useContext(WorkspaceContext)
}
