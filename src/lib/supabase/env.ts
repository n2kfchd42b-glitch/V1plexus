/**
 * Single source of truth for Supabase env vars. Fail fast at module load
 * rather than silently falling back to placeholders that lead to broken auth.
 */

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Set it in .env.local (local) or your hosting provider's env config (prod).`
    )
  }
  return value
}

export const SUPABASE_URL = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
export const SUPABASE_ANON_KEY = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
