'use client'

import { AlertTriangle, Info, CheckCircle } from 'lucide-react'
import { cn, formatDate, daysUntil } from '@/lib/utils'

interface DeadlineItem {
  reportTitle: string
  grantTitle: string
  funder: string
  dueDate: string
  grantId: string
}

interface ReportingTimelineProps {
  deadlines?: DeadlineItem[]
}

const SAMPLE: DeadlineItem[] = [
  {
    reportTitle: 'Year 2 Progress Report',
    grantTitle: 'Malaria Prevention in Northern Ghana',
    funder: 'Wellcome Trust',
    dueDate: '2026-04-15',
    grantId: 'sample-1',
  },
  {
    reportTitle: 'Annual Report',
    grantTitle: 'Nutrition Intervention Scale-Up',
    funder: 'Gates Foundation',
    dueDate: '2026-06-30',
    grantId: 'sample-2',
  },
]

export function ReportingTimeline({ deadlines }: ReportingTimelineProps) {
  const items = deadlines ?? SAMPLE

  if (items.length === 0) {
    return (
      <div className="flex items-center gap-2 py-3 px-4 rounded-xl bg-[var(--bg-inset)] text-xs text-[var(--text-tertiary)]">
        <CheckCircle className="h-4 w-4 text-emerald-500" />
        No upcoming report deadlines.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {items.map((item, i) => {
        const days = daysUntil(item.dueDate) ?? 0
        const isUrgent = days <= 30
        return (
          <div
            key={i}
            className={cn(
              'flex items-start gap-3 px-4 py-3 rounded-xl border text-sm',
              isUrgent
                ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800'
                : 'bg-[var(--bg-surface)] border-[var(--border-default)]'
            )}
          >
            {isUrgent ? (
              <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
            ) : (
              <Info className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-[var(--text-primary)] leading-snug">
                {item.reportTitle}
                <span className="font-normal text-[var(--text-tertiary)] ml-1.5">— {item.funder}</span>
              </p>
              <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                {item.grantTitle} · due {formatDate(item.dueDate)}
                {days >= 0 && <span className="ml-1 font-medium">{days === 0 ? '(today)' : `(in ${days} days)`}</span>}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
