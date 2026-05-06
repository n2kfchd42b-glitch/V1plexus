"use client"

import { Database, Compass, Zap } from 'lucide-react'
import { useLocale } from '@/i18n/LocaleProvider'

interface EntryDataset {
  id: string
  name: string
  source: string
  row_count: number
  version_id: string
}

interface Props {
  dataset: EntryDataset
  onGuided: () => void
  onDirect: () => void
}

export function AnalysisEntryPoint({ dataset, onGuided, onDirect }: Props) {
  const { t } = useLocale()
  return (
    <div className="flex flex-col h-full items-center justify-center px-6 py-10">

      {/* Dataset pill */}
      <div
        className="flex items-center gap-2 px-3 py-1.5 rounded-full mb-8"
        style={{
          background: 'var(--accent-blue-subtle)',
          border: '1px solid var(--border-status-info)',
        }}
      >
        <Database className="h-3.5 w-3.5" style={{ color: 'var(--accent-blue)' }} />
        <span className="text-xs font-semibold" style={{ color: 'var(--accent-blue)' }}>
          {dataset.name}
        </span>
        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          ·
        </span>
        <span
          className="text-xs font-mono tabular-nums"
          style={{ color: 'var(--text-secondary)' }}
        >
          {dataset.row_count.toLocaleString()} rows
        </span>
      </div>

      {/* Heading */}
      <h2
        className="text-xl font-bold tracking-tight text-center mb-1"
        style={{ fontFamily: 'var(--font-manrope)', color: 'var(--text-primary)' }}
      >
        {t('entryPoint.howToProceed')}
      </h2>
      <p className="text-sm text-center mb-8" style={{ color: 'var(--text-secondary)' }}>
        {t('entryPoint.bothPaths')}
      </p>

      {/* Cards */}
      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-2xl">

        {/* Card A — Guide me */}
        <button
          onClick={onGuided}
          className="flex-1 text-left rounded-xl overflow-hidden transition-all duration-150 active:scale-[0.98] group"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            boxShadow: 'var(--shadow-xs)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.boxShadow = 'var(--shadow-md)'
            e.currentTarget.style.borderColor = 'var(--border-status-info)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.boxShadow = 'var(--shadow-xs)'
            e.currentTarget.style.borderColor = 'var(--border-default)'
          }}
        >
          {/* Top accent bar */}
          <div
            className="h-1 w-full"
            style={{ background: 'linear-gradient(90deg,var(--color-clinical-deep),var(--color-clinical-blue))' }}
          />
          <div className="p-5">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
              style={{ background: 'var(--accent-blue-subtle)' }}
            >
              <Compass className="h-4.5 w-4.5" style={{ color: 'var(--accent-blue)' }} />
            </div>
            <h3
              className="text-sm font-bold mb-1 tracking-tight"
              style={{ fontFamily: 'var(--font-manrope)', color: 'var(--text-primary)' }}
            >
              {t('entryPoint.guideTitle')}
            </h3>
            <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>
              {t('entryPoint.guideDesc')}
            </p>
            {/* Audience tags */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {[t('entryPoint.audienceMPH'), t('entryPoint.audienceEarlyCareer'), t('entryPoint.audienceField')].map(tag => (
                <span
                  key={tag}
                  className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                  style={{
                    background: 'var(--accent-blue-subtle)',
                    color: 'var(--accent-blue)',
                    border: '1px solid var(--border-status-info)',
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
            <div
              className="w-full py-2 rounded-lg text-xs font-bold text-center transition-colors"
              style={{
                background: 'linear-gradient(135deg,var(--color-clinical-deep),var(--color-clinical-blue))',
                color: '#fff',
              }}
            >
              {t('entryPoint.startGuided')}
            </div>
          </div>
        </button>

        {/* Card B — Choose directly */}
        <button
          onClick={onDirect}
          className="flex-1 text-left rounded-xl overflow-hidden transition-all duration-150 active:scale-[0.98] group"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            boxShadow: 'var(--shadow-xs)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.boxShadow = 'var(--shadow-md)'
            e.currentTarget.style.borderColor = 'var(--border-status-success)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.boxShadow = 'var(--shadow-xs)'
            e.currentTarget.style.borderColor = 'var(--border-default)'
          }}
        >
          {/* Top accent bar */}
          <div
            className="h-1 w-full"
            style={{ background: 'var(--phase-writing)' }}
          />
          <div className="p-5">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
              style={{ background: 'var(--bg-inset)' }}
            >
              <Zap className="h-4.5 w-4.5" style={{ color: 'var(--phase-writing)' }} />
            </div>
            <h3
              className="text-sm font-bold mb-1 tracking-tight"
              style={{ fontFamily: 'var(--font-manrope)', color: 'var(--text-primary)' }}
            >
              {t('entryPoint.directTitle')}
            </h3>
            <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>
              {t('entryPoint.directDesc')}
            </p>
            {/* Audience tags */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {[t('entryPoint.audienceBiostat'), t('entryPoint.audiencePhD'), t('entryPoint.audienceExperienced')].map(tag => (
                <span
                  key={tag}
                  className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                  style={{
                    background: 'var(--bg-inset)',
                    color: 'var(--phase-writing)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
            <div
              className="w-full py-2 rounded-lg text-xs font-bold text-center transition-colors"
              style={{
                background: 'var(--phase-writing)',
                color: '#fff',
              }}
            >
              {t('entryPoint.selectAnalysis')}
            </div>
          </div>
        </button>
      </div>

      {/* Footer note */}
      <p className="text-xs mt-6 text-center" style={{ color: 'var(--text-tertiary)' }}>
        {t('entryPoint.bothSameEngine')}
      </p>
    </div>
  )
}
