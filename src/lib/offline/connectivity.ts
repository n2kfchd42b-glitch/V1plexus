'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

export type ConnectionStatus = 'online' | 'offline' | 'slow'

export function useConnectivity(): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>('online')

  const updateStatus = useCallback(() => {
    if (typeof window === 'undefined') return
    if (!navigator.onLine) {
      setStatus('offline')
      return
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conn = (navigator as any).connection
    if (conn && ['slow-2g', '2g'].includes(conn.effectiveType)) {
      setStatus('slow')
      return
    }
    setStatus('online')
  }, [])

  useEffect(() => {
    updateStatus()
    window.addEventListener('online', updateStatus)
    window.addEventListener('offline', updateStatus)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conn = (navigator as any).connection
    if (conn) {
      conn.addEventListener('change', updateStatus)
    }
    return () => {
      window.removeEventListener('online', updateStatus)
      window.removeEventListener('offline', updateStatus)
      if (conn) {
        conn.removeEventListener('change', updateStatus)
      }
    }
  }, [updateStatus])

  return status
}

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error'

export function useSyncStatus() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null)
  const [pendingCount, setPendingCount] = useState(0)
  const connectivity = useConnectivity()
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const sync = useCallback(async () => {
    if (connectivity === 'offline') return
    setSyncStatus('syncing')
    try {
      const { syncOfflineQueue } = await import('./queue')
      await syncOfflineQueue()
      setLastSyncedAt(new Date())
      setSyncStatus('synced')
      // After syncing, update pending count
      const { getPendingCount } = await import('./queue')
      const count = await getPendingCount()
      setPendingCount(count)
    } catch {
      setSyncStatus('error')
    }
    // Reset to idle after 3s
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current)
    syncTimeoutRef.current = setTimeout(() => setSyncStatus('idle'), 3000)
  }, [connectivity])

  // Auto-sync when connectivity restores
  useEffect(() => {
    if (connectivity === 'online') {
      sync()
    }
  }, [connectivity, sync])

  // Refresh pending count on mount
  useEffect(() => {
    import('./queue').then(({ getPendingCount }) => {
      getPendingCount().then(setPendingCount)
    })
  }, [])

  return { syncStatus, lastSyncedAt, pendingCount, sync }
}
