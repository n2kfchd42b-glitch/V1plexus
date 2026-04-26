"use client"

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/Header'
import { CommandPalette } from '@/components/layout/CommandPalette'
import { ShortcutOverlay } from '@/components/layout/ShortcutOverlay'
import { MobileSidebar } from '@/components/layout/MobileSidebar'
import { WorkspaceSidebar } from '@/components/layout/WorkspaceSidebar'
import { WorkspaceProvider } from '@/components/workspace/WorkspaceProvider'
import { useAuth } from '@/hooks/useAuth'
import { useGlobalShortcuts } from '@/hooks/useKeyboardShortcuts'
import { Toaster } from 'sonner'
import { LocationPromptBanner } from '@/components/layout/LocationPromptBanner'

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, signOut } = useAuth()
  const router = useRouter()
  const [cmdOpen, setCmdOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  const openCommandPalette = useCallback(() => setCmdOpen(true), [])
  const openShortcuts = useCallback(() => setShortcutsOpen(true), [])

  // Heartbeat: keep last_seen_at fresh so the researcher appears online on the globe
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
    const interval = setInterval(ping, 4 * 60 * 1000) // every 4 min
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
      {/* Desktop sidebar — now workspace-aware */}
      <div className="hidden md:block">
        <WorkspaceSidebar
          profile={profile}
          onSignOut={signOut}
          onCommandPalette={openCommandPalette}
        />
      </div>

      {/* Mobile sidebar */}
      <MobileSidebar profile={profile} onSignOut={signOut} />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <Header profile={profile} onSearchClick={openCommandPalette} />
        {profile && !profile.lat && (
          <LocationPromptBanner userId={profile.id} />
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

      <button
        onClick={() => setShortcutsOpen(true)}
        className="fixed bottom-4 right-4 h-8 w-8 flex items-center justify-center rounded-full bg-[var(--bg-surface)] border border-[var(--border-default)] shadow-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:shadow-md transition-all duration-150 text-sm font-medium z-40"
        title="Keyboard shortcuts (?)"
      >
        ?
      </button>
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceProvider>
      <DashboardContent>{children}</DashboardContent>
    </WorkspaceProvider>
  )
}
