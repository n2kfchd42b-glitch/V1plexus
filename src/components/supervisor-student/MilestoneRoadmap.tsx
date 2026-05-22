'use client'

import { StudentMilestone, MilestoneStatus } from '@/types/database'
import { cn } from '@/lib/utils'
import {
  CheckCircle2, Clock, RotateCcw, Circle,
  ChevronRight, FileText, MessageSquare, ExternalLink,
  Database, BarChart2, Lock, ChevronDown,
} from 'lucide-react'
import { format, isPast, differenceInDays } from 'date-fns'
import Link from 'next/link'
import { useState } from 'react'
import { PHASE_ORDER, PHASE_COLORS, PHASE_LABELS, type ResearchPhase } from '@/components/ui/phase-bar'

const STATUS_CONFIG: Record<MilestoneStatus, {
  label: string; icon: React.ElementType; color: string; bg: string; border: string
}> = {
  pending:            { label: 'Not started',       icon: Circle,       color: 'text-slate-400',  bg: 'bg-slate-50',   border: 'border-slate-200'  },
  submitted:          { label: 'Submitted',          icon: Clock,        color: 'text-blue-600',   bg: 'bg-blue-50',    border: 'border-blue-200'   },
  under_review:       { label: 'Under review',       icon: FileText,     color: 'text-amber-600',  bg: 'bg-amber-50',   border: 'border-amber-200'  },
  revision_requested: { label: 'Revision requested', icon: RotateCcw,    color: 'text-orange-600', bg: 'bg-orange-50',  border: 'border-orange-200' },
  approved:           { label: 'Approved',           icon: CheckCircle2, color: 'text-emerald-600',bg: 'bg-emerald-50', border: 'border-emerald-200'},
}

interface MilestoneRoadmapProps {
  milestones: StudentMilestone[]
  role: 'student' | 'supervisor'
  projectId?: string
  onSubmit?: (m: StudentMilestone) => void
  onReview?: (m: StudentMilestone) => void
}

function submissionArtifactLink(sub: StudentMilestone['latest_submission'], projectId?: string) {
  if (!sub || !projectId) return null
  if (sub.document_id)     return { href: `/supervisor/projects/${projectId}/documents/${sub.document_id}`, label: 'View document',  Icon: FileText  }
  if (sub.dataset_id)      return { href: `/supervisor/projects/${projectId}/datasets/${sub.dataset_id}`,  label: 'View dataset',  Icon: Database  }
  if (sub.analysis_run_id) return { href: `/supervisor/projects/${projectId}/analyses/${sub.analysis_run_id}`, label: 'View analysis', Icon: BarChart2 }
  return null
}

interface PhaseGroup {
  phase: string | null
  label: string
  color: string
  milestones: StudentMilestone[]
  allApproved: boolean
  hasAction: boolean   // any submitted/under_review needing attention
  isFuture: boolean    // all pending and none submitted
}

function buildGroups(milestones: StudentMilestone[]): PhaseGroup[] {
  const phased: Record<string, StudentMilestone[]> = {}
  const unphased: StudentMilestone[] = []

  for (const m of milestones) {
    if (m.phase && PHASE_ORDER.includes(m.phase as ResearchPhase)) {
      if (!phased[m.phase]) phased[m.phase] = []
      phased[m.phase].push(m)
    } else {
      unphased.push(m)
    }
  }

  const groups: PhaseGroup[] = []

  for (const phase of PHASE_ORDER) {
    if (!phased[phase]) continue
    const ms = phased[phase]
    const allApproved = ms.every(m => m.status === 'approved')
    const hasAction   = ms.some(m => ['submitted', 'under_review'].includes(m.status))
    const isFuture    = ms.every(m => m.status === 'pending') && !hasAction
    groups.push({ phase, label: PHASE_LABELS[phase], color: PHASE_COLORS[phase], milestones: ms, allApproved, hasAction, isFuture })
  }

  if (unphased.length > 0) {
    const allApproved = unphased.every(m => m.status === 'approved')
    const hasAction   = unphased.some(m => ['submitted', 'under_review'].includes(m.status))
    const isFuture    = unphased.every(m => m.status === 'pending') && !hasAction
    groups.push({ phase: null, label: 'General', color: '#94a3b8', milestones: unphased, allApproved, hasAction, isFuture })
  }

  return groups
}

function MilestoneCard({
  milestone, role, projectId, onSubmit, onReview,
}: {
  milestone: StudentMilestone
  role: 'student' | 'supervisor'
  projectId?: string
  onSubmit?: (m: StudentMilestone) => void
  onReview?: (m: StudentMilestone) => void
}) {
  const cfg = STATUS_CONFIG[milestone.status]
  const Icon = cfg.icon
  const canSubmit   = role === 'student'    && ['pending', 'revision_requested'].includes(milestone.status)
  const needsReview = role === 'supervisor' && ['submitted', 'under_review'].includes(milestone.status)

  const sub = Array.isArray(milestone.latest_submission)
    ? milestone.latest_submission[milestone.latest_submission.length - 1]
    : milestone.latest_submission

  const artifact = submissionArtifactLink(sub, projectId)

  return (
    <div className={cn(
      'rounded-xl border p-4 bg-white shadow-sm transition-all',
      needsReview && 'ring-2 ring-blue-200'
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={cn('w-7 h-7 rounded-full flex items-center justify-center border-2 flex-shrink-0 mt-0.5', cfg.bg, cfg.border)}>
            <Icon className={cn('h-3.5 w-3.5', cfg.color)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full border', cfg.bg, cfg.color, cfg.border)}>
                {cfg.label}
              </span>
            </div>
            <h3 className="text-sm font-bold text-slate-800">{milestone.title}</h3>
            {milestone.description && (
              <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{milestone.description}</p>
            )}
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {milestone.due_date && milestone.status !== 'approved' && (() => {
                const due = new Date(milestone.due_date)
                const overdue = isPast(due)
                const daysLeft = differenceInDays(due, new Date())
                const soon = !overdue && daysLeft <= 7
                return (
                  <span className={cn(
                    'text-xs font-medium',
                    overdue ? 'text-red-600' : soon ? 'text-amber-600' : 'text-slate-400'
                  )}>
                    {overdue
                      ? `Overdue · ${format(due, 'dd MMM')}`
                      : soon
                        ? `Due in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`
                        : `Due ${format(due, 'dd MMM yyyy')}`}
                  </span>
                )
              })()}
              {milestone.approved_at && (
                <span className="text-xs text-emerald-600 font-medium">
                  ✓ Approved {format(new Date(milestone.approved_at), 'dd MMM yyyy')}
                </span>
              )}
            </div>
          </div>
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

      {sub && (artifact || sub.feedback) && (
        <div className="mt-3 pt-3 border-t border-slate-100 space-y-2 pl-10">
          {artifact && (
            <div className="flex items-center gap-2">
              <artifact.Icon className="h-3 w-3 text-slate-400 flex-shrink-0" />
              <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Submitted work</span>
              <Link href={artifact.href} className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:underline">
                <ExternalLink className="h-3 w-3" />{artifact.label}
              </Link>
            </div>
          )}
          {sub.feedback && (
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Reviewer&apos;s note</p>
              <p className="text-xs text-slate-600 line-clamp-2">{sub.feedback}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function PhaseSection({
  group, role, projectId, onSubmit, onReview,
}: {
  group: PhaseGroup
  role: 'student' | 'supervisor'
  projectId?: string
  onSubmit?: (m: StudentMilestone) => void
  onReview?: (m: StudentMilestone) => void
}) {
  // Default state: approved → collapsed, active/future → expanded
  const [expanded, setExpanded] = useState(!group.allApproved)
  const approvedCount = group.milestones.filter(m => m.status === 'approved').length
  const total = group.milestones.length

  // ── Approved phase: single compressed summary row ─────────────────────────
  if (group.allApproved && !expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border border-emerald-100 bg-emerald-50/50 hover:bg-emerald-50 transition-colors group"
      >
        <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: group.color }} />
        <span className="text-sm font-semibold text-emerald-700">{group.label}</span>
        <span className="text-xs text-emerald-500 font-medium">
          {approvedCount} of {total} approved
        </span>
        <span className="ml-auto text-[11px] text-emerald-400 group-hover:text-emerald-600 transition-colors">
          expand ↓
        </span>
      </button>
    )
  }

  // ── Future phase: locked compact row ─────────────────────────────────────
  if (group.isFuture && !expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors group opacity-60"
      >
        <Lock className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: group.color, opacity: 0.4 }} />
        <span className="text-sm font-medium text-slate-500">{group.label}</span>
        <span className="text-xs text-slate-400">{total} milestone{total !== 1 ? 's' : ''}</span>
        <span className="ml-auto text-[11px] text-slate-400 group-hover:text-slate-600 transition-colors">preview ↓</span>
      </button>
    )
  }

  // ── Active / expanded phase: full card list ───────────────────────────────
  return (
    <div className="space-y-2">
      {/* Phase header */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-2.5 py-1 group"
      >
        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: group.color }} />
        <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: group.color }}>
          {group.label}
        </span>

        {group.allApproved ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
            <CheckCircle2 className="h-2.5 w-2.5" /> Complete
          </span>
        ) : group.hasAction ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5">
            Needs review
          </span>
        ) : (
          <span className="inline-flex items-center text-[10px] font-semibold text-slate-400 bg-slate-50 border border-slate-200 rounded-full px-2 py-0.5">
            {approvedCount}/{total}
          </span>
        )}

        <div className="flex-1 h-px bg-slate-100" />
        <ChevronDown className={cn('h-3.5 w-3.5 text-slate-400 transition-transform flex-shrink-0', expanded && 'rotate-180')} />
      </button>

      {expanded && (
        <div className="space-y-2 pl-5 border-l-2" style={{ borderColor: group.color + '40' }}>
          {group.milestones.map(m => (
            <MilestoneCard
              key={m.id}
              milestone={m}
              role={role}
              projectId={projectId}
              onSubmit={onSubmit}
              onReview={onReview}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function MilestoneRoadmap({ milestones, role, projectId, onSubmit, onReview }: MilestoneRoadmapProps) {
  const approved = milestones.filter(m => m.status === 'approved').length
  const groups    = buildGroups(milestones)
  const isGrouped = milestones.some(m => m.phase)

  return (
    <div className="space-y-1">
      {/* Hint when no phases assigned yet */}
      {!isGrouped && role === 'supervisor' && milestones.length > 0 && (
        <div className="flex items-start gap-2.5 px-3 py-2.5 mb-3 rounded-lg bg-blue-50 border border-blue-100">
          <Lock className="h-3.5 w-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700">
            Assign a <strong>research phase</strong> to each milestone so they connect to the project timeline and advance the phase bar automatically.
          </p>
        </div>
      )}

      {isGrouped ? (
        <div className="space-y-2">
          {groups.map(group => (
            <PhaseSection
              key={group.phase ?? 'general'}
              group={group}
              role={role}
              projectId={projectId}
              onSubmit={onSubmit}
              onReview={onReview}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {milestones.map(m => (
            <MilestoneCard
              key={m.id}
              milestone={m}
              role={role}
              projectId={projectId}
              onSubmit={onSubmit}
              onReview={onReview}
            />
          ))}
        </div>
      )}
    </div>
  )
}
