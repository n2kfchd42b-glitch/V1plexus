'use client'

export function startKeepalive(): ReturnType<typeof setInterval> {
  const ping = () => {
    fetch('/api/health', { signal: AbortSignal.timeout(5000) }).catch(() => {})
  }

  // Ping every 8 minutes — Fargate sleeps after ~10 min of inactivity
  const interval = setInterval(ping, 8 * 60 * 1000)

  // Also wake the container immediately when the tab becomes visible again
  const onVisibility = () => {
    if (document.visibilityState === 'visible') ping()
  }
  document.addEventListener('visibilitychange', onVisibility)

  return interval
}
