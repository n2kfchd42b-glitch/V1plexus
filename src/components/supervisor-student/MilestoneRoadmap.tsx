'use client'

import { StudentMilestone, MilestoneStatus } from '@/types/database'
import { cn } from '@/lib/utils'
import {
  CheckCircle2, Clock, AlertCircle, RotateCcw, Circle,
  ChevronRight, FileText, MessageSquare,
} from 'lucide-react'
import { format } from 'date-fns'

const STATUS_CONFIG: Record<MilestoneStatus, {
  label: string; icon: React.ElementType; color: string; bg: string; border: string
}> = {
  pending:            { label: 'Not started',       icon: Circle,       color: 'text-slate-400', bg: 'bg-slate-50',   border: 'border-slate-200' },
  submitted:          { label: 'Submitted',          icon: Clock,        color: 'text-blue-600',  bg: 'bg-blue-50',    border: 'border-blue-200' },
  under_review:       { label: 'Under review',       icon: FileText,     color: 'text-amber-600', bg: 'bg-amber-50',   border: 'border-amber-200' },
  revision_requested: { label: 'Revision requested', icon: RotateCcw,    color: 'text-orange-600',bg: 'bg-orange-50',  border: 'border-orange-200' },
  approved:           { label: 'Approved',           icon: CheckCircle2, color: 'text-emerald-600',bg: 'bg-emerald-50',border: 'border-emerald-200' },
}

interface MilestoneRoadmapProps {
  milestones: StudentMilestone[]
  role: 'student' | 'supervisor'
  onSubmit?: (m: StudentMilestone) => void
  onReview?: (m: StudentMilestone) => void
}

export function MilestoneRoadmap({ milestones, role, onSubmit, onReview }: MilestoneRoadmapProps) {
  const approved = milestones.filter(m => m.status === 'approved').length
  const progress = milestones.length > 0 ? Math.round((approved / milestones.length) * 100) : 0

  return (
    <div className="space-y-3">
      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
          <span>{approved} of {milestones.length} milestones approved</span>
          <span className="font-semibold text-slate-700">{progress}%</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Milestone list */}
      {milestones.map((milestone, idx) => {
        const cfg = STATUS_CONFIG[milestone.status]
        const Icon = cfg.icon
        const canSubmit = role === 'student' && ['pending', 'revision_requested'].includes(milestone.status)
        const needsReview = role === 'supervisor' && ['submitted', 'under_review'].includes(milestone.status)
        const isLast = idx === milestones.length - 1

        return (
          <div key={milestone.id} className="flex gap-4">
            {/* Timeline connector */}
            <div className="flex flex-col items-center">
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center border-2 flex-shrink-0',
                cfg.bg, cfg.border
              )}>
                <Icon className={cn('h-4 w-4', cfg.color)} />
              </div>
              {!isLast && <div className="w-px flex-1 bg-slate-100 mt-1 mb-1" />}
            </div>

            {/* Card */}
            <div className={cn(
              'flex-1 mb-3 rounded-xl border p-4 bg-white shadow-sm transition-all',
              needsReview && 'ring-2 ring-blue-200'
            )}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Step {milestone.order_index + 1}
                    </span>
                    <span className={cn(
                      'text-[10px] font-semibold px-1.5 py-0.5 rounded-full border',
                      cfg.bg, cfg.color, cfg.border
                    )}>
                      {cfg.label}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-800 mt-1">{milestone.title}</h3>
                  {milestone.description && (
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{milestone.description}</p>
                  )}
                  {milestone.due_date && (
                    <p className="text-xs text-slate-400 mt-1">
                      Due {format(new Date(milestone.due_date), 'dd MMM yyyy')}
                    </p>
                  )}
                  {milestone.approved_at && (
                    <p className="text-xs text-emerald-600 mt-1 font-medium">
                      Approved {format(new Date(milestone.approved_at), 'dd MMM yyyy')}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {canSubmit && onSubmit && (
                    <button
                      onClick={() => onSubmit(milestone)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#0052CC] text-white hover:bg-blue-700 transition-colors"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                      {milestone.status === 'revision_requested' ? 'Resubmit' : 'Submit'}
                    </button>
                  )}
                  {needsReview && onReview && (
                    <button
                      onClick={() => onReview(milestone)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      Review
                    </button>
                  )}
                </div>
              </div>

              {/* Latest submission feedback preview */}
              {(Array.isArray(milestone.latest_submission)
                ? milestone.latest_submission[milestone.latest_submission.length - 1]
                : milestone.latest_submission
              )?.feedback && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Supervisor feedback
                  </p>
                  <p className="text-xs text-slate-600 line-clamp-2">
                    {(Array.isArray(milestone.latest_submission)
                      ? milestone.latest_submission[milestone.latest_submission.length - 1]
                      : milestone.latest_submission
                    )?.feedback}
                  </p>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
