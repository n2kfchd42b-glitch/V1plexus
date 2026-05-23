import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { NextRequest } from 'next/server'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './env'

/**
 * Extract the Supabase JWT from request cookies without calling getSession(),
 * which triggers a security warning when used on the server.
 * Only call this after authenticating the user via supabase.auth.getUser().
 */
export function getAccessTokenFromRequest(request: NextRequest): string | null {
  const authCookie = request.cookies.getAll()
    .find(c => c.name.includes('auth-token') && !c.name.includes('code-verifier'))
  if (!authCookie) return null
  try {
    const parsed = JSON.parse(decodeURIComponent(authCookie.value))
    return Array.isArray(parsed) ? (parsed[0]?.access_token ?? null) : (parsed?.access_token ?? null)
  } catch {
    return null
  }
}

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2])
            )
          } catch {
            // Server component - ignore
          }
        },
      },
    }
  )
}
