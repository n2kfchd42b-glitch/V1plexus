"use client"

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { cn, getInitials, formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Users, UserPlus, Crown, Trash2, Search, X } from 'lucide-react'
import type { ProjectMember, Profile } from '@/types/database'

type MemberWithProfile = ProjectMember & { user: Profile }

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

export default function ProjectTeamPage() {
  const params = useParams()
  const projectId = params.id as string
  const { profile } = useAuth()
  const supabase = createClient()

  const [members, setMembers] = useState<MemberWithProfile[]>([])
  const [owner, setOwner] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Profile[]>([])
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null)
  const [newMemberRole, setNewMemberRole] = useState<'pi' | 'member' | 'viewer'>('member')
  const [adding, setAdding] = useState(false)

  const fetchMembers = useCallback(async () => {
    const [{ data: projectData }, { data: membersData }] = await Promise.all([
      supabase.from('projects').select('owner_id, owner:profiles!owner_id(*)').eq('id', projectId).single(),
      supabase.from('project_members').select('*, user:profiles!user_id(*)').eq('project_id', projectId).order('joined_at'),
    ])
    if (projectData?.owner) setOwner(projectData.owner as unknown as Profile)
    if (membersData) setMembers(membersData as MemberWithProfile[])
    setLoading(false)
  }, [projectId, supabase])

  useEffect(() => { fetchMembers() }, [fetchMembers])

  // Search existing users to add
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return }
    const timeout = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .or(`full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
        .neq('id', owner?.id ?? '')
        .limit(8)
      // Exclude already-members
      const memberIds = new Set(members.map(m => m.user_id))
      setSearchResults((data ?? []).filter(p => !memberIds.has(p.id)))
    }, 300)
    return () => clearTimeout(timeout)
  }, [searchQuery, members, owner, supabase])

  const handleAdd = async () => {
    if (!selectedUser) return
    setAdding(true)
    await supabase.from('project_members').insert({
      project_id: projectId,
      user_id: selectedUser.id,
      role: newMemberRole,
    })
    setSearchQuery('')
    setSelectedUser(null)
    setNewMemberRole('member')
    setShowAdd(false)
    setAdding(false)
    fetchMembers()
  }

  const handleRoleChange = async (memberId: string, role: string) => {
    await supabase.from('project_members').update({ role }).eq('id', memberId)
    fetchMembers()
  }

  const handleRemove = async (memberId: string) => {
    await supabase.from('project_members').delete().eq('id', memberId)
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
            <p className="text-sm text-[var(--text-tertiary)]">{1 + members.length} member{members.length !== 0 ? 's' : ''}</p>
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

        {/* Members */}
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

        {members.length === 0 && (
          <div className="py-12 text-center bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl">
            <Users className="h-8 w-8 mx-auto text-[var(--text-tertiary)] mb-2" />
            <p className="text-sm font-medium text-[var(--text-primary)] mb-1">No additional members</p>
            <p className="text-xs text-[var(--text-tertiary)]">Only you are on this project. Add collaborators above.</p>
          </div>
        )}
      </div>

      {/* Add Member Modal */}
      <Dialog open={showAdd} onOpenChange={v => { setShowAdd(v); setSearchQuery(''); setSelectedUser(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Search */}
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

              {/* Results */}
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

              {searchQuery.length >= 2 && searchResults.length === 0 && !selectedUser && (
                <p className="mt-2 text-xs text-[var(--text-tertiary)] px-1">No users found. They must sign up first.</p>
              )}
            </div>

            {/* Role selector */}
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
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAdd(false); setSearchQuery(''); setSelectedUser(null) }}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={!selectedUser || adding}>
              {adding ? 'Adding…' : 'Add to Project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
