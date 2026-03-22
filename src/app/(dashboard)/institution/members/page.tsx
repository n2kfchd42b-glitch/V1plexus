"use client"

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { cn, getInitials, formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Users, Search, Shield, GraduationCap, Microscope, Settings2 } from 'lucide-react'
import type { Profile, UserRole } from '@/types/database'

const roleConfig: Record<UserRole, { label: string; icon: React.ElementType; badge: string }> = {
  admin:       { label: 'Admin',                icon: Shield,       badge: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400' },
  pi:          { label: 'Principal Investigator', icon: Microscope, badge: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400' },
  coordinator: { label: 'Coordinator',           icon: Settings2,   badge: 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400' },
  researcher:  { label: 'Researcher',            icon: GraduationCap, badge: 'bg-[var(--bg-inset)] text-[var(--text-secondary)]' },
}

export default function InstitutionMembersPage() {
  const { profile } = useAuth()
  const supabase = createClient()

  const [members, setMembers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [savingId, setSavingId] = useState<string | null>(null)

  const isAdmin = profile?.role === 'admin'

  const fetchMembers = useCallback(async () => {
    if (!profile) return
    let query = supabase.from('profiles').select('*').order('full_name')

    // Scope to same institution if available
    if (profile.institution_id) {
      query = query.eq('institution_id', profile.institution_id)
    }

    const { data } = await query
    if (data) setMembers(data)
    setLoading(false)
  }, [profile, supabase])

  useEffect(() => { fetchMembers() }, [fetchMembers])

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    setSavingId(userId)
    await supabase.from('profiles').update({ role: newRole }).eq('id', userId)
    setMembers(prev => prev.map(m => m.id === userId ? { ...m, role: newRole } : m))
    setSavingId(null)
  }

  const filtered = members.filter(m => {
    const matchSearch = !search ||
      m.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase())
    const matchRole = roleFilter === 'all' || m.role === roleFilter
    return matchSearch && matchRole
  })

  const counts = {
    admin:       members.filter(m => m.role === 'admin').length,
    pi:          members.filter(m => m.role === 'pi').length,
    coordinator: members.filter(m => m.role === 'coordinator').length,
    researcher:  members.filter(m => m.role === 'researcher').length,
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)] tracking-tight">Members</h1>
          <p className="text-sm text-[var(--text-tertiary)] mt-0.5">
            {members.length} member{members.length !== 1 ? 's' : ''} in your institution
          </p>
        </div>
      </div>

      {/* Role summary */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {(Object.keys(roleConfig) as UserRole[]).map(role => {
          const { label, icon: Icon, badge } = roleConfig[role]
          return (
            <button
              key={role}
              onClick={() => setRoleFilter(prev => prev === role ? 'all' : role)}
              className={cn(
                'flex items-center gap-3 p-3 rounded-xl border transition-all duration-150 text-left',
                roleFilter === role
                  ? 'border-[var(--accent-blue)] bg-[var(--bg-surface)]'
                  : 'border-[var(--border-default)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)]'
              )}
            >
              <Icon className="h-4 w-4 text-[var(--text-tertiary)]" />
              <div>
                <p className="text-xl font-bold text-[var(--text-primary)]">{counts[role]}</p>
                <p className="text-xs text-[var(--text-tertiary)]">{label}</p>
              </div>
            </button>
          )
        })}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-tertiary)]" />
          <Input
            placeholder="Search by name or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="pi">Principal Investigator</SelectItem>
            <SelectItem value="coordinator">Coordinator</SelectItem>
            <SelectItem value="researcher">Researcher</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Members table */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl">
          <Users className="h-8 w-8 mx-auto text-[var(--text-tertiary)] mb-2" />
          <p className="text-sm font-medium text-[var(--text-primary)]">No members found</p>
        </div>
      ) : (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl overflow-hidden">
          <div className="divide-y divide-[var(--border-subtle)]">
            {filtered.map(member => {
              const config = roleConfig[member.role] ?? roleConfig.researcher
              const Icon = config.icon
              const isMe = member.id === profile?.id
              return (
                <div key={member.id} className="flex items-center gap-4 px-4 py-3 hover:bg-[var(--bg-surface-hover)] transition-colors">
                  {/* Avatar */}
                  <div className="h-9 w-9 rounded-full bg-[var(--bg-inset)] flex items-center justify-center text-sm font-semibold text-[var(--text-secondary)] flex-shrink-0">
                    {getInitials(member.full_name)}
                  </div>

                  {/* Name + email */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                      {member.full_name ?? '—'}
                      {isMe && <span className="text-xs text-[var(--text-tertiary)] ml-1.5">(you)</span>}
                    </p>
                    <p className="text-xs text-[var(--text-tertiary)] truncate">{member.email}</p>
                  </div>

                  {/* Department */}
                  {member.department_id && (
                    <p className="text-xs text-[var(--text-tertiary)] hidden sm:block">Dept.</p>
                  )}

                  {/* Joined */}
                  <p className="text-xs text-[var(--text-tertiary)] hidden md:block flex-shrink-0">
                    Since {formatDate(member.created_at)}
                  </p>

                  {/* Role */}
                  {isAdmin && !isMe ? (
                    <Select
                      value={member.role}
                      onValueChange={v => handleRoleChange(member.id, v as UserRole)}
                      disabled={savingId === member.id}
                    >
                      <SelectTrigger className="h-7 text-xs w-44 border-[var(--border-default)]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="pi">Principal Investigator</SelectItem>
                        <SelectItem value="coordinator">Coordinator</SelectItem>
                        <SelectItem value="researcher">Researcher</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0', config.badge)}>
                      <Icon className="h-3 w-3" />
                      {config.label}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {!isAdmin && (
        <p className="mt-4 text-xs text-[var(--text-tertiary)]">
          Only admins can change member roles. Contact your institution admin.
        </p>
      )}
    </div>
  )
}
