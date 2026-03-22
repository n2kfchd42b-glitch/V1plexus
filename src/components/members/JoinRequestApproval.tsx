"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useWorkspaceContext } from '@/components/workspace/WorkspaceProvider'
import type { WorkspaceMembership, Profile } from '@/types/database'
import { Check, X } from 'lucide-react'

type PendingMember = WorkspaceMembership & { user: Profile }

export function JoinRequestApproval() {
  const { activeWorkspace } = useWorkspaceContext()
  const [pending, setPending] = useState<PendingMember[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const load = async () => {
    if (!activeWorkspace) return
    setLoading(true)
    const { data } = await supabase
      .from('workspace_memberships')
      .select('*, user:profiles(*)')
      .eq('workspace_id', activeWorkspace.id)
      .eq('status', 'invited')
    setPending((data ?? []) as PendingMember[])
    setLoading(false)
  }

  useEffect(() => { load() }, [activeWorkspace]) // eslint-disable-line react-hooks/exhaustive-deps

  const approve = async (memberId: string) => {
    await supabase
      .from('workspace_memberships')
      .update({ status: 'active' })
      .eq('id', memberId)
    toast.success('Member approved')
    load()
  }

  const deny = async (memberId: string) => {
    await supabase
      .from('workspace_memberships')
      .update({ status: 'left' })
      .eq('id', memberId)
    toast.success('Request denied')
    load()
  }

  if (loading) return <div className="text-xs text-[var(--text-tertiary)]">Loading…</div>
  if (pending.length === 0) return (
    <p className="text-xs text-[var(--text-tertiary)]">No pending join requests.</p>
  )

  return (
    <div>
      <h4 className="text-xs font-semibold text-[var(--text-primary)] mb-2">
        Join Requests ({pending.length})
      </h4>
      <div className="space-y-2">
        {pending.map(m => (
          <div key={m.id} className="flex items-center justify-between gap-2 p-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)]">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                {m.user?.full_name ?? m.user?.email ?? 'Unknown'}
              </p>
              <p className="text-xs text-[var(--text-tertiary)] capitalize">{m.role}</p>
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <Button size="sm" variant="outline" onClick={() => deny(m.id)} className="h-7 w-7 p-0 text-red-500 hover:text-red-600">
                <X className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" onClick={() => approve(m.id)} className="h-7 w-7 p-0">
                <Check className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
