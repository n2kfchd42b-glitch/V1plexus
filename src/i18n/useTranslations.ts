"use client"

export { useLocale as useTranslations } from './LocaleProvider'

/**
 * Server-safe translation helper for Server Components.
 * Pass pre-loaded messages and a key; falls back to the key itself.
 */
export function getTranslation(
  messages: Record<string, string>,
  key: string,
  fallback?: string
): string {
  return messages[key] ?? fallback ?? key
}
