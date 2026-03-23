"use client"

import { Globe } from 'lucide-react'
import { SUPPORTED_LOCALES, LOCALE_NAMES, type Locale } from '@/i18n/config'
import { useTranslations } from '@/i18n/useTranslations'
import { cn } from '@/lib/utils'

interface LanguageSelectorProps {
  /** Compact mode — shows globe icon + code only (e.g. for auth page header) */
  compact?: boolean
  className?: string
}

export function LanguageSelector({ compact = false, className }: LanguageSelectorProps) {
  const { locale, setLocale } = useTranslations()

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {!compact && <Globe className="h-4 w-4 text-[var(--text-tertiary)]" />}
      <select
        value={locale}
        onChange={e => setLocale(e.target.value as Locale)}
        aria-label="Select language"
        className={cn(
          'bg-transparent border border-[var(--border-default)] rounded-md text-sm',
          'text-[var(--text-secondary)] cursor-pointer',
          'focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]',
          'transition-colors duration-150',
          compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5'
        )}
      >
        {SUPPORTED_LOCALES.map(loc => (
          <option key={loc} value={loc}>
            {compact ? loc.toUpperCase() : LOCALE_NAMES[loc]}
          </option>
        ))}
      </select>
    </div>
  )
}
