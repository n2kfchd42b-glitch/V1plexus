"use client"

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '@/types/database'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    const fetchProfile = async (authUser: import('@supabase/supabase-js').User) => {
      // maybeSingle() — never throws 406 on 0 rows
      let { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle()

      // Profile missing (user predates the auto-create trigger) — upsert now
      if (!data) {
        const { data: created } = await supabase
          .from('profiles')
          .upsert({
            id: authUser.id,
            email: authUser.email ?? '',
            full_name: authUser.user_metadata?.full_name ?? authUser.user_metadata?.name ?? null,
            avatar_url: authUser.user_metadata?.avatar_url ?? null,
          }, { onConflict: 'id' })
          .select('*')
          .maybeSingle()
        data = created
      }

      setProfile(data)
    }

    // onAuthStateChange fires immediately with the current session —
    // no need for a separate getUser() call, which would race for the
    // same auth lock and trigger the Supabase 5 s lock warning in
    // React Strict Mode.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_, session) => {
      const authUser = session?.user ?? null
      setUser(authUser)

      if (!authUser) {
        setProfile(null)
        setLoading(false)
        return
      }

      // Unblock the UI immediately — profile loads in the background
      setLoading(false)

      try {
        await fetchProfile(authUser)
      } catch (e) {
        console.error('[useAuth] onAuthStateChange error:', e)
      }
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  const signOut = async () => {
    // Clear the middleware cache cookie so a different user won't inherit
    // the previous user's workspace-ready state.
    document.cookie = 'workspace_ready=; path=/; max-age=0'
    // Await signOut so auth cookies are fully cleared before navigating.
    // Without this, the middleware still sees a valid session and redirects
    // back to /dashboard, creating a loop.
    await supabase.auth.signOut({ scope: 'local' })
    // The ?signout=1 flag tells the middleware to skip the
    // "redirect authenticated users away from /login" guard as a safety net.
    window.location.href = '/login?signout=1'
  }

  return { user, profile, loading, signOut }
}
