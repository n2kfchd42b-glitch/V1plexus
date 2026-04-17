'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useOnlineStatus } from './useOnlineStatus'
import { saveDocumentOffline } from '@/lib/offline/offlineWrites'
import { createBrowserClient } from '@/lib/data/client'

export type SaveState = 'saved' | 'saving' | 'queued' | 'unsaved' | 'error'

export function useDocumentAutoSave(
  document_id: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initial_content: any
) {
  const { isOnline } = useOnlineStatus()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [content, setContent] = useState<any>(initial_content)
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const supabase = createBrowserClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const save = useCallback(async (newContent: any, wordCount?: number) => {
    setSaveState('saving')
    try {
      const result = await saveDocumentOffline(supabase, document_id, {
        content: newContent,
        ...(wordCount !== undefined ? { word_count: wordCount } : {}),
      })
      if (result.success) {
        setSaveState(result.queued ? 'queued' : 'saved')
        setLastSaved(new Date())
      } else {
        setSaveState('error')
      }
    } catch {
      setSaveState('error')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document_id])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateContent = useCallback((newContent: any, wordCount?: number) => {
    setContent(newContent)
    setSaveState('unsaved')

    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      save(newContent, wordCount)
    }, 1500)
  }, [save])

  // Flush queued save immediately on reconnect
  useEffect(() => {
    if (isOnline && saveState === 'queued') {
      save(content)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline])

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [])

  return {
    content,
    updateContent,
    saveState,
    lastSaved,
    saveNow: () => save(content),
  }
}
