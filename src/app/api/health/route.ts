import { getAnalyticsBaseUrl } from '@/lib/analyticsService'
export async function GET() {
  const analyticsUrl = getAnalyticsBaseUrl()
  try {
    const res = await fetch(`${analyticsUrl}/analytics/health`, {
      signal: AbortSignal.timeout(5000),
    })
    if (res.ok) {
      return Response.json({ status: 'ok', timestamp: Date.now() })
    }
    return Response.json({ status: 'degraded', timestamp: Date.now() }, { status: 502 })
  } catch {
    return Response.json({ status: 'unavailable', timestamp: Date.now() }, { status: 503 })
  }
}

// Lightweight connectivity probe used by useOnlineStatus — always returns 200
// so offline detection is not affected by analytics service availability
export async function HEAD() {
  return new Response(null, {
    status: 200,
    headers: { 'Cache-Control': 'no-store' },
  })
}
