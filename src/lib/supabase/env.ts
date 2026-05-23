/**
 * Single source of truth for Supabase env vars. Direct property access
 * (NOT process.env[name]) is required so Next.js inlines the literal value
 * into the client bundle — bracket notation would leave the browser with
 * an empty process.env at runtime.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url) {
  throw new Error(
    'Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL. ' +
      "Set it in .env.local (local) or your hosting provider's env config (prod), then rebuild."
  )
}
if (!anonKey) {
  throw new Error(
    'Missing required environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
      "Set it in .env.local (local) or your hosting provider's env config (prod), then rebuild."
  )
}

export const SUPABASE_URL: string = url
export const SUPABASE_ANON_KEY: string = anonKey
