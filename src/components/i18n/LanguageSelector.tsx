"use client"

import { SUPPORTED_LOCALES, LOCALE_FLAGS, LOCALE_NAMES, type Locale } from '@/i18n/config'
import { useTranslations } from '@/i18n/useTranslations'
import { cn } from '@/lib/utils'

interface LanguageSelectorProps {
  compact?: boolean
  className?: string
}

export function LanguageSelector({ className }: LanguageSelectorProps) {
  const { locale, setLocale } = useTranslations()

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {SUPPORTED_LOCALES.map(loc => (
        <button
          key={loc}
          type="button"
          onClick={() => setLocale(loc as Locale)}
          aria-label={LOCALE_NAMES[loc as Locale]}
          title={LOCALE_NAMES[loc as Locale]}
          className={cn(
            'text-lg leading-none rounded transition-all duration-150 px-1 py-0.5',
            locale === loc
              ? 'opacity-100 scale-110'
              : 'opacity-40 hover:opacity-75'
          )}
        >
          {LOCALE_FLAGS[loc as Locale]}
        </button>
      ))}
    </div>
  )
}
