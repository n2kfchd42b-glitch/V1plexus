"use client"

import { cn } from '@/lib/utils'
import type { AnalysisEngine } from '@/types/database'

interface EngineSelectorProps {
  value: AnalysisEngine
  onChange: (engine: AnalysisEngine) => void
  disabled?: boolean
}

export function EngineSelector({ value, onChange, disabled }: EngineSelectorProps) {
  return (
    <div className="flex items-center border rounded-md overflow-hidden text-sm">
      {(['r', 'python'] as AnalysisEngine[]).map(engine => (
        <button
          key={engine}
          onClick={() => onChange(engine)}
          disabled={disabled}
          className={cn(
            'px-3 py-1.5 font-medium transition-colors',
            value === engine
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-muted text-muted-foreground',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          {engine === 'r' ? 'R' : 'Python'}
        </button>
      ))}
    </div>
  )
}
