'use client'

import { use, useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import {
  Users, GraduationCap,
  Building2, ShieldCheck, UserPlus, X, Loader2, ClipboardList,
  CheckCircle2,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { cn, getInitials } from '@/lib/utils'
import { MilestonePlaybook } from '@/components/department/MilestonePlaybook'
import { ProgrammesPanel } from '@/components/department/ProgrammesPanel'
import { RosterPanel } from '@/components/department/RosterPanel'
import { ThesisIntakePanel } from '@/components/department/ThesisIntakePanel'

interface ProfileLite {
  id: string
  full_name: string | null
  email: string
  avatar_url: string | null
  title: string | null
}

interface StudentEntry {
  assignment_id: string
  student: ProfileLite
  role: string
  assigned_at: string
}

interface SupervisorEntry {
  supervisor: ProfileLite
  students: StudentEntry[]
  total_students: number
}

interface UnassignedStudent {
  enrollment_id: string
  student: ProfileLite
  programme: { id: string; name: string; short_code: string | null } | null
}

interface AvailableSupervisor extends ProfileLite {
  supervision_max_students: number | null
  department_id: string | null
}

interface DetailData {
  department: { id: string; name: string; description: string | null }
  heads: ProfileLite[]
  supervisor_tree: SupervisorEntry[]
  unassigned_students: UnassignedStudent[]
  available_supervisors: AvailableSupervisor[]
  counts: {
    supervisors: number
    students: number
    unassigned: number
    roster_unclaimed: number
    intake_pending: number
    defenses_pending: number
  }
  viewer: { is_institution_admin: boolean; is_department_head: boolean }
}

function Avatar({ name, url, size = 'md' }: { name: string | null; url: string | null; size?: 'xs' | 'sm' | 'md' | 'lg' }) {
  const sz = size === 'xs' ? 'h-6 w-6 text-[9px]' : size === 'sm' ? 'h-7 w-7 text-[10px]' : size === 'lg' ? 'h-11 w-11 text-sm' : 'h-8 w-8 text-xs'
  return (
    <div className={cn('rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center flex-shrink-0', sz)}>
      {url
        ? <Image src={url} alt="" width={44} height={44} className={cn('rounded-full object-cover', sz)} />
        : getInitials(name)}
    </div>
  )
}

function AssignSupervisorModal({
  open,
  onClose,
  deptId,
  student,
  supervisors,
  onAssigned,
}: {
  open: boolean
  onClose: () => void
  deptId: string
  student: UnassignedStudent | null
  supervisors: AvailableSupervisor[]
  onAssigned: () => void
}) {
  const [supervisorId, setSupervisorId] = useState<string>('')
  const [role, setRole] = useState<'primary' | 'co_supervisor'>('primary')
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!open) {
      setSupervisorId('')
      setSearch('')
      setRole('primary')
    }
  }, [open])

  if (!student) return null

  const filtered = supervisors.filter(s => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (s.full_name ?? '').toLowerCase().includes(q) || s.email.toLowerCase().includes(q)
  })

  async function submit() {
    if (!supervisorId || !student) return
    setBusy(true)
    const res = await fetch(`/api/department/${deptId}/assignments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        student_id: student.student.id,
        supervisor_id: supervisorId,
        role,
      }),
    })
    setBusy(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      toast.error(body.error ?? 'Could not assign')
      return
    }
    toast.success('Supervisor assigned')
    onAssigned()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assign supervisor</DialogTitle>
          <DialogDescription>
            For <span className="font-semibold text-slate-700">{student.student.full_name ?? student.student.email}</span>
            {student.programme && <> · {student.programme.name}</>}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Role</label>
            <div className="flex gap-2">
              {(['primary', 'co_supervisor'] as const).map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={cn(
                    'flex-1 text-xs font-semibold py-1.5 rounded-md border',
                    role === r
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 text-slate-500 hover:border-slate-300'
                  )}
                >
                  {r === 'primary' ? 'Primary' : 'Co-supervisor'}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Supervisor</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email…"
              className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200"
            />
            {supervisors.length === 0 ? (
              <p className="text-xs text-slate-400 italic px-2 py-3">
                No supervisors have opted in to supervise yet. Ask them to flip
                &ldquo;Available to supervise&rdquo; in their profile settings.
              </p>
            ) : (
              <ul className="max-h-56 overflow-y-auto border border-slate-100 rounded-md divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <li className="text-xs text-slate-400 italic px-3 py-3">No matches.</li>
                ) : filtered.map(s => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => setSupervisorId(s.id)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2 text-left transition-colors',
                        supervisorId === s.id ? 'bg-indigo-50' : 'hover:bg-slate-50'
                      )}
                    >
                      <Avatar name={s.full_name} url={s.avatar_url} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{s.full_name ?? s.email}</p>
                        <p className="text-xs text-slate-400 truncate">{s.title ?? s.email}</p>
                      </div>
                      {supervisorId === s.id && <CheckCircle2 className="h-4 w-4 text-indigo-600" />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose} className="text-xs font-semibold text-slate-500 px-3 py-1.5 rounded hover:bg-slate-50">Cancel</button>
            <button
              type="button"
              onClick={submit}
              disabled={busy || !supervisorId}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-3 py-1.5 rounded-md"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
              Assign
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function DepartmentBoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [data, setData] = useState<DetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [assigning, setAssigning] = useState<UnassignedStudent | null>(null)
  const [endingId, setEndingId] = useState<string | null>(null)
  // Tabs lazy-mount: once a tab has been activated we keep it mounted so
  // subsequent switches don't re-fetch its panels' data.
  const [activated, setActivated] = useState<Set<string>>(new Set(['overview']))
  const activate = (tab: string) => setActivated(prev => prev.has(tab) ? prev : new Set([...prev, tab]))

  const load = useCallback(async () => {
    const res = await fetch(`/api/department/${id}/detail`, { cache: 'no-store' })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? 'Could not load department')
      setLoading(false)
      return
    }
    setData(await res.json())
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  async function endAssignment(assignmentId: string) {
    if (!confirm('End this supervision assignment? It will be marked ended in the audit log.')) return
    setEndingId(assignmentId)
    const res = await fetch(`/api/department/${id}/assignments/${assignmentId}`, { method: 'DELETE' })
    setEndingId(null)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      toast.error(body.error ?? 'Could not end assignment')
      return
    }
    toast.success('Assignment ended')
    void load()
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Loading department…</div>
  )

  if (error || !data) return (
    <div className="flex items-center justify-center h-64 text-red-400 text-sm">{error ?? 'Department not found'}</div>
  )

  const { department, heads, supervisor_tree, counts, viewer } = data

  return (
    <div className="px-8 py-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0">
            <Building2 className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{department.name}</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {counts.supervisors} supervisor{counts.supervisors !== 1 ? 's' : ''} ·{' '}
              {counts.students} student{counts.students !== 1 ? 's' : ''}
              {viewer.is_department_head && !viewer.is_institution_admin && (
                <span className="ml-2 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                  <ShieldCheck className="h-3 w-3" /> Department head
                </span>
              )}
            </p>
            {department.description && (
              <p className="text-xs text-slate-400 mt-1 max-w-2xl">{department.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Heads */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-5 py-4 mb-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Department heads</p>
        {heads.length === 0 ? (
          <p className="text-sm text-slate-400 italic">No heads assigned yet.</p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {heads.map(h => (
              <li key={h.id} className="flex items-center gap-3 px-3 py-2 rounded-md bg-slate-50">
                <Avatar name={h.full_name} url={h.avatar_url} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{h.full_name ?? h.email}</p>
                  <p className="text-xs text-slate-400 truncate">{h.title ?? h.email}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Structural KPI strip — no work-content signals */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Supervisors',     value: counts.supervisors,      icon: Users,           color: 'text-indigo-500',  bg: 'bg-indigo-50' },
          { label: 'Students',        value: counts.students,         icon: GraduationCap,   color: 'text-violet-500',  bg: 'bg-violet-50' },
          { label: 'Unassigned',      value: counts.unassigned,       icon: UserPlus,        color: 'text-amber-500',   bg: 'bg-amber-50' },
          { label: 'Roster unclaimed', value: counts.roster_unclaimed, icon: ClipboardList,   color: 'text-slate-500',   bg: 'bg-slate-50' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-3', s.bg)}>
              <s.icon className={cn('h-4 w-4', s.color)} />
            </div>
            <p className="text-2xl font-extrabold text-slate-900 tabular-nums">{s.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <Tabs defaultValue="overview" onValueChange={activate}>
        <TabsList className="mb-4">
          <TabsTrigger value="overview">
            Overview
            {data.counts.unassigned > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 text-[10px] font-bold rounded-full bg-amber-100 text-amber-700">
                {data.counts.unassigned}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="intake">
            Intake
            {data.counts.intake_pending + data.counts.defenses_pending > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 text-[10px] font-bold rounded-full bg-indigo-100 text-indigo-700">
                {data.counts.intake_pending + data.counts.defenses_pending}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="programmes">
            Programmes
            {data.counts.roster_unclaimed > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 text-[10px] font-bold rounded-full bg-slate-100 text-slate-600">
                {data.counts.roster_unclaimed}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="playbook">Playbook</TabsTrigger>
        </TabsList>

        <TabsContent value="intake" forceMount={activated.has('intake') ? true : undefined} hidden={!activated.has('intake')}>
          <ThesisIntakePanel deptId={id} />
        </TabsContent>

        <TabsContent value="programmes" forceMount={activated.has('programmes') ? true : undefined} hidden={!activated.has('programmes')}>
          <ProgrammesPanel deptId={id} />
          <RosterPanel deptId={id} />
        </TabsContent>

        <TabsContent value="playbook" forceMount={activated.has('playbook') ? true : undefined} hidden={!activated.has('playbook')}>
          <MilestonePlaybook deptId={id} />
        </TabsContent>

        <TabsContent value="overview">

      {/* Unassigned students */}
      {data.unassigned_students.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <UserPlus className="h-4 w-4 text-amber-700" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-amber-800">
              Unassigned students · {data.unassigned_students.length}
            </h2>
          </div>
          <ul className="divide-y divide-amber-100/70">
            {data.unassigned_students.map(s => (
              <li key={s.enrollment_id} className="flex items-center gap-3 py-2">
                <Avatar name={s.student.full_name} url={s.student.avatar_url} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{s.student.full_name ?? s.student.email}</p>
                  <p className="text-xs text-slate-500 truncate">
                    {s.student.email}
                    {s.programme && <span className="ml-2 text-[10px] uppercase tracking-wide text-slate-400">{s.programme.short_code ?? s.programme.name}</span>}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAssigning(s)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 bg-white border border-amber-300 hover:bg-amber-100 px-2.5 py-1 rounded-md"
                >
                  <UserPlus className="h-3.5 w-3.5" /> Assign supervisor
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Supervisor → Student directory (matchmaking view only — no work content) */}
      <div className="flex items-center gap-2 mb-3">
        <Users className="h-4 w-4 text-slate-400" />
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Supervisor assignments</h2>
      </div>

      {supervisor_tree.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-100 text-slate-400">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">No supervisor assignments yet</p>
          <p className="text-xs mt-1">Once a supervisor in this department is assigned a student, they&apos;ll appear here.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {supervisor_tree.map(entry => (
            <div key={entry.supervisor.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
                <div className="flex items-center gap-3">
                  <Avatar name={entry.supervisor.full_name} url={entry.supervisor.avatar_url} size="lg" />
                  <div>
                    <p className="text-sm font-bold text-slate-900">{entry.supervisor.full_name ?? entry.supervisor.email}</p>
                    <p className="text-xs text-slate-400">{entry.supervisor.email}</p>
                    {entry.supervisor.title && (
                      <p className="text-xs text-slate-500 mt-0.5">{entry.supervisor.title}</p>
                    )}
                  </div>
                </div>
                <span className="text-xs font-semibold text-slate-500 bg-slate-50 rounded px-2 py-0.5 tabular-nums">
                  {entry.total_students} student{entry.total_students !== 1 ? 's' : ''}
                </span>
              </div>

              {entry.students.length === 0 ? (
                <p className="text-xs text-slate-400 px-5 py-4 italic">No students assigned yet.</p>
              ) : (
                <div className="divide-y divide-slate-50">
                  {entry.students.map(st => (
                    <div key={st.assignment_id} className="flex items-center gap-3 px-5 py-3">
                      <Avatar name={st.student.full_name} url={st.student.avatar_url} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-slate-800 truncate">{st.student.full_name ?? st.student.email}</p>
                          {st.role === 'co_supervisor' && (
                            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 uppercase tracking-wide">co-sup</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 truncate">{st.student.email}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => endAssignment(st.assignment_id)}
                        disabled={endingId === st.assignment_id}
                        title="End assignment"
                        className="text-slate-300 hover:text-red-600 hover:bg-red-50 disabled:opacity-50 rounded p-1 flex-shrink-0"
                      >
                        {endingId === st.assignment_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

        </TabsContent>
      </Tabs>

      <AssignSupervisorModal
        open={assigning !== null}
        onClose={() => setAssigning(null)}
        deptId={id}
        student={assigning}
        supervisors={data.available_supervisors}
        onAssigned={() => { void load() }}
      />
    </div>
  )
}
