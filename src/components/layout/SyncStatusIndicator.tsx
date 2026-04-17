'use client'

import { useState, useEffect } from 'react'
import { getQueueStatus } from '@/lib/offline/syncQueue'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

export function SyncStatusIndicator() {
  const { isOnline } = useOnlineStatus()
  const [status, setStatus] = useState({ pending: 0, failed: 0, total: 0 })

  useEffect(() => {
    async function check() {
      const s = await getQueueStatus()
      setStatus(s)
    }

    check()
    const interval = setInterval(check, 30_000)
    return () => clearInterval(interval)
  }, [isOnline])

  if (status.total === 0) return null

  const hasFailed = status.failed > 0

  return (
    <div
      style={{
        position: 'fixed',
        top: 12,
        right: 16,
        zIndex: 9990,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 20,
        background: hasFailed ? 'rgba(186,26,26,0.08)' : 'rgba(180,83,9,0.08)',
        border: `1px solid ${hasFailed ? 'rgba(186,26,26,0.2)' : 'rgba(180,83,9,0.2)'}`,
      }}
    >
      <div
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: hasFailed ? '#ba1a1a' : '#b45309',
        }}
      />
      <span
        style={{
          fontFamily: 'var(--font-geist-mono, monospace)',
          fontSize: 10,
          fontWeight: 600,
          color: hasFailed ? '#ba1a1a' : '#b45309',
        }}
      >
        {hasFailed ? `${status.failed} write${status.failed !== 1 ? 's' : ''} failed` : `${status.pending} pending sync`}
      </span>
    </div>
  )
}
