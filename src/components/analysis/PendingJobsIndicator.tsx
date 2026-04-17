'use client'

import { useState, useEffect } from 'react'
import { getPendingJobCount } from '@/lib/offline/analysisQueue'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

export function PendingJobsIndicator() {
  const { isOnline } = useOnlineStatus()
  const [count, setCount] = useState(0)

  useEffect(() => {
    async function check() {
      const n = await getPendingJobCount()
      setCount(n)
    }
    check()
    const interval = setInterval(check, 15_000)
    return () => clearInterval(interval)
  }, [isOnline])

  if (count === 0) return null

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '4px 10px',
      borderRadius: '20px',
      background: 'rgba(180,83,9,0.08)',
      border: '1px solid rgba(180,83,9,0.2)',
    }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
      <span style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '10px',
        fontWeight: 600,
        color: '#92400e',
      }}>
        {count} {count === 1 ? 'analysis' : 'analyses'} queued
      </span>
    </div>
  )
}
