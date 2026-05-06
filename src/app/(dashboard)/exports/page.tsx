"use client"

import { Download } from 'lucide-react'
import { useLocale } from '@/i18n/LocaleProvider'

export default function ExportsPage() {
  const { t } = useLocale()
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Download className="h-5 w-5 text-[var(--text-secondary)]" />
          <h1 className="text-xl font-semibold font-manrope tracking-tight text-[var(--text-primary)]">{t('exports.title')}</h1>
        </div>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          {t('exports.subtitle')}
        </p>
      </div>

      <div className="empty-state">
        <Download className="empty-state-icon" />
        <p className="empty-state-title">{t('exports.emptyTitle')}</p>
        <p className="empty-state-description">
          {t('exports.emptyDesc')}
        </p>
      </div>
    </div>
  )
}
