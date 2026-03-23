'use client'

import { WifiOff, Wifi } from 'lucide-react'
import { useConnectivity } from '@/lib/offline/connectivity'

export function OfflineBanner() {
  const status = useConnectivity()

  if (status === 'online') return null

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium transition-all duration-300 ${
        status === 'offline'
          ? 'bg-amber-500 text-amber-950'
          : 'bg-amber-400/90 text-amber-950'
      }`}
    >
      {status === 'offline' ? (
        <>
          <WifiOff className="h-3.5 w-3.5 flex-shrink-0" />
          <span>You&apos;re offline — changes will sync when connected</span>
        </>
      ) : (
        <>
          <Wifi className="h-3.5 w-3.5 flex-shrink-0" />
          <span>Slow connection detected — some features may be delayed</span>
        </>
      )}
    </div>
  )
}
