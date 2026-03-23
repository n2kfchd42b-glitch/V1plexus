'use client'

import { Clock } from 'lucide-react'

interface PendingSyncBadgeProps {
  size?: 'sm' | 'xs'
}

export function PendingSyncBadge({ size = 'xs' }: PendingSyncBadgeProps) {
  return (
    <span
      title="Pending sync — will upload when back online"
      className={`inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 font-medium ${
        size === 'xs' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-1'
      }`}
    >
      <Clock className={size === 'xs' ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
      Pending
    </span>
  )
}
