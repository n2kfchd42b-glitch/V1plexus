"use client"

import type { ResearchIntent } from '@/lib/decision-engine/types'

const INTENT_OPTIONS: {
  id: ResearchIntent
  icon: string
  title: string
  description: string
}[] = [
  {
    id: 'describe',
    icon: '📋',
    title: 'Describe my population',
    description: 'Summarise the characteristics of my study population',
  },
  {
    id: 'associate',
    icon: '🔗',
    title: 'Test a relationship',
    description: 'Is there an association between two variables?',
  },
  {
    id: 'predict',
    icon: '🎯',
    title: 'Predict an outcome',
    description: 'What factors predict or cause my outcome?',
  },
  {
    id: 'compare',
    icon: '⚖️',
    title: 'Compare groups',
    description: 'Do two or more groups differ on a measure?',
  },
  {
    id: 'survive',
    icon: '⏱️',
    title: 'Analyse time to event',
    description: 'How long until an event occurs? Survival analysis',
  },
  {
    id: 'explore',
    icon: '🔍',
    title: 'Explore patterns',
    description: 'Find clusters or patterns in my dataset',
  },
]

interface Props {
  value: ResearchIntent | null
  onChange: (intent: ResearchIntent) => void
}

export function IntentSelector({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {INTENT_OPTIONS.map(opt => {
        const isSelected = value === opt.id
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className="flex items-start gap-3 p-3 rounded-lg text-left transition-all duration-150 active:scale-[0.98]"
            style={{
              background: isSelected ? 'var(--accent-blue-subtle)' : 'var(--bg-surface)',
              border: `1px solid ${isSelected ? 'var(--accent-blue)' : 'var(--border-default)'}`,
              boxShadow: isSelected ? 'var(--shadow-focus)' : 'none',
            }}
            onMouseEnter={e => {
              if (!isSelected) {
                e.currentTarget.style.borderColor = 'var(--border-status-info)'
                e.currentTarget.style.background = 'var(--bg-surface-hover)'
              }
            }}
            onMouseLeave={e => {
              if (!isSelected) {
                e.currentTarget.style.borderColor = 'var(--border-default)'
                e.currentTarget.style.background = 'var(--bg-surface)'
              }
            }}
          >
            <span className="text-xl flex-shrink-0 mt-0.5">{opt.icon}</span>
            <div>
              <p
                className="text-xs font-semibold leading-snug"
                style={{ color: isSelected ? 'var(--accent-blue)' : 'var(--text-primary)' }}
              >
                {opt.title}
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                {opt.description}
              </p>
            </div>
          </button>
        )
      })}
    </div>
  )
}
