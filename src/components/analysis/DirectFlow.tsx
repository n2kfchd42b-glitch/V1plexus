"use client"

import { ArrowLeft, Compass, Play } from 'lucide-react'
import { useLocale } from '@/i18n/LocaleProvider'
import { AnalysisTypeGrid } from './AnalysisTypeGrid'
import { ANALYSIS_REGISTRY } from '@/lib/decision-engine/analysisRegistry'
import type { AnalysisTypeId, DatasetContext } from '@/lib/decision-engine/types'

interface Props {
  dataset: DatasetContext
  selectedType: AnalysisTypeId | null
  onSelectType: (type: AnalysisTypeId) => void
  canRun: boolean
  onRun: () => void
  onSwitchToGuided: () => void
  onBack: () => void
}

export function DirectFlow({ dataset, selectedType, onSelectType, canRun, onRun, onSwitchToGuided, onBack }: Props) {
  const { t } = useLocale()
  const meta = selectedType ? ANALYSIS_REGISTRY[selectedType] : null

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
        style={{ borderColor: 'var(--border-row)', background: 'var(--bg-surface)' }}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="h-7 w-7 flex items-center justify-center rounded-md transition-colors"
            style={{ color: 'var(--text-tertiary)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-row-hover)'; e.currentTarget.style.color = 'var(--text-primary)' }}
            onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'var(--text-tertiary)' }}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('directFlow.title')}</span>
        </div>
        <button
          onClick={onSwitchToGuided}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors"
          style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-row-hover)' }}
          onMouseLeave={e => { e.currentTarget.style.background = '' }}
        >
          <Compass className="h-3.5 w-3.5" />
          {t('directFlow.guideMe')}
        </button>
      </div>

      {/* Type grid */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <p className="subsection-label mb-2">{t('directFlow.analysisType')}</p>
        <AnalysisTypeGrid selectedType={selectedType} onSelect={onSelectType} />
        {selectedType && meta && (
          <div className="mt-4 px-3 py-2.5 rounded-lg" style={{ background: 'var(--bg-app)', border: '1px solid var(--border-subtle)' }}>
            <p className="text-xs font-semibold mb-0.5" style={{ color: 'var(--text-primary)' }}>{meta.icon} {meta.name}</p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{meta.when_to_use}</p>
            <p className="text-[11px] mt-2 rounded px-2 py-1" style={{ background: 'var(--accent-blue-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border-status-info)' }}>
              {meta.reporting_guideline} {t('directFlow.reportingNote')}
            </p>
          </div>
        )}
      </div>

      {/* Footer run bar */}
      {selectedType && (
        <div
          className="flex-shrink-0 px-4 py-3 border-t flex items-center gap-3"
          style={{ borderColor: 'var(--border-row)', background: 'var(--bg-surface)' }}
        >
          <div className="flex-1 min-w-0">
            <p className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>
              {meta?.name} · {dataset.dataset_name}
            </p>
          </div>
          <button
            onClick={onRun}
            disabled={!canRun}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-all"
            style={{ background: 'linear-gradient(135deg,var(--color-clinical-deep),var(--color-clinical-blue))' }}
          >
            <Play className="h-3 w-3" />
            {t('directFlow.runAnalysis')}
          </button>
        </div>
      )}
    </div>
  )
}
