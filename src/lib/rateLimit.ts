import { NextRequest, NextResponse } from 'next/server'
import type { Ratelimit as RatelimitType } from '@upstash/ratelimit'

interface RateLimitEntry {
  count: number
  windowStart: number
}

// In-memory fallback store. Resets on cold start and is per-instance, so it is
// only a best-effort guard on serverless. The durable Upstash path below is the
// real limiter in production — see checkRateLimit().
const store = new Map<string, RateLimitEntry>()

interface RateLimitOptions {
  /** Maximum requests allowed within the window */
  limit: number
  /** Window duration in milliseconds */
  windowMs: number
}

function clientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  )
}

function tooManyResponse(retryAfterSec: number, limit: number): NextResponse {
  return NextResponse.json(
    { error: 'Too many requests, please try again later.' },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfterSec),
        'X-RateLimit-Limit': String(limit),
        'X-RateLimit-Remaining': '0',
      },
    },
  )
}

// ── Durable (Upstash Redis) path ───────────────────────────────────────────
// Active when UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set.
// Shared across all serverless instances, so the limit is global rather than
// per-instance. One Ratelimit instance is memoised per (limit, window) pair.

const upstashConfigured = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
)
const limiterCache = new Map<string, RatelimitType>()

async function durableCheck(
  request: NextRequest,
  options: RateLimitOptions,
): Promise<NextResponse | null> {
  const { Ratelimit } = await import('@upstash/ratelimit')
  const { Redis } = await import('@upstash/redis')

  const cacheKey = `${options.limit}:${options.windowMs}`
  let limiter = limiterCache.get(cacheKey)
  if (!limiter) {
    limiter = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(options.limit, `${options.windowMs} ms`),
      prefix: 'plexus-rl',
    })
    limiterCache.set(cacheKey, limiter)
  }

  const key = `${request.nextUrl.pathname}:${clientIp(request)}`
  const { success, reset } = await limiter.limit(key)
  if (!success) {
    const retryAfterSec = Math.max(1, Math.ceil((reset - Date.now()) / 1000))
    return tooManyResponse(retryAfterSec, options.limit)
  }
  return null
}

// ── In-memory fallback path ────────────────────────────────────────────────

function memoryCheck(
  request: NextRequest,
  options: RateLimitOptions,
): NextResponse | null {
  const key = `${request.nextUrl.pathname}:${clientIp(request)}`
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now - entry.windowStart >= options.windowMs) {
    store.set(key, { count: 1, windowStart: now })
    return null
  }

  if (entry.count >= options.limit) {
    const retryAfterSec = Math.ceil((options.windowMs - (now - entry.windowStart)) / 1000)
    return tooManyResponse(retryAfterSec, options.limit)
  }

  entry.count += 1
  return null
}

/**
 * Returns a 429 NextResponse if the caller exceeds the rate limit, or null if
 * the request is allowed. Call at the top of a route handler before other logic:
 *
 *   const limited = await checkRateLimit(req, { limit: 20, windowMs: 3_600_000 })
 *   if (limited) return limited
 *
 * Uses durable Upstash Redis when configured (global across instances), and
 * falls back to a per-instance in-memory counter otherwise. If the Upstash call
 * fails for any reason, it degrades to the in-memory path rather than erroring.
 */
export async function checkRateLimit(
  request: NextRequest,
  options: RateLimitOptions,
): Promise<NextResponse | null> {
  if (upstashConfigured) {
    try {
      return await durableCheck(request, options)
    } catch {
      // Network/Upstash error — degrade gracefully to the in-memory guard.
    }
  }
  return memoryCheck(request, options)
}
