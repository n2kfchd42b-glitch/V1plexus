'use client'

import { useEffect } from 'react'

// Supabase-js throws unhandled AbortError rejections when the auth token lock
// is stolen by a concurrent request (amplified by React Strict Mode). These
// are benign — Supabase recovers automatically — but flood the console.
export function SupabaseLockSuppressor() {
  useEffect(() => {
    function handler(event: PromiseRejectionEvent) {
      const msg = event.reason?.message ?? String(event.reason ?? '')
      if (msg.includes('Lock') || msg.includes('AbortError') || msg.includes('stolen')) {
        event.preventDefault()
      }
    }
    window.addEventListener('unhandledrejection', handler)
    return () => window.removeEventListener('unhandledrejection', handler)
  }, [])
  return null
}
