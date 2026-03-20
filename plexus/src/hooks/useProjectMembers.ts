'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ProjectMemberWithProfile, MemberRole } from '@/types/app'

export function useProjectMembers(projectId: string) {
  const [members, setMembers] = useState<ProjectMemberWithProfile[]>([])
  const [loading, setLoading] = useState(true)

  const fetchMembers = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('project_members')
      .select('*, profile:profiles(*)')
      .eq('project_id', projectId)
      .order('joined_at', { ascending: true })

    setMembers((data as ProjectMemberWithProfile[]) ?? [])
    setLoading(false)
  }, [projectId])

  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  async function addMember(email: string, role: MemberRole) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single()

    if (!profile) throw new Error('User not found. They must have an account first.')

    const profileData = profile as { id: string }

    const { error: err } = await supabase.from('project_members').insert({
      project_id: projectId,
      user_id: profileData.id,
      role,
      invited_by: user?.id,
    } as Record<string, unknown>)

    if (err) throw new Error(err.message)
    await fetchMembers()
  }

  async function updateMemberRole(memberId: string, role: MemberRole) {
    const supabase = createClient()
    const { error: err } = await supabase
      .from('project_members')
      .update({ role } as Record<string, unknown>)
      .eq('id', memberId)

    if (err) throw new Error(err.message)
    await fetchMembers()
  }

  async function removeMember(memberId: string) {
    const supabase = createClient()
    const { error: err } = await supabase
      .from('project_members')
      .delete()
      .eq('id', memberId)

    if (err) throw new Error(err.message)
    await fetchMembers()
  }

  return { members, loading, addMember, updateMemberRole, removeMember, refetch: fetchMembers }
}
