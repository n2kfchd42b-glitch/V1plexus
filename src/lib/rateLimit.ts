import { NextRequest, NextResponse } from 'next/server'

interface RateLimitEntry {
  count: number
  windowStart: number
}

// In-memory store — resets on cold start, suitable for single-instance / edge deployments.
// For multi-instance production use, replace with Redis (e.g. Upstash).
const store = new Map<string, RateLimitEntry>()

interface RateLimitOptions {
  /** Maximum requests allowed within the window */
  limit: number
  /** Window duration in milliseconds */
  windowMs: number
}

/**
 * Returns a 429 NextResponse if the IP exceeds the rate limit, or null if the request is allowed.
 * Call at the top of a route handler before any other logic.
 */
export function checkRateLimit(
  request: NextRequest,
  options: RateLimitOptions
): NextResponse | null {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'

  const key = `${request.nextUrl.pathname}:${ip}`
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now - entry.windowStart >= options.windowMs) {
    store.set(key, { count: 1, windowStart: now })
    return null
  }

  if (entry.count >= options.limit) {
    const retryAfterSec = Math.ceil((options.windowMs - (now - entry.windowStart)) / 1000)
    return NextResponse.json(
      { error: 'Too many requests, please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfterSec),
          'X-RateLimit-Limit': String(options.limit),
          'X-RateLimit-Remaining': '0',
        },
      }
    )
  }

  entry.count += 1
  return null
}
