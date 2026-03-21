import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Users } from 'lucide-react'
import { MemberList } from '@/components/institution/MemberList'
import { EmptyState } from '@/components/shared/EmptyState'
import { PageHeader } from '@/components/shared/PageHeader'
import type { ProfileWithRoles } from '@/types/app'

export default async function MembersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('institution_id')
    .eq('id', user.id)
    .single()

  const institutionId = profile?.institution_id
  if (!institutionId) redirect('/institution')

  const { data: members } = await supabase
    .from('profiles')
    .select('*, roles:user_roles(*)')
    .eq('institution_id', institutionId)
    .order('full_name')

  const typedMembers = (members as ProfileWithRoles[]) ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Members"
        description={`${typedMembers.length} ${typedMembers.length === 1 ? 'member' : 'members'} in your institution`}
      />

      {typedMembers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No members"
          description="No members have been added to this institution yet."
        />
      ) : (
        <MemberList members={typedMembers} />
      )}
    </div>
  )
}
