import { cn } from '@/lib/utils'
import { STATUS_COLORS, PHASE_COLORS, MILESTONE_STATUS_COLORS } from '@/lib/constants'
import type { ProjectStatus, ProjectPhase, MilestoneStatus } from '@/types/app'

const PHASE_LABELS: Record<ProjectPhase, string> = {
  concept: 'Concept',
  protocol: 'Protocol',
  ethics_review: 'Ethics Review',
  data_collection: 'Data Collection',
  analysis: 'Analysis',
  writing: 'Writing',
  publication: 'Publication',
  archived: 'Archived',
}

const STATUS_LABELS: Record<ProjectStatus, string> = {
  active: 'Active',
  paused: 'Paused',
  completed: 'Completed',
  archived: 'Archived',
}

const MILESTONE_LABELS: Record<MilestoneStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  overdue: 'Overdue',
}

interface StatusBadgeProps {
  type: 'status' | 'phase' | 'milestone'
  value: ProjectStatus | ProjectPhase | MilestoneStatus
  className?: string
}

export function StatusBadge({ type, value, className }: StatusBadgeProps) {
  let colorClass = ''
  let label = ''

  if (type === 'status') {
    colorClass = STATUS_COLORS[value as ProjectStatus] ?? 'bg-gray-100 text-gray-600'
    label = STATUS_LABELS[value as ProjectStatus] ?? value
  } else if (type === 'phase') {
    colorClass = PHASE_COLORS[value as ProjectPhase] ?? 'bg-gray-100 text-gray-600'
    label = PHASE_LABELS[value as ProjectPhase] ?? value
  } else {
    colorClass = MILESTONE_STATUS_COLORS[value as MilestoneStatus] ?? 'bg-gray-100 text-gray-600'
    label = MILESTONE_LABELS[value as MilestoneStatus] ?? value
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-medium',
        colorClass,
        className
      )}
    >
      {label}
    </span>
  )
}
