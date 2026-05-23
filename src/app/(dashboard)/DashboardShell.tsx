"use client"

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/Header'
import { CommandPalette } from '@/components/layout/CommandPalette'
import { ShortcutOverlay } from '@/components/layout/ShortcutOverlay'
import { MobileSidebar } from '@/components/layout/MobileSidebar'
import { WorkspaceSidebar } from '@/components/layout/WorkspaceSidebar'
import { useAuth } from '@/hooks/useAuth'
import { useGlobalShortcuts } from '@/hooks/useKeyboardShortcuts'
import { Toaster } from 'sonner'
import { LocationPromptBanner } from '@/components/layout/LocationPromptBanner'
import { GlobalPresenceWidget } from '@/components/layout/GlobalPresenceWidget'

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, signOut } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [cmdOpen, setCmdOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [locationSaved, setLocationSaved] = useState(false)

  const openCommandPalette = useCallback(() => setCmdOpen(true), [])
  const openShortcuts = useCallback(() => setShortcutsOpen(true), [])

  const supabaseRef = useRef(createClient())
  useEffect(() => {
    if (!user) return
    const ping = () => {
      supabaseRef.current
        .from('profiles')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', user.id)
        .then(() => {})
    }
    ping()
    const interval = setInterval(ping, 4 * 60 * 1000)
    return () => clearInterval(interval)
  }, [user])

  useGlobalShortcuts({
    onCommandPalette: openCommandPalette,
    onShortcutOverlay: openShortcuts,
  })

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-app)]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-[var(--border-default)] border-t-[var(--accent-blue)] animate-spin" />
          <p className="text-sm text-[var(--text-tertiary)]">Loading…</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="flex h-screen bg-[var(--bg-app)]">
      <div className="hidden md:block">
        <WorkspaceSidebar
          profile={profile}
          onSignOut={signOut}
          onCommandPalette={openCommandPalette}
        />
      </div>

      <MobileSidebar profile={profile} onSignOut={signOut} />

      <div id="content-scroll-area" className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <Header profile={profile} onSearchClick={openCommandPalette} />
        {profile && !profile.lat && !locationSaved && (
          <LocationPromptBanner userId={profile.id} onSaved={() => setLocationSaved(true)} />
        )}
        <main className="flex-1">
          <div className="page-content">
            {children}
          </div>
        </main>
      </div>

      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
      <ShortcutOverlay open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 4000,
          style: {
            fontFamily: 'var(--font-geist-sans, system-ui)',
            fontSize: '13px',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-default)',
            boxShadow: 'var(--shadow-lg)',
          },
        }}
      />

      {pathname === '/projects' && <GlobalPresenceWidget />}
    </div>
  )
}
