'use client'

import { useEffect } from 'react'

// Unregister any stale service workers so cached JS chunks never block updates.
// Runs once on mount; safe to no-op when no workers/caches exist.
export function ServiceWorkerCleanup() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.getRegistrations().then(regs => {
      regs.forEach(reg => reg.unregister())
    }).catch(() => {})
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name))
      }).catch(() => {})
    }
  }, [])
  return null
}
