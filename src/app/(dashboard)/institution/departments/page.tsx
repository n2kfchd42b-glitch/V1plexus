'use client'

import { useEffect, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import {
  Users, GraduationCap, CheckCircle2, Clock,
  ChevronRight, BarChart2,
} from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

interface StudentEntry {
  assignment_id: string
  student: { id: string; full_name: string; email: string; avatar_url: string | null; title: string | null }
  role: string
  assigned_at: string
  milestone_summary: { total: number; approved: number; pending_review: number }
}

interface SupervisorEntry {
  supervisor: { id: string; full_name: string; email: string; avatar_url: string | null; title: string | null }
  students: StudentEntry[]
  total_students: number
  total_milestones: number
  approved_milestones: number
  pending_review: number
}

interface OverviewData {
  workspaceId: string
  supervisors: SupervisorEntry[]
}

function getInitials(name: string | null | undefined) {
  if (!name) return '?'
  return name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

function Avatar({ name, url, size = 'md' }: { name: string | null; url: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const sz = size === 'sm' ? 'h-7 w-7 text-[10px]' : size === 'lg' ? 'h-11 w-11 text-sm' : 'h-8 w-8 text-xs'
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
        <div
          className="h-full bg-emerald-500 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
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

export default function InstitutionDepartmentsPage() {
  const [data, setData] = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/department/overview')
    if (res.ok) {
      setData(await res.json())
    } else {
      const body = await res.json()
      setError(body.error ?? 'Failed to load')
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
      Loading department overview…
    </div>
  )

  if (error) return (
    <div className="flex items-center justify-center h-64 text-red-400 text-sm">{error}</div>
  )

  const supervisors = data?.supervisors ?? []
  const totalStudents = supervisors.reduce((s, sv) => s + sv.total_students, 0)
  const totalMilestones = supervisors.reduce((s, sv) => s + sv.total_milestones, 0)
  const totalApproved = supervisors.reduce((s, sv) => s + sv.approved_milestones, 0)
  const totalPending = supervisors.reduce((s, sv) => s + sv.pending_review, 0)
  const overallPct = totalMilestones > 0 ? Math.round((totalApproved / totalMilestones) * 100) : 0

  return (
    <div className="px-8 py-6 max-w-5xl mx-auto">
      <div className="mb-8 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
          <BarChart2 className="h-5 w-5 text-violet-600" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Department Overview</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {supervisors.length} supervisor{supervisors.length !== 1 ? 's' : ''} · {totalStudents} student{totalStudents !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Supervisors', value: supervisors.length, icon: Users, color: 'text-indigo-500', bg: 'bg-indigo-50' },
          { label: 'Students', value: totalStudents, icon: GraduationCap, color: 'text-violet-500', bg: 'bg-violet-50' },
          { label: 'Milestones approved', value: totalApproved, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50' },
          { label: 'Awaiting review', value: totalPending, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50' },
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

      {totalMilestones > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Overall milestone completion</p>
            <span className="text-sm font-bold text-slate-700">{overallPct}%</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-700"
              style={{ width: `${overallPct}%` }}
            />
          </div>
          <p className="text-xs text-slate-400 mt-1.5">{totalApproved} of {totalMilestones} milestones approved</p>
        </div>
      )}

      {supervisors.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">No supervisor assignments yet</p>
          <p className="text-xs mt-1">Supervisors appear here once they have students assigned.</p>
        </div>
      )}

      <div className="space-y-5">
        {supervisors.map(entry => {
          const svProgress = entry.total_milestones > 0
            ? Math.round((entry.approved_milestones / entry.total_milestones) * 100)
            : null

          return (
            <div key={(entry.supervisor as { id: string }).id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
                <div className="flex items-center gap-3">
                  <Avatar name={entry.supervisor.full_name} url={entry.supervisor.avatar_url} size="lg" />
                  <div>
                    <p className="text-sm font-bold text-slate-900">{entry.supervisor.full_name}</p>
                    <p className="text-xs text-slate-400">{entry.supervisor.email}</p>
                    {entry.supervisor.title && (
                      <p className="text-xs text-slate-500 mt-0.5">{entry.supervisor.title}</p>
                    )}
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
                    )}>
                      {svProgress}%
                    </span>
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
                          {total > 0
                            ? <MilestoneBar approved={approved} total={total} />
                            : <span className="text-[10px] text-slate-300">No milestones</span>
                          }
                        </div>

                        <div className="text-xs text-slate-400 tabular-nums w-16 text-right flex-shrink-0">
                          {approved}/{total}
                        </div>

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
    </div>
  )
}
