"use client"

import type { ResearchIntent } from '@/lib/decision-engine/types'
import { useLocale } from '@/i18n/LocaleProvider'

const INTENT_IDS: { id: ResearchIntent; icon: string }[] = [
  { id: 'describe',   icon: '📋' },
  { id: 'associate',  icon: '🔗' },
  { id: 'predict',    icon: '🎯' },
  { id: 'compare',    icon: '⚖️' },
  { id: 'survive',    icon: '⏱️' },
  { id: 'explore',    icon: '🔍' },
]

interface Props {
  value: ResearchIntent | null
  onChange: (intent: ResearchIntent) => void
}

export function IntentSelector({ value, onChange }: Props) {
  const { t } = useLocale()
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {INTENT_IDS.map(opt => {
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
                {t(`intentSelector.${opt.id}.title`)}
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                {t(`intentSelector.${opt.id}.desc`)}
              </p>
            </div>
          </button>
        )
      })}
    </div>
  )
}
