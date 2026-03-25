'use client'

import { THESIS_ENABLED } from '@/lib/flags'
import { MySupervisorPanel } from '@/components/supervisor/MySupervisorPanel'
import { UserCheck, CalendarCheck, MessageCircle, FileSearch, Award } from 'lucide-react'

const FEATURES = [
  {
    icon: UserCheck,
    label: 'Supervisor Profile',
    description: "View your supervisor's expertise, availability, and contact details in one place.",
    color: 'text-blue-500',
    bg: 'bg-blue-50',
  },
  {
    icon: CalendarCheck,
    label: 'Meeting Scheduler',
    description: 'Request supervision sessions and track meeting history and agreed action points.',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
  },
  {
    icon: FileSearch,
    label: 'Feedback Inbox',
    description: 'Receive structured chapter feedback from your supervisor with inline comments and action items.',
    color: 'text-violet-500',
    bg: 'bg-violet-50',
  },
  {
    icon: MessageCircle,
    label: 'Direct Messaging',
    description: 'Communicate directly with your supervisor through the platform — all in one thread.',
    color: 'text-orange-500',
    bg: 'bg-orange-50',
  },
  {
    icon: Award,
    label: 'Milestone Sign-off',
    description: "Request approval for completed milestones and track your supervisor's formal sign-offs.",
    color: 'text-rose-500',
    bg: 'bg-rose-50',
  },
]

export default function MySupervisorPage() {
  if (THESIS_ENABLED) return <MySupervisorPanel />

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 py-16 text-center">
      <div className="h-14 w-14 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-default)] flex items-center justify-center mb-5 shadow-sm">
        <UserCheck className="h-7 w-7 text-[var(--text-secondary)]" />
      </div>

      <span className="text-xs font-semibold bg-amber-500/15 text-amber-500 border border-amber-500/25 rounded-full px-3 py-1 mb-4">
        Phase 8 · Coming Soon
      </span>

      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-3">My Supervisor</h1>
      <p className="text-sm text-[var(--text-secondary)] max-w-md leading-relaxed mb-10">
        Your dedicated supervisor workspace — schedule meetings, receive chapter feedback,
        and track milestone sign-offs throughout your thesis journey.
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
