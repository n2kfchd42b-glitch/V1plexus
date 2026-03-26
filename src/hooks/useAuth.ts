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
      setUser(session?.user ?? null)
      if (session?.user) {
        await fetchProfile(session.user)
      } else {
        setProfile(null)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  const signOut = () => {
    // Navigate immediately — don't wait for the network call.
    // signOut still fires in the background to invalidate the server session.
    window.location.href = '/login'
    supabase.auth.signOut()
  }

  return { user, profile, loading, signOut }
}
