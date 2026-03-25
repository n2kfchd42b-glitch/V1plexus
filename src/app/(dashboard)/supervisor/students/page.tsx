'use client'

import { THESIS_ENABLED } from '@/lib/flags'
import { MyStudentsPanel } from '@/components/supervisor/MyStudentsPanel'
import { Users, ClipboardList, Bell, BarChart2, MessageSquare } from 'lucide-react'

const FEATURES = [
  {
    icon: Users,
    label: 'Student Roster',
    description: 'View all your supervised students, their degree type, thesis title, and current phase at a glance.',
    color: 'text-blue-500',
    bg: 'bg-blue-50',
  },
  {
    icon: ClipboardList,
    label: 'Progress Tracking',
    description: 'Monitor chapter submissions, milestone completions, and timeline adherence for each student.',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
  },
  {
    icon: Bell,
    label: 'Early Warning System',
    description: 'Automatic alerts when a student misses a deadline or shows signs of falling behind schedule.',
    color: 'text-orange-500',
    bg: 'bg-orange-50',
  },
  {
    icon: BarChart2,
    label: 'Cohort Analytics',
    description: 'Aggregate view of your supervision load, completion rates, and average time-to-submission.',
    color: 'text-violet-500',
    bg: 'bg-violet-50',
  },
  {
    icon: MessageSquare,
    label: 'Bulk Reminders',
    description: 'Send milestone reminders to individual students or your entire cohort with a single action.',
    color: 'text-rose-500',
    bg: 'bg-rose-50',
  },
]

export default function MySupervisedStudentsPage() {
  if (THESIS_ENABLED) return <MyStudentsPanel />

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 py-16 text-center">
      <div className="h-14 w-14 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-default)] flex items-center justify-center mb-5 shadow-sm">
        <Users className="h-7 w-7 text-[var(--text-secondary)]" />
      </div>

      <span className="text-xs font-semibold bg-amber-500/15 text-amber-500 border border-amber-500/25 rounded-full px-3 py-1 mb-4">
        Phase 8 · Coming Soon
      </span>

      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-3">Supervision Dashboard</h1>
      <p className="text-sm text-[var(--text-secondary)] max-w-md leading-relaxed mb-10">
        Your student supervision workspace — track thesis progress, receive early warnings,
        and coordinate milestones for your entire supervised cohort.
        Backend deployment is scheduled for next week.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-3xl text-left">
        {FEATURES.map(f => {
          const Icon = f.icon
          return (
            <div
              key={f.label}
              className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-4"
            >
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center mb-3 ${f.bg}`}>
                <Icon className={`h-4 w-4 ${f.color}`} />
              </div>
              <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">{f.label}</p>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{f.description}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
