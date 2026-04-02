/**
 * Profile Redirect Route
 * Redirects authenticated user to their own portfolio
 * GET /profile/me
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      // Not authenticated, redirect to signin
      redirect('/auth/signin')
    }

    // Get user's profile to find username
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('username, full_name')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      // Profile not found, redirect to onboarding or profile setup
      redirect('/profile/setup')
    }

    if (!profile.username) {
      // No username yet, redirect to setup
      redirect('/profile/setup')
    }

    // Redirect to their own portfolio
    redirect(`/profile/${profile.username}`)
  } catch (error) {
    console.error('Profile redirect error:', error)
    redirect('/')
  }
}
