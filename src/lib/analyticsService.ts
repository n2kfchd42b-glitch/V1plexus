/**
 * Single source of truth for the external PLEXUS Analytics (FastAPI) service URL.
 *
 * Previously every route inlined:
 *   let url = process.env.ANALYTICS_API_URL || 'http://localhost:8000'
 * which meant that if ANALYTICS_API_URL was unset in production, the whole
 * analytics/causal/narrative surface silently pointed at localhost and failed
 * with opaque fetch errors. This helper makes that failure loud.
 *
 * Behaviour:
 *  - Returns the configured URL, normalised to include an https:// scheme.
 *  - In development, falls back to http://localhost:8000 so local dev "just works".
 *  - In production, throws a clear error if the variable is missing, so the
 *    misconfiguration surfaces immediately instead of silently degrading.
 */

const LOCAL_FALLBACK = 'http://localhost:8000'

/** True when the analytics service is configured (or we are in dev). */
export function isAnalyticsConfigured(): boolean {
  return Boolean(process.env.ANALYTICS_API_URL) || process.env.NODE_ENV !== 'production'
}

/**
 * Returns the normalised base URL of the analytics service.
 * Throws in production when ANALYTICS_API_URL is not configured.
 */
export function getAnalyticsBaseUrl(): string {
  const raw = process.env.ANALYTICS_API_URL

  if (!raw) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'ANALYTICS_API_URL is not configured. The analytics service URL is required ' +
          'in production — set it in your hosting provider\'s environment config.',
      )
    }
    return LOCAL_FALLBACK
  }

  // Accept bare hostnames (e.g. "analytics.example.com") and prefix https://.
  return raw.startsWith('http') ? raw : `https://${raw}`
}
