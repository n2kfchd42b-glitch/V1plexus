'use client'

import { cn } from '@/lib/utils'

interface MetricCardProps {
  label: string
  value: string | number
  sublabel?: string
  accent?: 'blue' | 'green' | 'orange' | 'purple' | 'default'
  className?: string
}

const accentMap = {
  blue:    'text-blue-600',
  green:   'text-emerald-600',
  orange:  'text-orange-500',
  purple:  'text-purple-600',
  default: 'text-[var(--text-primary)]',
}

export function MetricCard({ label, value, sublabel, accent = 'default', className }: MetricCardProps) {
  return (
    <div className={cn(
      'flex flex-col gap-1 p-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)]',
      className
    )}>
      <p className={cn('text-2xl font-bold tracking-tight', accentMap[accent])}>
        {value}
      </p>
      <p className="text-sm font-medium text-[var(--text-primary)]">{label}</p>
      {sublabel && (
        <p className="text-xs text-[var(--text-tertiary)]">{sublabel}</p>
      )}
    </div>
  )
}
