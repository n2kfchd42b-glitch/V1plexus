'use client'

import { useEffect } from 'react'
import { startKeepalive } from '@/lib/keepalive'

export function KeepaliveProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const interval = startKeepalive()
    return () => clearInterval(interval)
  }, [])

  return <>{children}</>
}
