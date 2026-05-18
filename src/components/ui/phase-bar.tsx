import { cn } from '@/lib/utils'

export type ResearchPhase =
  | 'concept' | 'protocol' | 'ethics' | 'data'
  | 'analysis' | 'writing' | 'publication'

const PHASE_ORDER: ResearchPhase[] = [
  'concept', 'protocol', 'ethics', 'data', 'analysis', 'writing', 'publication',
]

const PHASE_COLORS: Record<ResearchPhase, string> = {
  concept:     '#A1A1AA',
  protocol:    '#3B82F6',
  ethics:      '#F59E0B',
  data:        '#8B5CF6',
  analysis:    '#EC4899',
  writing:     '#14B8A6',
  publication: '#22C55E',
}

const PHASE_LABELS: Record<ResearchPhase, string> = {
  concept:     'Concept',
  protocol:    'Protocol',
  ethics:      'Ethics',
  data:        'Data',
  analysis:    'Analysis',
  writing:     'Writing',
  publication: 'Publication',
}

interface PhaseBarProps {
  phase: string
  showLabels?: boolean
  height?: number
  className?: string
}

export function PhaseBar({ phase, showLabels = false, height = 6, className }: PhaseBarProps) {
  const idx = PHASE_ORDER.indexOf(phase as ResearchPhase)
  return (
    <div className={cn('w-full', className)}>
      <div className="flex gap-0.5" style={{ height }}>
        {PHASE_ORDER.map((p, i) => (
          <div
            key={p}
            className="flex-1 rounded-sm"
            style={{
              background: i <= idx ? PHASE_COLORS[p] : '#E4E4E7',
              opacity: i < idx ? 0.35 : 1,
            }}
          />
        ))}
      </div>
      {showLabels && (
        <div className="flex gap-0.5 mt-1">
          {PHASE_ORDER.map((p, i) => (
            <div key={p} className="flex-1">
              <span className={cn(
                'text-[9px] font-medium',
                i === idx ? 'text-text-primary font-semibold' : 'text-text-tertiary'
              )}>
                {p[0].toUpperCase() + p.slice(1, 3)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface PhasePillProps {
  phase: string
  dim?: boolean
  className?: string
}

export function PhasePill({ phase, dim, className }: PhasePillProps) {
  const color = PHASE_COLORS[phase as ResearchPhase] ?? '#A1A1AA'
  const label = PHASE_LABELS[phase as ResearchPhase] ?? phase

  if (dim) {
    return (
      <span className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium',
        'bg-bg-surface-active text-text-secondary border border-border-default',
        className
      )}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
        {label}
      </span>
    )
  }

  return (
    <span
      className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border', className)}
      style={{
        background: `${color}1a`,
        color,
        borderColor: `${color}4d`,
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  )
}

export { PHASE_ORDER, PHASE_COLORS, PHASE_LABELS }
