'use client'

import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useEffect, useState } from 'react'

export function OfflineStatusBar() {
  const { isOnline, since } = useOnlineStatus()
  const [visible, setVisible] = useState(false)
  const [wasOffline, setWasOffline] = useState(false)

  useEffect(() => {
    if (!isOnline) {
      setVisible(true)
      setWasOffline(true)
    } else if (wasOffline && since) {
      setVisible(true)
      const timer = setTimeout(() => {
        setVisible(false)
        setWasOffline(false)
      }, 4000)
      return () => clearTimeout(timer)
    } else {
      setVisible(false)
    }
  }, [isOnline, since, wasOffline])

  if (!visible) return null

  if (!isOnline) {
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          background: '#191c1e',
          padding: '10px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#ba1a1a',
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontFamily: 'var(--font-inter, Inter, sans-serif)',
            fontSize: 13,
            color: '#ffffff',
            fontWeight: 500,
          }}
        >
          You are offline
        </span>
        <span
          style={{
            fontFamily: 'var(--font-geist-mono, monospace)',
            fontSize: 11,
            color: 'rgba(255,255,255,0.5)',
          }}
        >
          Cached data available · Changes will sync when connected
        </span>
      </div>
    )
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: '#15803d',
        padding: '10px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
      }}
    >
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: '#ffffff',
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontFamily: 'var(--font-inter, Inter, sans-serif)',
          fontSize: 13,
          color: '#ffffff',
          fontWeight: 500,
        }}
      >
        Back online
      </span>
      <span
        style={{
          fontFamily: 'var(--font-geist-mono, monospace)',
          fontSize: 11,
          color: 'rgba(255,255,255,0.7)',
        }}
      >
        Syncing changes...
      </span>
    </div>
  )
}
