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

  return (
    <>
      {status === 'reconnecting' && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 py-2 px-4 text-xs font-medium"
          style={{
            backgroundColor: 'var(--status-warning-bg)',
            borderBottom: '1px solid var(--border-status-warning)',
            color: 'var(--status-warning-text)',
          }}
        >
          <span
            className="inline-block h-1.5 w-1.5 rounded-full status-dot--running"
            style={{ backgroundColor: 'var(--status-warning)' }}
          />
          Reconnecting to server — please wait a moment…
        </div>
      )}
      {children}
    </>
  )
}
