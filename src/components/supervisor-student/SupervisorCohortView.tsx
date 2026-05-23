'use client'

import Link from 'next/link'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { CheckCircle2, Clock, AlertTriangle, ChevronRight, User } from 'lucide-react'

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
  }
  milestone_summary: MilestoneSummary
}

interface Props {
  students: StudentAssignment[]
  onRefresh: () => void
}

function HealthBadge({ summary }: { summary: MilestoneSummary }) {
  if (summary.pending_review > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
        <Clock className="h-3 w-3" />
        {summary.pending_review} awaiting review
      </span>
    )
  }
  if (summary.overdue > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
        <AlertTriangle className="h-3 w-3" />
        {summary.overdue} overdue
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
      <CheckCircle2 className="h-3 w-3" />
      On track
    </span>
  )
}

export function SupervisorCohortView({ students }: Props) {
  if (students.length === 0) {
    return (
      <div className="text-center py-20 text-slate-400">
        <User className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm font-medium">No students assigned yet</p>
        <p className="text-xs mt-1">Students will appear here once assigned to you</p>
      </div>
    )
  }

  const pendingReviewCount = students.reduce((acc, s) => acc + s.milestone_summary.pending_review, 0)

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      {pendingReviewCount > 0 && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <Clock className="h-4 w-4 text-blue-600 flex-shrink-0" />
          <p className="text-sm text-blue-700 font-medium">
            {pendingReviewCount} milestone{pendingReviewCount !== 1 ? 's' : ''} waiting for your review
          </p>
        </div>
      )}

      {/* Student cards */}
      <div className="grid gap-3">
        {students.map(assignment => {
          const { student, milestone_summary } = assignment
          const progress = milestone_summary.total > 0
            ? Math.round((milestone_summary.approved / milestone_summary.total) * 100)
            : 0

          return (
            <Link
              key={assignment.id}
              href={`/supervisor/students/${student.id}`}
              className="group block bg-white rounded-2xl border border-slate-200 p-5 hover:border-[#0052CC]/40 hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-4">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 text-indigo-700 font-bold text-sm">
                  {student.avatar_url ? (
                    <Image
                      src={student.avatar_url}
                      alt={student.full_name ?? student.email}
                      width={40}
                      height={40}
                      className="w-10 h-10 rounded-full object-cover"
                      unoptimized
                    />
                  ) : (
                    (student.full_name ?? student.email).charAt(0).toUpperCase()
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-slate-800 truncate">
                      {student.full_name ?? student.email}
                    </p>
                    {assignment.role === 'co_supervisor' && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">
                        co-supervisor
                      </span>
                    )}
                    <HealthBadge summary={milestone_summary} />
                  </div>
                  <p className="text-xs text-slate-400 truncate">{student.email}</p>

                  {/* Progress bar */}
                  {milestone_summary.total > 0 && (
                    <div className="mt-2.5">
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                        <span>{milestone_summary.approved}/{milestone_summary.total} milestones approved</span>
                        <span className="font-semibold">{progress}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <ChevronRight className={cn(
                  'h-4 w-4 text-slate-300 flex-shrink-0 transition-colors',
                  'group-hover:text-[#0052CC]'
                )} />
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
