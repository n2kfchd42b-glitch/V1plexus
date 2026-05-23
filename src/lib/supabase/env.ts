/**
 * Single source of truth for Supabase env vars.
 *
 * Direct property access on `process.env.NEXT_PUBLIC_*` is required so
 * Next.js inlines the literal values into the client bundle. Bracket
 * notation (`process.env[name]`) would leave the browser with an empty
 * process.env at runtime.
 *
 * We do NOT throw at module load — that was crashing Vercel's build
 * under conditions we couldn't reproduce locally. Instead we fall back
 * to empty strings, then surface a loud console error in the browser
 * if the values are missing. The Supabase client itself will also fail
 * with a clear error when invoked with empty credentials.
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

if (typeof window !== 'undefined' && (!SUPABASE_URL || !SUPABASE_ANON_KEY)) {
  console.error(
    '[plexus] Supabase env vars are missing in this build. ' +
      'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
      "in your hosting provider's env config and redeploy."
  )
}
