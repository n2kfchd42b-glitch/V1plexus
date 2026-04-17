'use client'

import { useEffect, useRef } from 'react'
import { useOnlineStatus } from './useOnlineStatus'
import { processSyncQueue } from '@/lib/offline/syncQueue'
import { dispatchQueuedJobs } from '@/lib/offline/analysisQueue'
import { createBrowserClient } from '@/lib/data/client'

export function useSyncOnReconnect(opts?: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  runAnalysisFn?: (payload: any) => Promise<{ run_id: string } | null>
}): void {
  const { isOnline } = useOnlineStatus()
  const wasOffline = useRef(false)
  const isSyncing = useRef(false)

  useEffect(() => {
    if (!isOnline) {
      wasOffline.current = true
      return
    }

    if (wasOffline.current && !isSyncing.current) {
      wasOffline.current = false
      isSyncing.current = true

      const supabase = createBrowserClient()

      processSyncQueue(supabase)
        .then(({ processed, failed }) => {
          if (processed > 0) console.info(`Sync complete: ${processed} write(s) synced`)
          if (failed > 0) console.warn(`Sync: ${failed} write(s) failed`)
        })
        .catch(err => console.error('Sync error:', err))
        .finally(() => { isSyncing.current = false })

      if (opts?.runAnalysisFn) {
        dispatchQueuedJobs(opts.runAnalysisFn)
          .then(({ dispatched }) => {
            if (dispatched > 0) console.info(`Dispatched ${dispatched} queued analysis job(s)`)
          })
          .catch(err => console.error('Analysis dispatch error:', err))
      }
    }
  }, [isOnline, opts])
}
