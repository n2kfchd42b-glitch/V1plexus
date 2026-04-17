'use client'

import { useEffect } from 'react'
import { useSyncOnReconnect } from '@/hooks/useSyncOnReconnect'
import { clearCompletedJobs } from '@/lib/offline/analysisQueue'

export function SyncProvider({ children }: { children: React.ReactNode }) {
  useSyncOnReconnect()

  useEffect(() => {
    clearCompletedJobs().catch(() => { /* non-blocking */ })
  }, [])

  return <>{children}</>
}
