'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
  AlertTriangle, UserPlus, ChevronRight, ChevronDown,
  Grid3X3, List, BarChart2, Filter, SortAsc, Check,
} from 'lucide-react'
import { InviteStudentModal } from '@/components/supervisor-student/InviteStudentModal'
import { PhaseBar, PhasePill, PHASE_ORDER, type ResearchPhase } from '@/components/ui/phase-bar'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface MilestoneSummary {
  total: number
  approved: number
  pending_review: number
  overdue: number
}

interface StudentAssignment {
  id: string
  student_id: string
  role: 'primary' | 'co_supervisor'
  assigned_at: string
  student: {
    id: string
    full_name: string | null
    email: string
    avatar_url: string | null
    title: string | null
    department_id: string | null
  }
  milestone_summary: MilestoneSummary
  phase?: string
  projects_count?: number
  last_active?: string
  blocker?: string | null
}

type FlagType = 'urgent' | 'review' | null

function deriveFlag(s: StudentAssignment): FlagType {
  if (s.milestone_summary.overdue > 0) return 'urgent'
  if (s.milestone_summary.pending_review > 0) return 'review'
  return null
}

function initials(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(' ')
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase()
  }
  return email.slice(0, 2).toUpperCase()
}

function Avatar({ name, email, size = 32 }: { name: string | null; email: string; size?: number }) {
  const COLORS = ['#1B3A5C', '#3B82F6', '#8B5CF6', '#EC4899', '#14B8A6', '#F59E0B', '#22C55E']
  const key = (name ?? email).charCodeAt(0) + ((name ?? email).charCodeAt(1) || 0)
  const bg = COLORS[key % COLORS.length]
  const text = initials(name, email)
  return (
    <div
      className="rounded-full flex-shrink-0 flex items-center justify-center font-mono font-semibold text-white"
      style={{ width: size, height: size, background: bg, fontSize: size * 0.38 }}
    >
      {text}
    </div>
  )
}

function FlagBadge({ flag }: { flag: FlagType }) {
  if (flag === 'urgent') return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200">
      Needs you
    </span>
  )
  if (flag === 'review') return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
      Review
    </span>
  )
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-green-50 text-green-700 border border-green-200">
      On track
    </span>
  )
}

function StudentCard({ student }: { student: StudentAssignment }) {
  const flag = deriveFlag(student)
  const phase = student.phase ?? 'concept'
  const name = student.student.full_name
  const email = student.student.email
  const role = student.student.title ?? 'Researcher'

  return (
    <Link href={`/supervisor/students/${student.student_id}`}>
      <div className={cn(
        'bg-bg-surface rounded-lg border shadow-sm p-3.5 cursor-pointer hover:bg-bg-surface-hover transition-colors relative',
        flag === 'urgent' ? 'border-red-300' : 'border-border-default',
      )}>
        {flag === 'urgent' && (
          <div className="absolute top-0 left-0 bottom-0 w-0.5 rounded-l-lg bg-status-error" />
        )}
        <div className="flex items-center gap-2.5">
          <Avatar name={name} email={email} size={32} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-text-primary truncate">{name ?? email}</div>
            <div className="text-[11px] text-text-tertiary font-mono">{role}</div>
          </div>
          <FlagBadge flag={flag} />
        </div>
        <div className="mt-3">
          <PhaseBar phase={phase} height={5} />
          <div className="flex items-center gap-1.5 mt-1.5">
            <PhasePill phase={phase} />
            <span className="text-[11px] text-text-tertiary">
              · {student.milestone_summary.total} milestone{student.milestone_summary.total !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
        {flag === 'urgent' && student.milestone_summary.overdue > 0 && (
          <div className="mt-2.5 px-2 py-1.5 bg-bg-inset rounded flex items-center gap-1.5">
            <AlertTriangle className="h-3 w-3 text-amber-500 flex-shrink-0" />
            <span className="text-[11px] text-text-secondary">
              {student.milestone_summary.overdue} overdue milestone{student.milestone_summary.overdue !== 1 ? 's' : ''}
            </span>
          </div>
        )}
        {student.milestone_summary.pending_review > 0 && flag !== 'urgent' && (
          <div className="mt-2.5 px-2 py-1.5 bg-bg-inset rounded flex items-center gap-1.5">
            <AlertTriangle className="h-3 w-3 text-blue-400 flex-shrink-0" />
            <span className="text-[11px] text-text-secondary">
              {student.milestone_summary.pending_review} awaiting review
            </span>
          </div>
        )}
      </div>
    </Link>
  )
}

// ── Dropdown helper ───────────────────────────────────────────────────────────
function Dropdown<T extends string>({
  value, options, label, icon: Icon, onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  label: string
  icon: React.ElementType
  onChange: (v: T) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const current = options.find(o => o.value === value)

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          'flex items-center gap-1.5 h-8 px-3 rounded-md border text-xs font-semibold transition-colors',
          open
            ? 'border-accent-blue bg-accent-blue-subtle text-accent-blue'
            : 'border-border-default text-text-secondary hover:text-text-primary hover:bg-bg-surface-hover'
        )}
      >
        <Icon className="h-3 w-3" />
        {label}{current && value !== (options[0].value) ? `: ${current.label}` : ''}
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-44 bg-bg-surface border border-border-default rounded-lg shadow-lg py-1 z-20">
          {options.map(o => (
            <button
              key={o.value}
              onClick={() => { onChange(o.value); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-text-primary hover:bg-bg-surface-hover transition-colors text-left"
            >
              <span className={cn('w-3.5 h-3.5 flex items-center justify-center', value === o.value ? 'text-accent-blue' : 'text-transparent')}>
                <Check className="h-3 w-3" />
              </span>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Pipeline view (kanban by phase) ──────────────────────────────────────────
function PipelineView({ students }: { students: StudentAssignment[] }) {
  const phases = PHASE_ORDER
  const byPhase: Record<string, StudentAssignment[]> = {}
  for (const p of phases) byPhase[p] = []
  for (const s of students) byPhase[s.phase ?? 'concept']?.push(s)

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 -mx-1 px-1">
      {phases.map(phase => {
        const col = byPhase[phase] ?? []
        return (
          <div key={phase} className="flex-shrink-0 w-52">
            {/* Column header */}
            <div className="flex items-center gap-2 mb-2 px-1">
              <PhasePill phase={phase} />
              <span className="font-mono text-[10px] text-text-tertiary ml-auto">{col.length}</span>
            </div>
            {/* Cards */}
            <div className="space-y-2">
              {col.length === 0 ? (
                <div className="h-16 rounded-lg border border-dashed border-border-default flex items-center justify-center text-[11px] text-text-tertiary">
                  none
                </div>
              ) : (
                col.map(s => (
                  <Link key={s.id} href={`/supervisor/students/${s.student_id}`}>
                    <div className={cn(
                      'bg-bg-surface rounded-lg border p-3 hover:bg-bg-surface-hover transition-colors cursor-pointer',
                      deriveFlag(s) === 'urgent' ? 'border-red-300' : 'border-border-default'
                    )}>
                      <div className="flex items-center gap-2">
                        <Avatar name={s.student.full_name} email={s.student.email} size={24} />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-text-primary truncate">
                            {s.student.full_name ?? s.student.email}
                          </div>
                          <div className="text-[10px] text-text-tertiary font-mono truncate">
                            {s.student.title ?? 'Researcher'}
                          </div>
                        </div>
                      </div>
                      {deriveFlag(s) && (
                        <div className="mt-2">
                          <FlagBadge flag={deriveFlag(s)} />
                        </div>
                      )}
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

type ViewMode = 'grid' | 'list' | 'pipeline'
type FilterMode = 'all' | 'urgent' | 'review' | 'on_track'
type SortMode = 'needs_me' | 'name' | 'phase'

const FILTER_OPTIONS: { value: FilterMode; label: string }[] = [
  { value: 'all',      label: 'All students' },
  { value: 'urgent',   label: 'Needs you' },
  { value: 'review',   label: 'Awaiting review' },
  { value: 'on_track', label: 'On track' },
]

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'needs_me', label: 'Needs me first' },
  { value: 'name',     label: 'Name A–Z' },
  { value: 'phase',    label: 'Phase' },
]

export default function SupervisorDashboardPage() {
  const [students, setStudents] = useState<StudentAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [workspaceName, setWorkspaceName] = useState('')
  const [supervisorId, setSupervisorId] = useState<string | null>(null)
  const [view, setView] = useState<ViewMode>('grid')
  const [filterMode, setFilterMode] = useState<FilterMode>('all')
  const [sortMode, setSortMode] = useState<SortMode>('needs_me')

  const load = useCallback(async () => {
    const res = await fetch('/api/supervisor/students')
    if (res.ok) setStudents(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      setSupervisorId(user.id)
      const { data } = await supabase
        .from('workspace_memberships')
        .select('workspace_id, workspace:workspaces(name)')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single()
      if (data) {
        setWorkspaceId(data.workspace_id)
        setWorkspaceName((data.workspace as { name?: string } | null)?.name ?? 'your workspace')
      }
    })
  }, [load])

  // Apply filter
  const filtered = students.filter(s => {
    if (filterMode === 'all') return true
    const flag = deriveFlag(s)
    if (filterMode === 'urgent') return flag === 'urgent'
    if (filterMode === 'review') return flag === 'review'
    if (filterMode === 'on_track') return flag === null
    return true
  })

  // Apply sort
  const sorted = [...filtered].sort((a, b) => {
    if (sortMode === 'name') {
      return (a.student.full_name ?? a.student.email).localeCompare(b.student.full_name ?? b.student.email)
    }
    if (sortMode === 'phase') {
      return PHASE_ORDER.indexOf((a.phase ?? 'concept') as ResearchPhase) -
             PHASE_ORDER.indexOf((b.phase ?? 'concept') as ResearchPhase)
    }
    // needs_me: urgent > review > on_track
    const flagRank = (s: StudentAssignment) => {
      const f = deriveFlag(s)
      if (f === 'urgent') return 0
      if (f === 'review') return 1
      return 2
    }
    return flagRank(a) - flagRank(b)
  })

  const urgent = students.filter(s => s.milestone_summary.overdue > 0)
  const needsReview = students.filter(s => s.milestone_summary.pending_review > 0)
  const attentionCount = urgent.length + (urgent.length === 0 ? needsReview.length : 0)

  const VIEW_BUTTONS: { id: ViewMode; label: string; icon: React.ElementType }[] = [
    { id: 'grid',     label: 'Grid',     icon: Grid3X3 },
    { id: 'list',     label: 'List',     icon: List },
    { id: 'pipeline', label: 'Pipeline', icon: BarChart2 },
  ]

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-text-tertiary text-sm font-mono">
      Loading students…
    </div>
  )

  return (
    <div className="h-full overflow-y-auto px-8 py-6">
      <div className="max-w-6xl mx-auto">

        {/* Page heading */}
        <div className="flex items-end justify-between mb-5">
          <div>
            <h1 className="text-[32px] font-serif italic font-normal text-text-primary leading-tight tracking-tight">
              My Students
            </h1>
            <div className="mt-1.5 text-sm text-text-secondary">
              <span className="font-semibold text-text-primary">{students.length} active</span>
              {attentionCount > 0 && ` · ${attentionCount} need${attentionCount === 1 ? 's' : ''} you today`}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex border border-border-default rounded-md overflow-hidden">
              {VIEW_BUTTONS.map((btn, i) => {
                const Icon = btn.icon
                return (
                  <div key={btn.id} className="flex">
                    {i > 0 && <div className="w-px bg-border-default" />}
                    <button
                      onClick={() => setView(btn.id)}
                      className={cn(
                        'flex items-center gap-1.5 px-3 h-8 text-xs font-semibold transition-colors',
                        view === btn.id
                          ? 'bg-bg-surface text-text-primary'
                          : 'text-text-secondary hover:text-text-primary hover:bg-bg-surface-hover'
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" /> {btn.label}
                    </button>
                  </div>
                )
              })}
            </div>

            <Dropdown
              value={filterMode}
              options={FILTER_OPTIONS}
              label="Filter"
              icon={Filter}
              onChange={setFilterMode}
            />

            <Dropdown
              value={sortMode}
              options={SORT_OPTIONS}
              label="Sort"
              icon={SortAsc}
              onChange={setSortMode}
            />

            {workspaceId && supervisorId && (
              <button
                onClick={() => setShowInvite(true)}
                className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-accent-primary text-white text-xs font-semibold hover:opacity-90 transition-opacity"
              >
                <UserPlus className="h-3.5 w-3.5" /> Invite
              </button>
            )}
          </div>
        </div>

        {/* Attention strip */}
        {(urgent.length > 0 || needsReview.length > 0) && (
          <div className="rounded-lg border border-amber-300 bg-gradient-to-b from-amber-50 to-white p-4 mb-6">
            <div className="flex items-center gap-3.5">
              <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-text-primary">
                  {attentionCount} student{attentionCount !== 1 ? 's' : ''} need{attentionCount === 1 ? 's' : ''} you today
                </div>
                <div className="text-xs text-text-secondary mt-0.5">
                  {urgent.length > 0 && `${urgent.length} overdue · `}
                  {needsReview.length > 0 && `${needsReview.length} awaiting review`}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {[...urgent, ...needsReview].slice(0, 2).map(s => (
                  <Link
                    key={s.student_id}
                    href={`/supervisor/students/${s.student_id}`}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-amber-300 hover:shadow-sm transition-shadow cursor-pointer"
                  >
                    <Avatar name={s.student.full_name} email={s.student.email} size={22} />
                    <div className="leading-tight">
                      <div className="text-xs font-semibold text-text-primary">
                        {(s.student.full_name ?? s.student.email).split(' ')[0]}
                      </div>
                      <div className="text-[10px] text-text-tertiary font-mono">
                        {s.milestone_summary.overdue > 0 ? `${s.milestone_summary.overdue} overdue` : `${s.milestone_summary.pending_review} pending`}
                      </div>
                    </div>
                  </Link>
                ))}
                <Link
                  href="/supervisor/students"
                  className="flex items-center gap-1 h-8 px-3 rounded-md border border-amber-300 text-xs font-semibold text-amber-700 hover:bg-amber-50 transition-colors"
                >
                  Open all <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Section label */}
        <div className="flex items-center gap-2.5 mb-3">
          <span className="text-[10px] font-semibold tracking-widest text-text-tertiary uppercase">
            {filterMode === 'all' ? 'All students' : FILTER_OPTIONS.find(f => f.value === filterMode)?.label}
          </span>
          <div className="flex-1 h-px bg-border-default" />
          <span className="font-mono text-[10px] text-text-tertiary">{sorted.length}</span>
        </div>

        {/* No results */}
        {sorted.length === 0 && (
          <div className="text-center py-20 text-text-tertiary">
            {students.length === 0 ? (
              <>
                <div className="text-sm font-medium mb-1">No students yet</div>
                <div className="text-xs">Invite a student to get started</div>
              </>
            ) : (
              <>
                <div className="text-sm font-medium mb-1">No students match this filter</div>
                <button
                  onClick={() => setFilterMode('all')}
                  className="text-xs text-accent-blue hover:underline mt-1"
                >
                  Clear filter
                </button>
              </>
            )}
          </div>
        )}

        {/* Views */}
        {sorted.length > 0 && view === 'pipeline' && (
          <PipelineView students={sorted} />
        )}

        {sorted.length > 0 && view !== 'pipeline' && (
          <div className={cn(
            view === 'grid' ? 'grid grid-cols-4 gap-3' : 'flex flex-col gap-2'
          )}>
            {sorted.map(s => (
              view === 'grid' ? (
                <StudentCard key={s.id} student={s} />
              ) : (
                <Link key={s.id} href={`/supervisor/students/${s.student_id}`}>
                  <div className="flex items-center gap-3 bg-bg-surface border border-border-default rounded-lg px-4 py-3 hover:bg-bg-surface-hover transition-colors">
                    <Avatar name={s.student.full_name} email={s.student.email} size={28} />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold text-text-primary truncate">
                        {s.student.full_name ?? s.student.email}
                      </span>
                      {s.student.title && (
                        <span className="text-[11px] text-text-tertiary ml-2 font-mono">{s.student.title}</span>
                      )}
                    </div>
                    <PhasePill phase={s.phase ?? 'concept'} />
                    <FlagBadge flag={deriveFlag(s)} />
                    <ChevronRight className="h-4 w-4 text-text-tertiary" />
                  </div>
                </Link>
              )
            ))}
          </div>
        )}
      </div>

      {showInvite && workspaceId && supervisorId && (
        <InviteStudentModal
          workspaceId={workspaceId}
          workspaceName={workspaceName}
          supervisorId={supervisorId}
          onClose={() => setShowInvite(false)}
        />
      )}
    </div>
  )
}
