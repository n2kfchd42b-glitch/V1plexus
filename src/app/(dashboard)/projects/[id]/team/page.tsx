"use client"

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { getProjectWithOwner, searchProfiles } from '@/lib/data'
import { cn, getInitials, formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Users, UserPlus, Crown, Trash2, Search, X, Mail, Clock, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { logAudit } from '@/lib/audit'
import { ProjectSupervisorAccess } from '@/components/supervisor-student/ProjectSupervisorAccess'
import type { ProjectMember, Profile } from '@/types/database'


type MemberWithProfile = ProjectMember & { user: Profile }

type PendingInvitation = {
  id: string
  email: string
  role: string
  created_at: string
  status: string
}

const roleLabel: Record<string, string> = {
  owner: 'Owner',
  pi: 'Principal Investigator',
  member: 'Researcher',
  viewer: 'Viewer',
}

const roleBadgeClass: Record<string, string> = {
  owner:  'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400',
  pi:     'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',
  member: 'bg-[var(--bg-inset)] text-[var(--text-secondary)]',
  viewer: 'bg-[var(--bg-inset)] text-[var(--text-tertiary)]',
}

// Map team page roles to invitation table roles
const roleToInviteRole: Record<string, string> = {
  pi: 'co_pi',
  member: 'researcher',
  viewer: 'viewer',
}

export default function ProjectTeamPage() {
  const params = useParams()
  const projectId = params.id as string
  const { profile } = useAuth()
  const supabase = createClient()

  const [members, setMembers] = useState<MemberWithProfile[]>([])
  const [owner, setOwner] = useState<Profile | null>(null)
  const [pendingInvites, setPendingInvites] = useState<PendingInvitation[]>([])
  const [projectTitle, setProjectTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)

  // Search / select existing user
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Profile[]>([])
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null)
  const [newMemberRole, setNewMemberRole] = useState<'pi' | 'member' | 'viewer'>('member')
  const [adding, setAdding] = useState(false)

  // Email-invite mode (for users who don't have an account yet)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteMessage, setInviteMessage] = useState('')
  const [inviting, setInviting] = useState(false)

  const inEmailInviteMode = !!inviteEmail

  const fetchMembers = useCallback(async () => {
    const [projectResult, { data: membersData }, { data: invitesData }] = await Promise.all([
      getProjectWithOwner(supabase, projectId),
      supabase.from('project_members').select('*, user:profiles!user_id(*)').eq('project_id', projectId).order('joined_at'),
      supabase.from('project_invitations').select('id, email, role, created_at, status').eq('project_id', projectId).eq('status', 'pending'),
    ])
    if (projectResult.data?.owner) setOwner(projectResult.data.owner as Profile)
    if (projectResult.data?.title) setProjectTitle(projectResult.data.title)
    if (membersData) setMembers(membersData as MemberWithProfile[])
    if (invitesData) setPendingInvites(invitesData)
    setLoading(false)
  }, [projectId, supabase])

  useEffect(() => { fetchMembers() }, [fetchMembers])

  // Search existing profiles (only when not in invite mode)
  useEffect(() => {
    if (!searchQuery.trim() || inEmailInviteMode) { setSearchResults([]); return }
    const timeout = setTimeout(async () => {
      const result = await searchProfiles(supabase, `full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`, owner?.id ?? '')
      const memberIds = new Set(members.map(m => m.user_id))
      setSearchResults((result.data ?? []).filter(p => !memberIds.has(p.id)))
    }, 300)
    return () => clearTimeout(timeout)
  }, [searchQuery, members, owner, supabase, inEmailInviteMode])

  const handleAdd = async () => {
    if (!selectedUser) return
    setAdding(true)
    try {
      // Send invitation instead of direct insert — existing users must explicitly accept
      const res = await fetch('/api/invitations/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'project',
          email: selectedUser.email.trim().toLowerCase(),
          role: roleToInviteRole[newMemberRole] ?? 'researcher',
          projectId,
          projectTitle: projectTitle || 'Project',
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to send invitation')
      } else {
        logAudit('project.member.invited', 'project', projectId, {
          invited_user_id: selectedUser.id,
          invited_user_name: selectedUser.full_name ?? selectedUser.email,
          role: newMemberRole,
        }, projectId)
        toast.success(`Invitation sent to ${selectedUser.full_name ?? selectedUser.email}`)
        resetDialog()
        setShowAdd(false)
        fetchMembers()
      }
    } catch (err) {
      console.error('Error sending invitation:', err)
      toast.error('Network error sending invitation')
    } finally {
      setAdding(false)
    }
  }

  const handleInviteByEmail = async () => {
    if (!inviteEmail.trim()) return
    setInviting(true)
    
    try {
      // Call the proper invitation API endpoint
      const res = await fetch('/api/invitations/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'project',
          email: inviteEmail.trim().toLowerCase(),
          role: roleToInviteRole[newMemberRole] ?? 'researcher',
          projectId,
          projectTitle: projectTitle || 'Project',
          message: inviteMessage || null,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error ?? 'Failed to send invitation')
      } else {
        toast.success(`Invitation sent to ${inviteEmail}`)
        resetDialog()
        setShowAdd(false)
        fetchMembers()
      }
    } catch (error) {
      console.error('Error sending invitation:', error)
      toast.error('Network error sending invitation')
    } finally {
      setInviting(false)
    }
  }

  const resetDialog = () => {
    setSearchQuery('')
    setSelectedUser(null)
    setInviteEmail('')
    setInviteMessage('')
    setNewMemberRole('member')
  }

  const handleRoleChange = async (memberId: string, role: string) => {
    await supabase.from('project_members').update({ role }).eq('id', memberId)
    fetchMembers()
  }

  const handleRemove = async (memberId: string) => {
    const member = members.find(m => m.id === memberId)
    const { error } = await supabase.from('project_members').delete().eq('id', memberId)
    if (!error && member) {
      logAudit('project.member.removed', 'project', projectId, {
        removed_user_id: member.user_id,
        removed_user_name: member.user?.full_name ?? member.user?.email,
        role: member.role,
      }, projectId)
    }
    fetchMembers()
  }

  const handleCancelInvite = async (inviteId: string) => {
    await supabase.from('project_invitations').update({ status: 'declined' }).eq('id', inviteId)
    fetchMembers()
  }

  const isOwner = profile?.id === owner?.id
  const isMemberPI = members.find(m => m.user_id === profile?.id)?.role === 'pi'
  const canManage = isOwner || isMemberPI

  if (loading) {
    return (
      <div className="p-8 max-w-2xl mx-auto space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-16 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl" />
        ))}
      </div>
    )
  }

  const totalCount = 1 + members.length + pendingInvites.length

  return (
    <div className="p-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-[var(--bg-inset)] flex items-center justify-center">
            <Users className="h-4 w-4 text-[var(--text-secondary)]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)] tracking-tight">Project Team</h2>
            <p className="text-sm text-[var(--text-tertiary)]">
              {totalCount} member{totalCount !== 1 ? 's' : ''}
              {pendingInvites.length > 0 && ` · ${pendingInvites.length} pending`}
            </p>
          </div>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setShowAdd(true)} className="h-8 gap-1.5 text-xs">
            <UserPlus className="h-3.5 w-3.5" />
            Add Member
          </Button>
        )}
      </div>

      {/* Member list */}
      <div className="space-y-2">
        {/* Owner row */}
        {owner && (
          <div className="flex items-center gap-3 p-4 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl">
            <div className="h-9 w-9 rounded-full bg-purple-100 dark:bg-purple-950/40 flex items-center justify-center text-purple-700 dark:text-purple-400 text-sm font-semibold flex-shrink-0">
              {getInitials(owner.full_name)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                {owner.full_name ?? owner.email}
                {owner.id === profile?.id && <span className="text-xs text-[var(--text-tertiary)] ml-1">(you)</span>}
              </p>
              <p className="text-xs text-[var(--text-tertiary)] truncate">{owner.email}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Crown className="h-3.5 w-3.5 text-purple-500" />
              <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', roleBadgeClass.owner)}>
                Owner
              </span>
            </div>
          </div>
        )}

        {/* Active members */}
        {members.map(member => (
          <div key={member.id} className="flex items-center gap-3 p-4 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl">
            <div className="h-9 w-9 rounded-full bg-[var(--bg-inset)] flex items-center justify-center text-[var(--text-secondary)] text-sm font-semibold flex-shrink-0">
              {getInitials(member.user?.full_name)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                {member.user?.full_name ?? member.user?.email}
                {member.user_id === profile?.id && <span className="text-xs text-[var(--text-tertiary)] ml-1">(you)</span>}
              </p>
              <p className="text-xs text-[var(--text-tertiary)] truncate">
                {member.user?.email} · Joined {formatDate(member.joined_at)}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {canManage && member.user_id !== profile?.id ? (
                <Select
                  value={member.role}
                  onValueChange={v => handleRoleChange(member.id, v)}
                >
                  <SelectTrigger className="h-7 text-xs w-36 border-[var(--border-default)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pi">Principal Investigator</SelectItem>
                    <SelectItem value="member">Researcher</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', roleBadgeClass[member.role] ?? roleBadgeClass.member)}>
                  {roleLabel[member.role] ?? member.role}
                </span>
              )}
              {canManage && member.user_id !== profile?.id && (
                <button
                  onClick={() => handleRemove(member.id)}
                  className="h-7 w-7 flex items-center justify-center rounded-md text-[var(--text-tertiary)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                  title="Remove member"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Pending invitations */}
        {pendingInvites.length > 0 && (
          <>
            <p className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider pt-2 pb-1 px-1">
              Pending Invitations
            </p>
            {pendingInvites.map(invite => (
              <div key={invite.id} className="flex items-center gap-3 p-4 bg-[var(--bg-surface)] border border-[var(--border-default)] border-dashed rounded-xl opacity-75">
                <div className="h-9 w-9 rounded-full bg-[var(--bg-inset)] flex items-center justify-center flex-shrink-0">
                  <Mail className="h-4 w-4 text-[var(--text-tertiary)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)] truncate">{invite.email}</p>
                  <p className="text-xs text-[var(--text-tertiary)]">
                    Invited · awaiting signup
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-full">
                    <Clock className="h-3 w-3" />
                    Pending
                  </span>
                  {canManage && (
                    <button
                      onClick={() => handleCancelInvite(invite.id)}
                      className="h-7 w-7 flex items-center justify-center rounded-md text-[var(--text-tertiary)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                      title="Cancel invitation"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </>
        )}

        {members.length === 0 && pendingInvites.length === 0 && (
          <div className="py-12 text-center bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl">
            <Users className="h-8 w-8 mx-auto text-[var(--text-tertiary)] mb-2" />
            <p className="text-sm font-medium text-[var(--text-primary)] mb-1">No additional members</p>
            <p className="text-xs text-[var(--text-tertiary)]">Only you are on this project. Add collaborators above.</p>
          </div>
        )}
      </div>

      {/* Supervisor access — only shown to project owner */}
      {isOwner && (
        <div className="mt-8 border border-[var(--border-default)] rounded-2xl p-5 bg-[var(--bg-surface)]">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center">
              <Eye className="h-4 w-4 text-indigo-500" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Supervisor Access</h3>
              <p className="text-xs text-[var(--text-tertiary)]">Control which of your supervisors can view this project</p>
            </div>
          </div>
          <ProjectSupervisorAccess projectId={projectId} />
        </div>
      )}

      {/* Add Member / Invite Modal */}
      <Dialog open={showAdd} onOpenChange={v => { setShowAdd(v); if (!v) resetDialog() }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{inEmailInviteMode ? 'Invite by Email' : selectedUser ? 'Invite Team Member' : 'Add Team Member'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {inEmailInviteMode ? (
              /* ── Email invite mode ── */
              <>
                <div className="flex items-center gap-2 px-3 py-2.5 bg-[var(--bg-inset)] rounded-lg">
                  <Mail className="h-4 w-4 text-[var(--text-tertiary)] flex-shrink-0" />
                  <span className="text-sm text-[var(--text-primary)] truncate">{inviteEmail}</span>
                  <button
                    onClick={() => { setInviteEmail(''); setInviteMessage('') }}
                    className="ml-auto text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="text-xs text-[var(--text-tertiary)] -mt-2">
                  They will receive an invitation link. If they don&apos;t have an account yet, they can create one when they open it.
                </p>
                <div>
                  <label className="text-sm font-medium text-[var(--text-primary)] block mb-1.5">
                    Message <span className="text-[var(--text-tertiary)] font-normal">(optional)</span>
                  </label>
                  <Input
                    placeholder="e.g. I'd like you to collaborate on this research project…"
                    value={inviteMessage}
                    onChange={e => setInviteMessage(e.target.value)}
                  />
                </div>
              </>
            ) : (
              /* ── Search existing users ── */
              <div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-tertiary)]" />
                  <Input
                    placeholder="Search by name or email…"
                    value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); setSelectedUser(null) }}
                    className="pl-9"
                  />
                  {searchQuery && (
                    <button onClick={() => { setSearchQuery(''); setSelectedUser(null) }} className="absolute right-3 top-1/2 -translate-y-1/2">
                      <X className="h-4 w-4 text-[var(--text-tertiary)]" />
                    </button>
                  )}
                </div>

                {/* Existing user results */}
                {searchResults.length > 0 && !selectedUser && (
                  <div className="mt-1 border border-[var(--border-default)] rounded-lg overflow-hidden bg-[var(--bg-surface)] shadow-sm">
                    {searchResults.map(user => (
                      <button
                        key={user.id}
                        onClick={() => { setSelectedUser(user); setSearchQuery(user.full_name ?? user.email) }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[var(--bg-surface-hover)] transition-colors text-left"
                      >
                        <div className="h-8 w-8 rounded-full bg-[var(--bg-inset)] flex items-center justify-center text-xs font-semibold flex-shrink-0">
                          {getInitials(user.full_name)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[var(--text-primary)] truncate">{user.full_name ?? '—'}</p>
                          <p className="text-xs text-[var(--text-tertiary)] truncate">{user.email} · {user.role}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* No results — offer email invite */}
                {searchQuery.length >= 2 && searchResults.length === 0 && !selectedUser && (
                  <div className="mt-1 border border-[var(--border-default)] rounded-lg overflow-hidden bg-[var(--bg-surface)] shadow-sm">
                    <button
                      onClick={() => {
                        // If it looks like an email, use it directly; otherwise prompt them to enter one
                        setInviteEmail(searchQuery.includes('@') ? searchQuery : '')
                        if (!searchQuery.includes('@')) setSearchQuery('')
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[var(--bg-surface-hover)] transition-colors text-left"
                    >
                      <div className="h-8 w-8 rounded-full bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center flex-shrink-0">
                        <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="min-w-0">
                        {searchQuery.includes('@') ? (
                          <>
                            <p className="text-sm font-medium text-[var(--text-primary)]">Invite &quot;{searchQuery}&quot;</p>
                            <p className="text-xs text-[var(--text-tertiary)]">Send an email invitation — they can sign up when they open it</p>
                          </>
                        ) : (
                          <>
                            <p className="text-sm font-medium text-[var(--text-primary)]">No account found</p>
                            <p className="text-xs text-[var(--text-tertiary)]">Invite by email — they can sign up when they open it</p>
                          </>
                        )}
                      </div>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Role selector (shown in both modes) */}
            <div>
              <label className="text-sm font-medium text-[var(--text-primary)] block mb-1.5">Role in project</label>
              <Select value={newMemberRole} onValueChange={v => setNewMemberRole(v as typeof newMemberRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pi">
                    <div>
                      <p className="font-medium">Principal Investigator</p>
                      <p className="text-xs text-muted-foreground">Can manage team, approve documents, create ethics</p>
                    </div>
                  </SelectItem>
                  <SelectItem value="member">
                    <div>
                      <p className="font-medium">Researcher</p>
                      <p className="text-xs text-muted-foreground">Can create and edit documents, submit for review</p>
                    </div>
                  </SelectItem>
                  <SelectItem value="viewer">
                    <div>
                      <p className="font-medium">Viewer</p>
                      <p className="text-xs text-muted-foreground">Read-only access to all project content</p>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* If invite mode but email is still empty (non-email search term clicked), show email input */}
            {inEmailInviteMode && !inviteEmail && (
              <div>
                <label className="text-sm font-medium text-[var(--text-primary)] block mb-1.5">Email address</label>
                <Input
                  type="email"
                  placeholder="colleague@university.edu"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  autoFocus
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAdd(false); resetDialog() }}>
              Cancel
            </Button>
            {inEmailInviteMode ? (
              <Button onClick={handleInviteByEmail} disabled={!inviteEmail.trim() || inviting}>
                {inviting ? 'Sending…' : 'Send Invitation'}
              </Button>
            ) : (
              <Button onClick={handleAdd} disabled={!selectedUser || adding}>
                {adding ? 'Sending…' : 'Send Invitation'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
