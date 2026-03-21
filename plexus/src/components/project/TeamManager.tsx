'use client'

import { useState } from 'react'
import { UserMinus, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { useProjectMembers } from '@/hooks/useProjectMembers'
import { MEMBER_ROLES } from '@/lib/constants'
import { getInitials, formatDate } from '@/lib/utils'
import { toast } from 'sonner'
import type { MemberRole } from '@/types/app'

interface TeamManagerProps {
  projectId: string
  isOwner: boolean
  currentUserId: string
}

export function TeamManager({ projectId, isOwner, currentUserId }: TeamManagerProps) {
  const { members, loading, addMember, updateMemberRole, removeMember } = useProjectMembers(projectId)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<MemberRole>('researcher')
  const [inviting, setInviting] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<string | null>(null)
  const [removing, setRemoving] = useState(false)

  async function handleInvite() {
    if (!email.trim()) return
    setInviting(true)
    try {
      await addMember(email.trim(), role)
      toast.success('Member added successfully')
      setEmail('')
      setRole('researcher')
      setInviteOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add member')
    }
    setInviting(false)
  }

  async function handleRemove() {
    if (!removeTarget) return
    setRemoving(true)
    try {
      await removeMember(removeTarget)
      toast.success('Member removed')
      setRemoveTarget(null)
    } catch {
      toast.error('Failed to remove member')
    }
    setRemoving(false)
  }

  async function handleRoleChange(memberId: string, newRole: MemberRole) {
    try {
      await updateMemberRole(memberId, newRole)
      toast.success('Role updated')
    } catch {
      toast.error('Failed to update role')
    }
  }

  if (loading) {
    return <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-14 bg-[#F7F8FA] rounded-md animate-pulse" />
      ))}
    </div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-[#718096]">{members.length} {members.length === 1 ? 'member' : 'members'}</p>
        {isOwner && (
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            Add member
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {members.map((member) => {
          const isCurrentUser = member.user_id === currentUserId
          return (
            <div
              key={member.id}
              className="flex items-center gap-3 p-3 rounded-md border border-[#E2E8F0] bg-white"
            >
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarImage src={member.profile.avatar_url ?? undefined} />
                <AvatarFallback>{getInitials(member.profile.full_name)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#1A202C] truncate">
                  {member.profile.full_name}
                  {isCurrentUser && <span className="ml-1 text-xs text-[#A0AEC0]">(you)</span>}
                </p>
                <p className="text-xs text-[#718096] truncate">{member.profile.email}</p>
              </div>
              <div className="text-xs text-[#A0AEC0] hidden sm:block">{formatDate(member.joined_at)}</div>
              {isOwner && !isCurrentUser ? (
                <>
                  <Select
                    value={member.role}
                    onValueChange={(v) => handleRoleChange(member.id, v as MemberRole)}
                  >
                    <SelectTrigger className="w-36 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MEMBER_ROLES.map(({ value, label }) => (
                        <SelectItem key={value} value={value} className="text-xs">
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={() => setRemoveTarget(member.id)}
                  >
                    <UserMinus className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <span className="text-xs font-medium text-[#718096] bg-[#F7F8FA] px-2 py-1 rounded">
                  {MEMBER_ROLES.find((r) => r.value === member.role)?.label ?? member.role}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add team member</DialogTitle>
            <DialogDescription>
              The person must already have a PLEXUS account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Email address</Label>
              <Input
                type="email"
                placeholder="researcher@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as MemberRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEMBER_ROLES.map(({ value, label, description }) => (
                    <SelectItem key={value} value={value}>
                      <div>
                        <p>{label}</p>
                        <p className="text-xs text-[#718096]">{description}</p>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button onClick={handleInvite} disabled={inviting || !email.trim()}>
              {inviting ? 'Adding...' : 'Add member'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm remove */}
      <ConfirmDialog
        open={!!removeTarget}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title="Remove member"
        description="Are you sure you want to remove this member from the project?"
        confirmLabel="Remove"
        onConfirm={handleRemove}
        loading={removing}
      />
    </div>
  )
}
