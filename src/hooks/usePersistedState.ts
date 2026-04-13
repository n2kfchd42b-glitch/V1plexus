'use client'

import { useState, useEffect } from 'react'

/**
 * useState backed by localStorage under the `plexus:` namespace.
 * Survives page reloads — useful for preserving analysis selections
 * when a cold-start reload interrupts a researcher's workflow.
 */
export function usePersistedState<T>(key: string, initial: T) {
  const [state, setState] = useState<T>(() => {
    if (typeof window === 'undefined') return initial
    try {
      const saved = localStorage.getItem(`plexus:${key}`)
      return saved !== null ? (JSON.parse(saved) as T) : initial
    } catch {
      return initial
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(`plexus:${key}`, JSON.stringify(state))
    } catch {
      // localStorage may be unavailable in private browsing — fail silently
    }
  }, [key, state])

  return [state, setState] as const
}
