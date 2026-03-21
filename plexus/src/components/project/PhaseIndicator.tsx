import { CheckCircle2, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ACTIVE_PHASES, PROJECT_PHASES } from '@/lib/constants'
import type { ProjectPhase } from '@/types/app'

interface PhaseIndicatorProps {
  currentPhase: ProjectPhase
  compact?: boolean
}

export function PhaseIndicator({ currentPhase, compact = false }: PhaseIndicatorProps) {
  const phases = PROJECT_PHASES.filter((p) => p.value !== 'archived')
  const currentIndex = ACTIVE_PHASES.indexOf(currentPhase)

  if (compact) {
    return (
      <div className="space-y-1">
        {phases.map(({ value, label }, index) => {
          const isCurrent = value === currentPhase
          const isDone = currentIndex > index
          return (
            <div
              key={value}
              className={cn(
                'flex items-center gap-2 text-xs py-0.5',
                isCurrent ? 'text-[#2E75B6] font-medium' : isDone ? 'text-[#718096]' : 'text-[#A0AEC0]'
              )}
            >
              {isDone ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
              ) : isCurrent ? (
                <Circle className="h-3.5 w-3.5 fill-[#2E75B6] text-[#2E75B6] shrink-0" />
              ) : (
                <Circle className="h-3.5 w-3.5 shrink-0" />
              )}
              {label}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {phases.map(({ value, label }, index) => {
        const isCurrent = value === currentPhase
        const isDone = currentIndex > index
        const isLast = index === phases.length - 1

        return (
          <div key={value} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'h-6 w-6 rounded-full flex items-center justify-center border-2 shrink-0 text-xs font-bold',
                  isDone
                    ? 'bg-green-500 border-green-500 text-white'
                    : isCurrent
                    ? 'bg-[#2E75B6] border-[#2E75B6] text-white'
                    : 'border-[#E2E8F0] text-[#A0AEC0] bg-white'
                )}
              >
                {isDone ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
              </div>
              {!isLast && (
                <div
                  className={cn(
                    'w-0.5 h-6 mt-1',
                    isDone ? 'bg-green-500' : 'bg-[#E2E8F0]'
                  )}
                />
              )}
            </div>
            <div className="pt-0.5">
              <span
                className={cn(
                  'text-sm font-medium',
                  isCurrent ? 'text-[#2E75B6]' : isDone ? 'text-[#718096]' : 'text-[#A0AEC0]'
                )}
              >
                {label}
              </span>
              {isCurrent && (
                <span className="ml-2 text-xs bg-[#D5E8F0] text-[#2E75B6] px-1.5 py-0.5 rounded">
                  Current
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
