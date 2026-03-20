'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Institution, Department, ProfileWithRoles } from '@/types/app'

export function useInstitution(institutionId: string | null | undefined) {
  const [institution, setInstitution] = useState<Institution | null>(null)
  const [departments, setDepartments] = useState<Department[]>([])
  const [members, setMembers] = useState<ProfileWithRoles[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!institutionId) {
      setLoading(false)
      return
    }

    async function fetchData() {
      const supabase = createClient()

      const [instResult, deptResult, memberResult] = await Promise.all([
        supabase.from('institutions').select('*').eq('id', institutionId!).single(),
        supabase.from('departments').select('*').eq('institution_id', institutionId!).is('deleted_at', null).order('name'),
        supabase.from('profiles').select('*, roles:user_roles(*)').eq('institution_id', institutionId!),
      ])

      setInstitution(instResult.data as Institution | null)
      setDepartments((deptResult.data as Department[]) ?? [])
      setMembers((memberResult.data as ProfileWithRoles[]) ?? [])
      setLoading(false)
    }

    fetchData()
  }, [institutionId])

  return { institution, departments, members, loading }
}
