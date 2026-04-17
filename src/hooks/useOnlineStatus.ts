'use client'

import { useState, useEffect } from 'react'

export type OnlineStatus = 'online' | 'offline' | 'slow'

export function useOnlineStatus(): {
  isOnline: boolean
  status: OnlineStatus
  since: Date | null
} {
  const [isOnline, setIsOnline] = useState(true)
  const [status, setStatus] = useState<OnlineStatus>('online')
  const [since, setSince] = useState<Date | null>(null)

  useEffect(() => {
    setIsOnline(navigator.onLine)
    setStatus(navigator.onLine ? 'online' : 'offline')

    function handleOnline() {
      setIsOnline(true)
      setStatus('online')
      setSince(new Date())
      setTimeout(() => setSince(null), 5000)
    }

    function handleOffline() {
      setIsOnline(false)
      setStatus('offline')
      setSince(new Date())
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Periodic connectivity probe — checks actual reachability, not just navigator.onLine
    // (navigator.onLine can be true on mobile even when the connection is unusable)
    const connectionCheck = setInterval(async () => {
      if (!navigator.onLine) return
      try {
        const start = Date.now()
        await fetch('/api/health', {
          method: 'HEAD',
          cache: 'no-store',
          signal: AbortSignal.timeout(3000),
        })
        setStatus(Date.now() - start > 2000 ? 'slow' : 'online')
      } catch {
        setStatus('slow')
      }
    }, 30_000)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(connectionCheck)
    }
  }, [])

  return { isOnline, status, since }
}
