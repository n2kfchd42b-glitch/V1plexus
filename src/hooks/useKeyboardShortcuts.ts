"use client"

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

type ShortcutHandler = () => void

interface ShortcutMap {
  [key: string]: ShortcutHandler
}

/**
 * Global keyboard shortcut system.
 * Supports:
 *  - Single keys:          'Escape', '?'
 *  - Modifier combos:      'ctrl+k', 'meta+k', 'meta+\\'
 *  - Sequence combos:      'g d', 'g p' (two-key sequences)
 */
export function useKeyboardShortcuts(shortcuts: ShortcutMap) {
  const pendingRef = useRef<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't fire when typing in inputs
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) return

      const meta = e.metaKey || e.ctrlKey
      const shift = e.shiftKey

      // Build key string
      let keyStr = ''
      if (meta)  keyStr += 'meta+'
      if (shift) keyStr += 'shift+'
      keyStr += e.key.toLowerCase()

      // Check direct shortcut
      if (shortcuts[keyStr]) {
        e.preventDefault()
        shortcuts[keyStr]()
        return
      }

      // Sequence shortcuts (e.g. 'g d')
      if (pendingRef.current) {
        const seq = `${pendingRef.current} ${e.key.toLowerCase()}`
        if (shortcuts[seq]) {
          e.preventDefault()
          shortcuts[seq]()
        }
        pendingRef.current = null
        if (timerRef.current) clearTimeout(timerRef.current)
        return
      }

      // Check if this starts a sequence
      const startsSeq = Object.keys(shortcuts).some(k => k.startsWith(e.key.toLowerCase() + ' '))
      if (startsSeq) {
        pendingRef.current = e.key.toLowerCase()
        timerRef.current = setTimeout(() => {
          pendingRef.current = null
        }, 1000)
      }
    }

    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('keydown', handler)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [shortcuts])
}

/**
 * Pre-wired global navigation shortcuts used in the app shell.
 */
export function useGlobalShortcuts(options: {
  onCommandPalette: () => void
  onShortcutOverlay: () => void
}) {
  const router = useRouter()

  useKeyboardShortcuts({
    'meta+k':    options.onCommandPalette,
    'ctrl+k':    options.onCommandPalette,
    '?':         options.onShortcutOverlay,
    'g d':       () => router.push('/dashboard'),
    'g p':       () => router.push('/projects'),
    'g r':       () => router.push('/reviews'),
    'g n':       () => router.push('/notifications'),
  })
}
