'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Users, Loader2, Search, UserPlus, Building2 } from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'

interface Member {
  id: string
  role: string
  status: string
  joined_at: string
  department_id: string | null
  user: {
    id: string
    full_name: string | null
    email: string
    avatar_url: string | null
    title: string | null
    role: string | null
    last_seen_at: string | null
    institution_id: string | null
  } | null
  department: { id: string; name: string } | null
}

interface OverviewData {
  workspace: { id: string; name: string } | null
  members: Member[]
  total: number
  limit: number
  offset: number
}

const ROLE_TONE: Record<string, string> = {
  owner:           'bg-blue-100 text-blue-700',
  admin:           'bg-blue-100 text-blue-700',
  department_head: 'bg-purple-100 text-purple-700',
  supervisor:      'bg-purple-100 text-purple-700',
  pi:              'bg-indigo-100 text-indigo-700',
  researcher:      'bg-emerald-100 text-emerald-700',
  student:         'bg-amber-100 text-amber-700',
  collaborator:    'bg-slate-100 text-slate-700',
  viewer:          'bg-slate-100 text-slate-500',
}

const STATUS_TONE: Record<string, string> = {
  active:    'text-emerald-600',
  invited:   'text-amber-600',
  suspended: 'text-red-600',
  left:      'text-slate-400',
}

export default function InstitutionMembersPage() {
  const [data, setData] = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('')

  // Server-side search via ?search=. Debounce 250ms so we don't fire a
  // request per keystroke.
  useEffect(() => {
    const handle = setTimeout(async () => {
      const params = new URLSearchParams()
      if (search.trim()) params.set('search', search.trim())
      const res = await fetch(`/api/institution/members?${params.toString()}`, { cache: 'no-store' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error ?? 'Could not load members')
        setLoading(false)
        return
      }
      setError(null)
      setData(await res.json())
      setLoading(false)
    }, search ? 250 : 0)
    return () => clearTimeout(handle)
  }, [search])

  // Role filter still runs client-side over the loaded page — the role
  // counts in the dropdown are derived from the current result set.
  const filtered = useMemo(() => {
    const members = data?.members ?? []
    if (!roleFilter) return members
    return members.filter((m) => m.role === roleFilter)
  }, [data, roleFilter])

  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const m of data?.members ?? []) {
      counts[m.role] = (counts[m.role] ?? 0) + 1
    }
    return counts
  }, [data])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--text-tertiary)]" />
      </div>
    )
  }

  if (error) {
    return <div className="px-8 py-10 text-center text-sm text-[var(--text-tertiary)]">{error}</div>
  }

  if (!data?.workspace) {
    return (
      <div className="px-8 py-10 text-center text-sm text-[var(--text-tertiary)]">
        No institutional workspace yet — contact the Plexus team.
      </div>
    )
  }

  return (
    <div className="px-8 py-8 max-w-5xl mx-auto">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--accent-blue)]/10 flex items-center justify-center flex-shrink-0">
            <Users className="h-5 w-5 text-[var(--accent-blue)]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)] font-manrope">Members</h1>
            <p className="text-sm text-[var(--text-secondary)] mt-0.5">
              {data.total > data.members.length
                ? <>Showing first {data.members.length} of <span className="font-medium">{data.total}</span> in {data.workspace.name}</>
                : <>{data.total} total in <span className="font-medium">{data.workspace.name}</span></>}
            </p>
          </div>
        </div>
        <Link
          href="/institution/link-requests"
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-default)] hover:border-[var(--accent-blue)]/40 text-[var(--text-secondary)] hover:text-[var(--accent-blue)]"
        >
          <UserPlus className="h-3.5 w-3.5" />
          Link requests
        </Link>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-tertiary)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, department"
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-2.5 py-1.5 text-sm bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
        >
          <option value="">All roles</option>
          {Object.entries(roleCounts).sort(([a], [b]) => a.localeCompare(b)).map(([role, n]) => (
            <option key={role} value={role}>{role.replace(/_/g, ' ')} ({n})</option>
          ))}
        </select>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-[var(--text-tertiary)] bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-md">
          No members match.
        </p>
      ) : (
        <ul className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-md divide-y divide-[var(--border-default)]">
          {filtered.map((m) => (
            <li key={m.id} className="px-4 py-3 flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-[var(--accent-primary)] flex items-center justify-center text-white text-xs font-bold flex-shrink-0 overflow-hidden">
                {m.user?.avatar_url
                  ? <img src={m.user.avatar_url} alt="" className="h-8 w-8 object-cover" />
                  : getInitials(m.user?.full_name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                    {[m.user?.title, m.user?.full_name].filter(Boolean).join(' ') || m.user?.email || 'Unknown'}
                  </p>
                  {m.department && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-[var(--text-tertiary)] flex-shrink-0">
                      <Building2 className="h-2.5 w-2.5" />
                      {m.department.name}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--text-tertiary)] truncate">{m.user?.email}</p>
              </div>
              <span className={cn(
                'text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md flex-shrink-0',
                ROLE_TONE[m.role] ?? 'bg-slate-100 text-slate-600'
              )}>
                {m.role.replace(/_/g, ' ')}
              </span>
              <span className={cn(
                'text-[10px] font-semibold capitalize flex-shrink-0 w-16 text-right',
                STATUS_TONE[m.status] ?? 'text-slate-400'
              )}>
                {m.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
