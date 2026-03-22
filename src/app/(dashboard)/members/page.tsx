"use client"

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useWorkspaceContext } from '@/components/workspace/WorkspaceProvider'
import { WorkspaceInviteForm } from '@/components/members/WorkspaceInviteForm'
import { JoinRequestApproval } from '@/components/members/JoinRequestApproval'
import { InvitationLinkGenerator } from '@/components/members/InvitationLinkGenerator'
import type { WorkspaceMembership, Profile } from '@/types/database'
import { Users } from 'lucide-react'
import { cn } from '@/lib/utils'

type MemberWithProfile = WorkspaceMembership & { user: Profile }

export default function MembersPage() {
  const { activeWorkspace, isAdmin, isDepartmentHead } = useWorkspaceContext()
  const [members, setMembers] = useState<MemberWithProfile[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const load = async () => {
    if (!activeWorkspace) return
    setLoading(true)
    const { data } = await supabase
      .from('workspace_memberships')
      .select('*, user:profiles(*)')
      .eq('workspace_id', activeWorkspace.id)
      .eq('status', 'active')
    setMembers((data ?? []) as MemberWithProfile[])
    setLoading(false)
  }

  useEffect(() => { load() }, [activeWorkspace]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center gap-2 mb-6">
        <Users className="h-5 w-5 text-[var(--text-primary)]" />
        <h1 className="text-xl font-bold text-[var(--text-primary)]">
          Members — {activeWorkspace?.name}
        </h1>
        <span className="text-sm text-[var(--text-tertiary)] ml-1">({members.length} active)</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Members list */}
        <div className="lg:col-span-2">
          {loading ? (
            <div className="text-sm text-[var(--text-tertiary)]">Loading…</div>
          ) : (
            <div className="space-y-2">
              {members.map(m => (
                <div key={m.id} className="flex items-center gap-3 p-3 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg">
                  <div className="h-8 w-8 rounded-full bg-[#1B3A5C] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {m.user?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) ?? '??'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                      {m.user?.full_name ?? m.user?.email ?? 'Unknown'}
                    </p>
                    <p className="text-xs text-[var(--text-tertiary)]">{m.user?.email}</p>
                  </div>
                  <span className={cn(
                    'text-xs px-2 py-0.5 rounded-full capitalize',
                    m.role === 'admin' || m.role === 'owner'
                      ? 'bg-blue-100 text-blue-700'
                      : m.role === 'supervisor' || m.role === 'pi'
                        ? 'bg-purple-100 text-purple-700'
                        : m.role === 'student'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                  )}>
                    {m.role.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        {(isAdmin || isDepartmentHead) && (
          <div className="space-y-6">
            <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-4">
              <WorkspaceInviteForm onInvited={load} />
            </div>
            <div className="my-3 h-px bg-[var(--border-default)]" />
            <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-4">
              <InvitationLinkGenerator />
            </div>
            <div className="my-3 h-px bg-[var(--border-default)]" />
            <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-4">
              <JoinRequestApproval />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
