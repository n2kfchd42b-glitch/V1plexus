'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '@/types/database'
import { logAudit } from '@/lib/audit'

interface AuthState {
  user: User | null
  profile: Profile | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
})

export function useAuthContext() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    const fetchProfile = async (authUser: User) => {
      let { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle()

      if (!data) {
        const { data: created } = await supabase
          .from('profiles')
          .upsert(
            {
              id: authUser.id,
              email: authUser.email ?? '',
              full_name:
                authUser.user_metadata?.full_name ??
                authUser.user_metadata?.name ??
                null,
              avatar_url: authUser.user_metadata?.avatar_url ?? null,
            },
            { onConflict: 'id' }
          )
          .select('*')
          .maybeSingle()
        data = created
      }

      setProfile(data)
    }

    // Single subscription shared across the entire app.
    // onAuthStateChange fires immediately with the current session so we
    // never need a separate getUser() call — that's what causes lock contention.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_, session) => {
      const authUser = session?.user ?? null
      setUser(authUser)

      if (!authUser) {
        setProfile(null)
        setLoading(false)
        return
      }

      setLoading(false)

      try {
        await fetchProfile(authUser)
      } catch (e) {
        console.error('[AuthProvider] profile fetch error:', e)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    const supabase = createClient()
    // Fire-and-forget the audit log so a slow/failing network call can't
    // strand the user in a "signing out…" state. We don't await it.
    if (user) {
      void logAudit('auth.logout', 'profile', user.id, { summary: 'User signed out' })
    }
    await supabase.auth.signOut({ scope: 'local' })
    // The workspace_ready cookie is httpOnly so JS can't clear it; the
    // middleware compares it to user.id, so a stale value just triggers a
    // fresh DB check on the next request — not a security issue.
    window.location.href = '/login?signout=1'
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
