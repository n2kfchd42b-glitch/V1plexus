'use client'

import { useState, useEffect, useCallback } from 'react'

type ConnectionStatus = 'connected' | 'reconnecting'

export function ConnectionGuard({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<ConnectionStatus>('connected')

  const check = useCallback(async () => {
    try {
      const res = await fetch('/api/health', {
        signal: AbortSignal.timeout(4000),
      })
      setStatus(res.ok ? 'connected' : 'reconnecting')
    } catch {
      setStatus('reconnecting')
    }
  }, [])

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') check()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [check])

  return <>{children}</>
}
