'use client'

import { useTranslations } from '@/i18n/useTranslations'

export function TimelinePageHeader() {
  const { t } = useTranslations()
  return (
    <div className="px-6 pt-6 pb-4 flex-shrink-0">
      <h1 className="page-title">{t('timeline.title')}</h1>
      <p className="text-xs text-[var(--text-tertiary)] mt-1">
        {t('timeline.subtitle')}
      </p>
    </div>
  )
}
