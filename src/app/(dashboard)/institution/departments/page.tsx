'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { cn, getInitials } from '@/lib/utils'
import {
  Users, GraduationCap, CheckCircle2, Clock,
  ChevronRight, BarChart2, Building2, Plus, UserPlus, Loader2, Mail,
} from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'

// ───────────────────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────────────────
interface ProfileLite {
  id: string
  full_name: string | null
  email: string
  avatar_url: string | null
  title: string | null
}

interface DeptWithStats {
  id: string
  name: string
  description: string | null
  heads: ProfileLite[]
  supervisor_count: number
  student_count: number
}

interface MemberRow {
  id: string
  role: string
  user: ProfileLite | null
  department: { id: string; name: string } | null
}

interface StudentEntry {
  assignment_id: string
  student: ProfileLite
  role: string
  assigned_at: string
  milestone_summary: { total: number; approved: number; pending_review: number }
}

interface SupervisorEntry {
  supervisor: ProfileLite
  students: StudentEntry[]
  total_students: number
  total_milestones: number
  approved_milestones: number
  pending_review: number
}

interface OverviewData {
  institutionId: string
  supervisors: SupervisorEntry[]
}

// ───────────────────────────────────────────────────────────────────────────
// Small UI helpers
// ───────────────────────────────────────────────────────────────────────────
function Avatar({ name, url, size = 'md' }: { name: string | null; url: string | null; size?: 'xs' | 'sm' | 'md' | 'lg' }) {
  const sz = size === 'xs' ? 'h-6 w-6 text-[9px]' : size === 'sm' ? 'h-7 w-7 text-[10px]' : size === 'lg' ? 'h-11 w-11 text-sm' : 'h-8 w-8 text-xs'
  return (
    <div className={cn('rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center flex-shrink-0', sz)}>
      {url
        ? <Image src={url} alt="" width={44} height={44} className={cn('rounded-full object-cover', sz)} />
        : getInitials(name)
      }
    </div>
  )
}

function MilestoneBar({ approved, total }: { approved: number; total: number }) {
  const pct = total > 0 ? Math.round((approved / total) * 100) : 0
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-semibold text-slate-500 tabular-nums w-7 text-right">{pct}%</span>
    </div>
  )
}

function StatPill({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: number; color: string
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className={cn('h-3.5 w-3.5', color)} />
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-xs font-bold text-slate-700 tabular-nums">{value}</span>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// Manage Heads modal
// ───────────────────────────────────────────────────────────────────────────
function ManageHeadsModal({
  dept,
  open,
  onClose,
  onChanged,
}: {
  dept: DeptWithStats | null
  open: boolean
  onClose: () => void
  onChanged: () => void
}) {
  const [members, setMembers] = useState<MemberRow[]>([])
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState<string | null>(null) // user_id we're acting on
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteMsg, setInviteMsg] = useState('')
  const [inviting, setInviting] = useState(false)
  // Plexus-aware lookup state (null = empty/unchecked, undefined = loading)
  const [lookup, setLookup] = useState<null | undefined | {
    profile: (ProfileLite & { institution_id: string | null }) | null
    same_institution: boolean
  }>(null)

  // Lazy-load members on open
  useEffect(() => {
    if (!open) return
    fetch('/api/institution/members?limit=1000', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then((data: { members: MemberRow[] } | null) => setMembers(data?.members ?? []))
      .catch(() => {})
  }, [open])

  // Debounce-lookup the email against Plexus profiles, so we can offer direct
  // promotion when the invitee already has an account (Fix 1 of PR 13).
  useEffect(() => {
    const email = inviteEmail.trim().toLowerCase()
    if (!email || !email.includes('@') || !email.includes('.')) {
      setLookup(null)
      return
    }
    setLookup(undefined) // loading
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`/api/institution/profiles/lookup?email=${encodeURIComponent(email)}`)
        if (!res.ok) { setLookup({ profile: null, same_institution: false }); return }
        const body = await res.json() as {
          profile: (ProfileLite & { institution_id: string | null }) | null
          same_institution: boolean
        }
        setLookup(body)
      } catch {
        setLookup({ profile: null, same_institution: false })
      }
    }, 350)
    return () => clearTimeout(handle)
  }, [inviteEmail])

  const headIds = useMemo(() => new Set((dept?.heads ?? []).map(h => h.id)), [dept])
  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase()
    return members
      .filter(m => m.user && !headIds.has(m.user.id))
      // Don't offer to "promote" institution admins/owners — they already
      // have institution-wide scope; making them a dept head is a downgrade.
      .filter(m => m.role !== 'admin' && m.role !== 'owner')
      .filter(m => {
        if (!q) return true
        const u = m.user!
        return (u.full_name ?? '').toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
      })
      .slice(0, 25)
  }, [members, search, headIds])

  if (!dept) return null

  async function promote(userId: string) {
    if (!dept) return
    setBusy(userId)
    const res = await fetch(`/api/institution/departments/${dept.id}/heads`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
    })
    setBusy(null)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      toast.error(body.error ?? 'Could not promote')
      return
    }
    toast.success('Department head assigned')
    onChanged()
  }

  async function demote(userId: string) {
    if (!dept) return
    setBusy(userId)
    const res = await fetch(`/api/institution/departments/${dept.id}/heads?user_id=${userId}`, {
      method: 'DELETE',
    })
    setBusy(null)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      toast.error(body.error ?? 'Could not remove')
      return
    }
    toast.success('Head removed')
    onChanged()
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault()
    if (!dept || !inviteEmail.trim()) return
    setInviting(true)

    // Plexus-aware branching:
    //   - profile exists, same institution → promote directly (no email)
    //   - profile exists, unaffiliated     → link + promote directly (no email)
    //   - profile exists, other institution OR no profile → invite by email
    let body: Record<string, unknown>
    let action: 'promote' | 'invite' = 'invite'
    if (lookup && lookup.profile) {
      const otherInstitution = !lookup.same_institution && lookup.profile.institution_id !== null
      if (otherInstitution) {
        body = { email: inviteEmail.trim(), message: inviteMsg.trim() || undefined }
      } else {
        body = { user_id: lookup.profile.id, link_to_institution: !lookup.same_institution }
        action = 'promote'
      }
    } else {
      body = { email: inviteEmail.trim(), message: inviteMsg.trim() || undefined }
    }

    const res = await fetch(`/api/institution/departments/${dept.id}/heads`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    setInviting(false)
    if (!res.ok) {
      const resBody = await res.json().catch(() => ({}))
      toast.error(resBody.error ?? 'Could not assign head')
      return
    }
    const resBody = await res.json()
    if (action === 'promote') {
      toast.success(resBody.linked
        ? `${lookup?.profile?.full_name ?? inviteEmail.trim()} added to institution and promoted to head`
        : `${lookup?.profile?.full_name ?? inviteEmail.trim()} promoted to head`)
    } else if (resBody.email_warning) {
      toast.warning(`Invitation recorded, but email failed: ${resBody.email_warning}`)
    } else {
      toast.success(`Invitation sent to ${inviteEmail.trim()}`)
    }
    setInviteEmail('')
    setInviteMsg('')
    setLookup(null)
    onChanged()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage heads — {dept.name}</DialogTitle>
          <DialogDescription>
            Heads can view every supervisor and student in this department and manage milestones.
          </DialogDescription>
        </DialogHeader>

        {/* Current heads */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Current heads</p>
          {dept.heads.length === 0 ? (
            <p className="text-sm text-slate-400 italic px-2 py-3 bg-slate-50 rounded-md">No heads assigned yet.</p>
          ) : (
            <ul className="border border-slate-100 rounded-md divide-y divide-slate-100">
              {dept.heads.map(h => (
                <li key={h.id} className="flex items-center gap-3 px-3 py-2">
                  <Avatar name={h.full_name} url={h.avatar_url} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{h.full_name ?? h.email}</p>
                    <p className="text-xs text-slate-400 truncate">{h.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => demote(h.id)}
                    disabled={busy === h.id}
                    className="text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-50 px-2 py-1 rounded hover:bg-red-50"
                  >
                    {busy === h.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Remove'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Promote existing member */}
        <div className="space-y-2 pt-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Promote a member</p>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or email…"
            className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200"
          />
          <ul className="max-h-48 overflow-y-auto border border-slate-100 rounded-md divide-y divide-slate-100">
            {candidates.length === 0 ? (
              <li className="text-xs text-slate-400 italic px-3 py-3">No matching members.</li>
            ) : candidates.map(m => (
              <li key={m.id} className="flex items-center gap-3 px-3 py-2">
                <Avatar name={m.user!.full_name} url={m.user!.avatar_url} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{m.user!.full_name ?? m.user!.email}</p>
                  <p className="text-xs text-slate-400 truncate">
                    {m.user!.email}
                    {m.role && <span className="ml-2 text-[10px] uppercase tracking-wide text-slate-400">{m.role.replace(/_/g, ' ')}</span>}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => promote(m.user!.id)}
                  disabled={busy === m.user!.id}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 hover:text-indigo-800 disabled:opacity-50 px-2 py-1 rounded hover:bg-indigo-50"
                >
                  {busy === m.user!.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (<><UserPlus className="h-3.5 w-3.5" /> Promote</>)}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Invite by email — Plexus-aware: if the email matches an existing
            profile we offer direct promotion instead of sending mail. */}
        <form onSubmit={invite} className="space-y-2 pt-2 border-t border-slate-100">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Or invite by email</p>
          <input
            type="email"
            required
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="head@university.edu"
            className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200"
          />

          {/* Plexus-awareness hint */}
          {(() => {
            if (lookup === undefined) {
              return (
                <p className="text-[10px] text-slate-400 inline-flex items-center gap-1">
                  <Loader2 className="h-2.5 w-2.5 animate-spin" /> Checking Plexus…
                </p>
              )
            }
            if (!lookup) return null
            if (!lookup.profile) {
              return (
                <p className="text-[10px] text-slate-500">
                  Not on Plexus — they&apos;ll receive an invitation email.
                </p>
              )
            }
            const p = lookup.profile
            const name = p.full_name ?? p.email
            const otherInstitution = !lookup.same_institution && p.institution_id !== null
            const tone = otherInstitution
              ? 'bg-amber-50 border-amber-200 text-amber-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            return (
              <div className={cn('text-[11px] rounded-md border px-2 py-1.5', tone)}>
                <strong>{name}</strong> is already on Plexus
                {lookup.same_institution && ' and in your institution. They\'ll be promoted directly — no email.'}
                {!lookup.same_institution && !otherInstitution && '. They\'ll be added to your institution and promoted directly — no email.'}
                {otherInstitution && '. They\'re affiliated with another institution, so an invitation will be sent.'}
              </div>
            )
          })()}

          <textarea
            value={inviteMsg}
            onChange={(e) => setInviteMsg(e.target.value)}
            placeholder="Optional message (only sent if we email)…"
            rows={2}
            className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md resize-none focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200"
          />
          <button
            type="submit"
            disabled={inviting || !inviteEmail.trim() || lookup === undefined}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-3 py-1.5 rounded-md"
          >
            {inviting
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : (lookup?.profile && (lookup.same_institution || lookup.profile.institution_id === null))
                ? <UserPlus className="h-3.5 w-3.5" />
                : <Mail className="h-3.5 w-3.5" />}
            {lookup?.profile && (lookup.same_institution || lookup.profile.institution_id === null)
              ? 'Promote directly'
              : 'Send invitation'}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// Create department modal
// ───────────────────────────────────────────────────────────────────────────
function CreateDepartmentModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    const res = await fetch('/api/institution/departments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined }),
    })
    setBusy(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      toast.error(body.error ?? 'Could not create department')
      return
    }
    toast.success(`${name.trim()} created`)
    setName('')
    setDescription('')
    onCreated()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New department</DialogTitle>
          <DialogDescription>
            Departments scope programmes, rosters, and student assignments. You can assign heads after creating.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Computer Science"
              className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md resize-none focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200"
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} className="text-xs font-semibold text-slate-500 px-3 py-1.5 rounded hover:bg-slate-50">Cancel</button>
            <button
              type="submit"
              disabled={busy || !name.trim()}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-3 py-1.5 rounded-md"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Create
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// Page
// ───────────────────────────────────────────────────────────────────────────
export default function InstitutionDepartmentsPage() {
  const [depts, setDepts] = useState<DeptWithStats[]>([])
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [managing, setManaging] = useState<DeptWithStats | null>(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    const [deptRes, ovRes] = await Promise.all([
      fetch('/api/institution/departments/with-stats', { cache: 'no-store' }),
      fetch('/api/department/overview', { cache: 'no-store' }),
    ])

    if (!deptRes.ok) {
      const body = await deptRes.json().catch(() => ({}))
      setError(body.error ?? 'Could not load departments')
      setLoading(false)
      return
    }
    const deptBody = await deptRes.json() as { departments: DeptWithStats[] }
    setDepts(deptBody.departments)

    if (ovRes.ok) setOverview(await ovRes.json())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Keep the modal's view of the dept in sync with the latest fetch
  useEffect(() => {
    if (!managing) return
    const fresh = depts.find(d => d.id === managing.id)
    if (fresh && fresh !== managing) setManaging(fresh)
  }, [depts, managing])

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Loading departments…</div>
  )

  if (error) return (
    <div className="flex items-center justify-center h-64 text-red-400 text-sm">{error}</div>
  )

  const supervisors = overview?.supervisors ?? []
  const totalStudents = supervisors.reduce((s, sv) => s + sv.total_students, 0)
  const totalMilestones = supervisors.reduce((s, sv) => s + sv.total_milestones, 0)
  const totalApproved = supervisors.reduce((s, sv) => s + sv.approved_milestones, 0)
  const totalPending = supervisors.reduce((s, sv) => s + sv.pending_review, 0)
  const overallPct = totalMilestones > 0 ? Math.round((totalApproved / totalMilestones) * 100) : 0

  return (
    <div className="px-8 py-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
            <BarChart2 className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Departments</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {depts.length} department{depts.length !== 1 ? 's' : ''} ·{' '}
              {supervisors.length} supervisor{supervisors.length !== 1 ? 's' : ''} ·{' '}
              {totalStudents} student{totalStudents !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-md"
        >
          <Plus className="h-3.5 w-3.5" /> New department
        </button>
      </div>

      {/* Departments management */}
      {depts.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-100 mb-8">
          <Building2 className="h-10 w-10 mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-medium text-slate-500">No departments yet</p>
          <p className="text-xs text-slate-400 mt-1">Create one to start scoping programmes, rosters and supervision.</p>
        </div>
      ) : (
        <div className="space-y-2 mb-10">
          {depts.map(d => (
            <div key={d.id} className="bg-white rounded-xl border border-slate-100 shadow-sm px-5 py-4 flex items-center gap-4">
              <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0">
                <Building2 className="h-4 w-4 text-slate-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">{d.name}</p>
                <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1"><Users className="h-3 w-3 text-indigo-500" /> {d.supervisor_count} supervisor{d.supervisor_count !== 1 ? 's' : ''}</span>
                  <span className="inline-flex items-center gap-1"><GraduationCap className="h-3 w-3 text-violet-500" /> {d.student_count} student{d.student_count !== 1 ? 's' : ''}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {d.heads.length === 0 ? (
                  <span className="text-[11px] italic text-slate-400">No heads</span>
                ) : (
                  <div className="flex -space-x-2">
                    {d.heads.slice(0, 3).map(h => (
                      <div key={h.id} title={h.full_name ?? h.email} className="ring-2 ring-white rounded-full">
                        <Avatar name={h.full_name} url={h.avatar_url} size="xs" />
                      </div>
                    ))}
                    {d.heads.length > 3 && (
                      <div className="ring-2 ring-white rounded-full h-6 w-6 bg-slate-100 text-slate-500 text-[9px] font-bold flex items-center justify-center">
                        +{d.heads.length - 3}
                      </div>
                    )}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setManaging(d)}
                  className="text-xs font-semibold text-indigo-700 hover:text-indigo-800 px-2 py-1 rounded hover:bg-indigo-50"
                >
                  Manage heads
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Supervisor → Students overview (unchanged) */}
      {supervisors.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Supervision overview</h2>
            {totalMilestones > 0 && (
              <span className="text-xs text-slate-500">
                {totalApproved}/{totalMilestones} milestones · {overallPct}% approved · {totalPending} to review
              </span>
            )}
          </div>

          <div className="space-y-5">
            {supervisors.map(entry => {
              const svProgress = entry.total_milestones > 0
                ? Math.round((entry.approved_milestones / entry.total_milestones) * 100)
                : null

              return (
                <div key={entry.supervisor.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
                    <div className="flex items-center gap-3">
                      <Avatar name={entry.supervisor.full_name} url={entry.supervisor.avatar_url} size="lg" />
                      <div>
                        <p className="text-sm font-bold text-slate-900">{entry.supervisor.full_name}</p>
                        <p className="text-xs text-slate-400">{entry.supervisor.email}</p>
                        {entry.supervisor.title && <p className="text-xs text-slate-500 mt-0.5">{entry.supervisor.title}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-5">
                      <StatPill icon={GraduationCap} label="students" value={entry.total_students} color="text-violet-500" />
                      <StatPill icon={CheckCircle2} label="approved" value={entry.approved_milestones} color="text-emerald-500" />
                      {entry.pending_review > 0 && (
                        <StatPill icon={Clock} label="to review" value={entry.pending_review} color="text-amber-500" />
                      )}
                      {svProgress !== null && (
                        <span className={cn(
                          'text-xs font-bold px-2 py-0.5 rounded-full',
                          svProgress === 100 ? 'bg-emerald-50 text-emerald-700' :
                          svProgress >= 50 ? 'bg-blue-50 text-blue-700' :
                          'bg-slate-100 text-slate-600'
                        )}>{svProgress}%</span>
                      )}
                    </div>
                  </div>

                  {entry.students.length === 0 ? (
                    <p className="text-xs text-slate-400 px-5 py-4 italic">No students assigned yet.</p>
                  ) : (
                    <div className="divide-y divide-slate-50">
                      {entry.students.map(st => {
                        const { total, approved, pending_review } = st.milestone_summary
                        return (
                          <Link
                            key={st.assignment_id}
                            href={`/supervisor/students/${st.student.id}`}
                            className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors group"
                          >
                            <Avatar name={st.student.full_name} url={st.student.avatar_url} size="sm" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-sm font-semibold text-slate-800 truncate">{st.student.full_name}</p>
                                {st.role === 'co_supervisor' && (
                                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 uppercase tracking-wide">co-sup</span>
                                )}
                                {pending_review > 0 && (
                                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                                    {pending_review} to review
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-400 truncate">{st.student.email}</p>
                            </div>
                            <div className="w-36 flex-shrink-0">
                              {total > 0 ? <MilestoneBar approved={approved} total={total} /> : <span className="text-[10px] text-slate-300">No milestones</span>}
                            </div>
                            <div className="text-xs text-slate-400 tabular-nums w-16 text-right flex-shrink-0">{approved}/{total}</div>
                            <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 flex-shrink-0 transition-colors" />
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Empty supervision state — only show if there ARE departments but no assignments */}
      {depts.length > 0 && supervisors.length === 0 && (
        <div className="text-center py-12 text-slate-400 bg-white rounded-xl border border-slate-100">
          <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm font-medium">No supervisor assignments yet</p>
          <p className="text-xs mt-1">Once supervisors are assigned to students, you&apos;ll see them grouped here.</p>
        </div>
      )}

      <ManageHeadsModal
        dept={managing}
        open={managing !== null}
        onClose={() => setManaging(null)}
        onChanged={() => { void load() }}
      />
      <CreateDepartmentModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={() => { void load() }}
      />
    </div>
  )
}
