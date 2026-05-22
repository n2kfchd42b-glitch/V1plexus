'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  generateSessionKey,
  loadSessionKey,
  clearSessionKey,
  isSessionKeyValid,
  writeLedgerEvent,
  type StoredSessionKey,
} from '@/lib/ledger/keyManager'

type KeyState = 'idle' | 'active' | 'expired' | 'busy' | 'error'

interface UseLedgerKeyReturn {
  keyState: KeyState
  sessionKey: StoredSessionKey | null
  error: string | null
  isUnlocked: boolean
  setup: (passphrase: string, ttlHours?: number) => Promise<void>
  unlock: (passphrase: string) => void
  revoke: () => void
  /**
   * Fire-and-forget ledger event. Returns false silently if no session key is
   * active or the key is not unlocked — so callers don't need to guard.
   */
  trySign: (
    eventType: string,
    payload: Record<string, unknown>,
    actorId: string,
    actorRole?: string,
  ) => void
  sign: (
    eventType: string,
    payload: Record<string, unknown>,
    actorId: string,
    actorRole: string,
    passphrase: string,
  ) => Promise<{ id: string; sequence_number: number }>
}

export function useLedgerKey(projectId: string | undefined): UseLedgerKeyReturn {
  const [keyState, setKeyState] = useState<KeyState>('idle')
  const [sessionKey, setSessionKey] = useState<StoredSessionKey | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Passphrase cached in memory for the component lifetime — never persisted
  const passphraseRef = useRef<string | null>(null)

  // Hydrate from sessionStorage on mount
  useEffect(() => {
    if (!projectId) return
    const stored = loadSessionKey(projectId)
    if (stored) {
      setSessionKey(stored)
      setKeyState('active')
    } else if (!isSessionKeyValid(projectId)) {
      setKeyState('idle')
    }
  }, [projectId])

  const setup = useCallback(async (passphrase: string, ttlHours = 8) => {
    if (!projectId) return
    setKeyState('busy')
    setError(null)
    try {
      const stored = await generateSessionKey({ projectId, passphrase, ttlHours })
      passphraseRef.current = passphrase
      setSessionKey(stored)
      setKeyState('active')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Key setup failed')
      setKeyState('error')
    }
  }, [projectId])

  const unlock = useCallback((passphrase: string) => {
    passphraseRef.current = passphrase
  }, [])

  const revoke = useCallback(() => {
    passphraseRef.current = null
    clearSessionKey()
    setSessionKey(null)
    setKeyState('idle')
    setError(null)
  }, [])

  const sign = useCallback(async (
    eventType: string,
    payload: Record<string, unknown>,
    actorId: string,
    actorRole: string,
    passphrase: string,
  ) => {
    if (!projectId) throw new Error('No project selected')
    setKeyState('busy')
    try {
      const result = await writeLedgerEvent({ projectId, eventType, payload, actorId, actorRole, passphrase })
      setKeyState('active')
      return result
    } catch (err) {
      setKeyState('error')
      setError(err instanceof Error ? err.message : 'Signing failed')
      throw err
    }
  }, [projectId])

  const trySign = useCallback((
    eventType: string,
    payload: Record<string, unknown>,
    actorId: string,
    actorRole = 'author',
  ) => {
    if (!projectId) return
    const passphrase = passphraseRef.current
    if (!passphrase || !isSessionKeyValid(projectId)) return
    // Fire-and-forget — ledger events are best-effort
    writeLedgerEvent({ projectId, eventType, payload, actorId, actorRole, passphrase }).catch(() => {
      // silently discard — ledger write failure never blocks research actions
    })
  }, [projectId])

  return {
    keyState,
    sessionKey,
    error,
    isUnlocked: passphraseRef.current !== null,
    setup,
    unlock,
    revoke,
    sign,
    trySign,
  }
}
