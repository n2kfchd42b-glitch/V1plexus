"use client"

import {
  createContext, useContext, useState, useLayoutEffect,
  useCallback, useMemo, type ReactNode,
} from 'react'
import { DEFAULT_LOCALE, type Locale, isValidLocale } from './config'

// Static imports — all three files bundled upfront (each ~15 KB).
// This eliminates async loading entirely so the correct locale is available
// on the very first render with no flash of English.
import enMessages from '../messages/en.json'
import frMessages from '../messages/fr.json'
import esMessages from '../messages/es.json'

type Messages = Record<string, string>

const MESSAGE_MAP: Record<Locale, Messages> = {
  en: enMessages as Messages,
  fr: frMessages as Messages,
  es: esMessages as Messages,
}

interface LocaleContextValue {
  locale: Locale
  messages: Messages
  setLocale: (locale: Locale) => void
  t: (key: string, fallback?: string) => string
}

const LocaleContext = createContext<LocaleContextValue>({
  locale:    DEFAULT_LOCALE,
  messages:  MESSAGE_MAP[DEFAULT_LOCALE],
  setLocale: () => {},
  t:         (key, fallback) => fallback ?? key,
})

export function LocaleProvider({ children }: { children: ReactNode }) {
  // SSR-safe initial state: default locale / default messages.
  // useLayoutEffect (runs before paint) corrects to the stored locale
  // synchronously, so the user never sees a flash of English.
  const [locale,   setLocaleState] = useState<Locale>(DEFAULT_LOCALE)
  const [messages, setMessages]    = useState<Messages>(MESSAGE_MAP[DEFAULT_LOCALE])

  useLayoutEffect(() => {
    const stored   = localStorage.getItem('plexus_locale')
    const resolved = stored && isValidLocale(stored) ? stored : DEFAULT_LOCALE
    if (resolved !== DEFAULT_LOCALE) {
      setLocaleState(resolved)
      setMessages(MESSAGE_MAP[resolved])
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const setLocale = useCallback((newLocale: Locale) => {
    localStorage.setItem('plexus_locale', newLocale)
    setLocaleState(newLocale)
    setMessages(MESSAGE_MAP[newLocale])
  }, [])

  const t = useCallback(
    (key: string, fallback?: string) => messages[key] ?? fallback ?? key,
    [messages],
  )

  const value = useMemo(
    () => ({ locale, messages, setLocale, t }),
    [locale, messages, setLocale, t],
  )

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale() {
  return useContext(LocaleContext)
}
