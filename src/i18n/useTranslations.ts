"use client"

/**
 * Lightweight translation hook for Phase 12.
 * Reads locale from localStorage (user preference) and returns translated strings.
 * Falls back to English for any missing keys.
 *
 * When next-intl is fully configured, replace this with next-intl's useTranslations().
 */

import { useState, useEffect, useCallback } from 'react'
import { DEFAULT_LOCALE, type Locale, isValidLocale } from './config'

type Messages = Record<string, string>

const messageCache: Partial<Record<Locale, Messages>> = {}

async function loadMessages(locale: Locale): Promise<Messages> {
  if (messageCache[locale]) return messageCache[locale]!
  try {
    const messages = await import(`../messages/${locale}.json`)
    messageCache[locale] = messages.default
    return messages.default
  } catch {
    // Fallback to English
    if (locale !== DEFAULT_LOCALE) return loadMessages(DEFAULT_LOCALE)
    return {}
  }
}

export function useTranslations() {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE)
  const [messages, setMessages] = useState<Messages>({})

  useEffect(() => {
    const stored = typeof window !== 'undefined'
      ? localStorage.getItem('plexus_locale')
      : null
    const resolved = stored && isValidLocale(stored) ? stored : DEFAULT_LOCALE
    setLocaleState(resolved)
    loadMessages(resolved).then(setMessages)
  }, [])

  const setLocale = useCallback((newLocale: Locale) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('plexus_locale', newLocale)
    }
    setLocaleState(newLocale)
    loadMessages(newLocale).then(setMessages)
  }, [])

  const t = useCallback((key: string, fallback?: string): string => {
    return messages[key] ?? fallback ?? key
  }, [messages])

  return { t, locale, setLocale }
}

/**
 * Server-safe translation helper. Reads from the en.json file directly.
 * Use in Server Components or when hooks are not available.
 */
export function getTranslation(messages: Messages, key: string, fallback?: string): string {
  return messages[key] ?? fallback ?? key
}
