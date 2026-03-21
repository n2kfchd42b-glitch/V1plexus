"use client"

import { LayoutList, LayoutGrid, Columns, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ViewMode = 'table' | 'cards' | 'kanban' | 'timeline'

const views: { mode: ViewMode; icon: React.ComponentType<{ className?: string }>; label: string }[] = [
  { mode: 'table',    icon: LayoutList, label: 'Table' },
  { mode: 'cards',    icon: LayoutGrid, label: 'Cards' },
  { mode: 'kanban',   icon: Columns,    label: 'Kanban' },
  { mode: 'timeline', icon: Calendar,   label: 'Timeline' },
]

interface ViewToggleProps {
  value: ViewMode
  onChange: (mode: ViewMode) => void
  available?: ViewMode[]
}

export function ViewToggle({ value, onChange, available = ['table', 'cards', 'kanban'] }: ViewToggleProps) {
  return (
    <div className="flex items-center gap-0.5 bg-[var(--bg-inset)] rounded-md p-0.5">
      {views
        .filter(v => available.includes(v.mode))
        .map(({ mode, icon: Icon, label }) => (
          <button
            key={mode}
            onClick={() => onChange(mode)}
            title={label}
            className={cn(
              'flex items-center justify-center h-6 w-6 rounded transition-all duration-100',
              value === mode
                ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        ))}
    </div>
  )
}
