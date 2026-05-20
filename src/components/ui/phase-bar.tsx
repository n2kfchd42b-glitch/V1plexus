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

// Maps project_phases.phase_key → ResearchPhase (data_collection → data)
const PHASE_KEY_MAP: Record<string, ResearchPhase> = {
  concept: 'concept', protocol: 'protocol', ethics: 'ethics',
  data_collection: 'data', data: 'data',
  analysis: 'analysis', writing: 'writing', publication: 'publication',
}

export interface PhaseDate {
  start_date: string | null
  end_date: string | null
  completed_at: string | null
}

function fmtShort(iso: string): string {
  const [, m, d] = iso.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[parseInt(m) - 1]} ${parseInt(d)}`
}

interface PhaseBarProps {
  phase: string
  showLabels?: boolean
  height?: number
  className?: string
  // keyed by project_phases.phase_key (e.g. 'data_collection') or ResearchPhase
  phaseDates?: Record<string, PhaseDate>
}

export function PhaseBar({ phase, showLabels = false, height = 6, className, phaseDates }: PhaseBarProps) {
  const normalised = (PHASE_KEY_MAP[phase] ?? phase) as ResearchPhase
  const idx = PHASE_ORDER.indexOf(normalised)
  return (
    <div className={cn('w-full', className)}>
      <div className="flex gap-0.5" style={{ height }}>
        {PHASE_ORDER.map((p, i) => {
          // Find matching date entry (could be keyed as 'data_collection' or 'data')
          const dateEntry = phaseDates
            ? (phaseDates[p] ?? phaseDates[Object.keys(phaseDates).find(k => PHASE_KEY_MAP[k] === p) ?? ''])
            : undefined
          const tooltip = dateEntry?.start_date && dateEntry?.end_date
            ? `${PHASE_LABELS[p]}: ${fmtShort(dateEntry.start_date)} → ${fmtShort(dateEntry.end_date)}${dateEntry.completed_at ? ' ✓' : ''}`
            : PHASE_LABELS[p]
          return (
            <div
              key={p}
              className="flex-1 rounded-sm"
              title={tooltip}
              style={{
                background: i <= idx ? PHASE_COLORS[p] : '#E4E4E7',
                opacity: i < idx ? 0.35 : 1,
                cursor: phaseDates ? 'default' : undefined,
              }}
            />
          )
        })}
      </div>
      {showLabels && (
        <div className="flex gap-0.5 mt-1">
          {PHASE_ORDER.map((p, i) => {
            const dateEntry = phaseDates
              ? (phaseDates[p] ?? phaseDates[Object.keys(phaseDates).find(k => PHASE_KEY_MAP[k] === p) ?? ''])
              : undefined
            const hasDate = dateEntry?.start_date && dateEntry?.end_date
            return (
              <div key={p} className="flex-1 min-w-0">
                <span className={cn(
                  'text-[9px] font-medium block',
                  i === idx ? 'text-text-primary font-semibold' : 'text-text-tertiary'
                )}>
                  {PHASE_LABELS[p].slice(0, 3)}
                </span>
                {hasDate && (
                  <span className="text-[8px] text-text-tertiary block leading-tight truncate font-mono">
                    {fmtShort(dateEntry!.start_date!)}
                  </span>
                )}
              </div>
            )
          })}
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
