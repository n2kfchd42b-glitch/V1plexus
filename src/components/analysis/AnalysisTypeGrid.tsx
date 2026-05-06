"use client"

import { ANALYSIS_REGISTRY, ANALYSIS_CATEGORIES } from '@/lib/decision-engine/analysisRegistry'
import type { AnalysisTypeId, AnalysisCategory } from '@/lib/decision-engine/types'
import { useLocale } from '@/i18n/LocaleProvider'

const MOST_COMMON: AnalysisTypeId[] = ['logistic_regression', 'kaplan_meier']

interface Props {
  selectedType: AnalysisTypeId | null
  onSelect: (type: AnalysisTypeId) => void
}

export function AnalysisTypeGrid({ selectedType, onSelect }: Props) {
  const { t } = useLocale()
  // Group types by category
  const byCategory: Record<AnalysisCategory, AnalysisTypeId[]> = {
    descriptive: [],
    regression: [],
    survival: [],
    comparative: [],
    correlation: [],
  }

  for (const [id, meta] of Object.entries(ANALYSIS_REGISTRY)) {
    byCategory[meta.category].push(id as AnalysisTypeId)
  }

  return (
    <div className="space-y-5">
      {ANALYSIS_CATEGORIES.map(cat => (
        <div key={cat.id}>
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-2"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {t(`analysisGrid.cat.${cat.id}`)}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {byCategory[cat.id].map(typeId => {
              const meta = ANALYSIS_REGISTRY[typeId]
              const isSelected = selectedType === typeId
              const isMostCommon = MOST_COMMON.includes(typeId)
              return (
                <button
                  key={typeId}
                  onClick={() => onSelect(typeId)}
                  className="relative text-left p-3 rounded-lg transition-all duration-150 active:scale-[0.97]"
                  style={{
                    background: isSelected ? 'var(--accent-blue-subtle)' : 'var(--bg-surface)',
                    border: `1px solid ${isSelected ? 'var(--accent-blue)' : 'var(--border-default)'}`,
                    boxShadow: isSelected ? 'var(--shadow-focus)' : 'var(--shadow-xs)',
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
                  {isMostCommon && (
                    <span
                      className="absolute top-1.5 right-1.5 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide"
                      style={{
                        background: 'var(--accent-blue-subtle)',
                        color: 'var(--accent-blue)',
                        border: '1px solid var(--border-status-info)',
                      }}
                    >
                      {t('analysisGrid.popular')}
                    </span>
                  )}
                  <span className="text-lg block mb-1">{meta.icon}</span>
                  <p
                    className="text-xs font-semibold leading-snug mb-0.5"
                    style={{
                      color: isSelected ? 'var(--accent-blue)' : 'var(--text-primary)',
                    }}
                  >
                    {meta.name}
                  </p>
                  <p
                    className="text-[11px] leading-snug"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {meta.short_description}
                  </p>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
