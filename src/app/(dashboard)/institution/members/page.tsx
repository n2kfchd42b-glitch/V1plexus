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
    <div className="px-8 py-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 font-headline">Members</h1>
          <p className="text-slate-500 mt-1 font-medium text-sm">
            {members.length} member{members.length !== 1 ? 's' : ''} in your institution
          </p>
        </div>
      </div>

      {/* Role summary */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {(Object.keys(roleConfig) as UserRole[]).map(role => {
          const { label, icon: Icon } = roleConfig[role]
          return (
            <button
              key={role}
              onClick={() => setRoleFilter(prev => prev === role ? 'all' : role)}
              className={cn(
                'bg-white p-5 rounded-xl border shadow-sm transition-all duration-150 text-left',
                roleFilter === role
                  ? 'border-clinical-blue ring-1 ring-clinical-blue/20'
                  : 'border-slate-200 hover:border-slate-300'
              )}
            >
              <p className="text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-2">{label}</p>
              <div className="flex items-end justify-between">
                <h3 className="text-2xl font-extrabold font-headline">{counts[role]}</h3>
                <Icon className="h-5 w-5 text-slate-400" />
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
            <div key={i} className="h-16 bg-white border border-slate-200 rounded-xl shadow-sm" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center bg-white border border-slate-200 rounded-xl shadow-sm">
          <Users className="h-8 w-8 mx-auto text-slate-300 mb-2" />
          <p className="text-sm font-bold text-slate-900">No members found</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="divide-y divide-slate-100">
            {filtered.map((member, i) => {
              const config = roleConfig[member.role] ?? roleConfig.researcher
              const Icon = config.icon
              const isMe = member.id === profile?.id
              return (
                <div key={member.id} className={cn(
                  "flex items-center gap-4 px-6 py-3 hover:bg-blue-50/30 transition-colors",
                  i % 2 === 1 && "bg-slate-50/50"
                )}>
                  {/* Avatar */}
                  <div className="h-9 w-9 rounded-lg bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-600 flex-shrink-0">
                    {getInitials(member.full_name)}
                  </div>

                  {/* Name + email */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {member.full_name ?? '—'}
                      {isMe && <span className="text-xs text-slate-400 ml-1.5">(you)</span>}
                    </p>
                    <p className="text-xs text-slate-400 truncate">{member.email}</p>
                  </div>

                  {/* Department */}
                  {member.department_id && (
                    <p className="text-xs text-slate-400 hidden sm:block">Dept.</p>
                  )}

                  {/* Joined */}
                  <p className="text-xs text-slate-400 hidden md:block flex-shrink-0">
                    Since {formatDate(member.created_at)}
                  </p>

                  {/* Role */}
                  {isAdmin && !isMe ? (
                    <Select
                      value={member.role}
                      onValueChange={v => handleRoleChange(member.id, v as UserRole)}
                      disabled={savingId === member.id}
                    >
                      <SelectTrigger className="h-7 text-xs w-44 border-slate-200">
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
                    <span className={cn('inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded border flex-shrink-0', config.badge)}>
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
        <p className="mt-4 text-xs text-slate-400">
          Only admins can change member roles. Contact your institution admin.
        </p>
      )}
    </div>
  )
}
