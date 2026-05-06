'use client'

import { useTranslations } from '@/i18n/useTranslations'

export function DocumentsEmptyHint() {
  const { t } = useTranslations()
  return (
    <>
      <p className="text-sm font-medium text-text-secondary">{t('documents.noDocuments')}</p>
      <p className="text-xs text-text-tertiary max-w-[200px]">
        {t('documents.createFirst')}
      </p>
    </>
  )
}
