/**
 * i18n Configuration — Phase 12 Multi-Language Interface
 *
 * Supported locales: English, French, Spanish
 * Default locale: English
 *
 * Usage:
 *   import { useI18n, t } from '@/i18n/config'
 *
 * Note: Full next-intl middleware integration is scaffolded here.
 * Enable via NETWORK_COMPLIANCE_ENABLED flag when ready to deploy.
 */

export const SUPPORTED_LOCALES = ['en', 'fr', 'es'] as const
export type Locale = typeof SUPPORTED_LOCALES[number]

export const DEFAULT_LOCALE: Locale = 'en'

export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  fr: 'Français',
  es: 'Español',
}

export const LOCALE_FLAGS: Record<Locale, string> = {
  en: '🇬🇧',
  fr: '🇫🇷',
  es: '🇪🇸',
}

export function isValidLocale(locale: string): locale is Locale {
  return SUPPORTED_LOCALES.includes(locale as Locale)
}
