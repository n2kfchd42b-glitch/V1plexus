'use client'

import { useSyncOnReconnect } from '@/hooks/useSyncOnReconnect'

export function SyncProvider({ children }: { children: React.ReactNode }) {
  useSyncOnReconnect()
  return <>{children}</>
}
