import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Supabase auth callback — exchanges the PKCE code for a session.
 *
 * Supabase confirmation/magic-link emails redirect here with:
 *   ?code=<pkce_code>&next=<destination>
 *
 * After exchanging the code we redirect to `next` (default /dashboard).
 * This preserves invite redirects: the register page sets
 *   emailRedirectTo = /auth/callback?next=/invite/<token>
 * so after confirming their email the user lands directly on the invite page.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Code missing or exchange failed — send to login with an error flag
  return NextResponse.redirect(`${origin}/login?error=confirmation_failed`)
}
