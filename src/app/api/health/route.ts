export async function GET() {
  const analyticsUrl = process.env.ANALYTICS_API_URL || 'http://localhost:8000'
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
