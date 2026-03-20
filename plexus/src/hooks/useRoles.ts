'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { UserRole, SystemRole } from '@/types/app'

export function useRoles() {
  const [roles, setRoles] = useState<UserRole[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchRoles() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', user.id)

      setRoles((data as UserRole[]) ?? [])
      setLoading(false)
    }
    fetchRoles()
  }, [])

  function hasRole(role: SystemRole, scopeId?: string): boolean {
    return roles.some((r) => {
      if (r.role !== role) return false
      if (!scopeId) return true
      return r.institution_id === scopeId || r.department_id === scopeId || r.project_id === scopeId
    })
  }

  function isInstitutionAdmin(institutionId?: string): boolean {
    return hasRole('institution_admin', institutionId)
  }

  function isDepartmentHead(departmentId?: string): boolean {
    return hasRole('department_head', departmentId)
  }

  return { roles, loading, hasRole, isInstitutionAdmin, isDepartmentHead }
}
