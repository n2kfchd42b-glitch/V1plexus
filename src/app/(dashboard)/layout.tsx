"use client"

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { CommandPalette } from '@/components/layout/CommandPalette'
import { ShortcutOverlay } from '@/components/layout/ShortcutOverlay'
import { useAuth } from '@/hooks/useAuth'
import { useGlobalShortcuts } from '@/hooks/useKeyboardShortcuts'
import { Toaster } from 'sonner'
import { MobileSidebar } from '@/components/layout/MobileSidebar'
import { CommandPalette } from '@/components/search/CommandPalette'
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, signOut } = useAuth()
  const router = useRouter()
  const [cmdOpen, setCmdOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  const openCommandPalette = useCallback(() => setCmdOpen(true), [])
  const openShortcuts = useCallback(() => setShortcutsOpen(true), [])

  useGlobalShortcuts({
    onCommandPalette: openCommandPalette,
    onShortcutOverlay: openShortcuts,
  })
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  // Check if first-time user needs onboarding
  useEffect(() => {
    if (!profile) return
    if ((profile as { onboarding_completed?: boolean }).onboarding_completed === false) {
      setShowOnboarding(true)
    }
  }, [profile])

  // Global Cmd+K shortcut
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      setPaletteOpen(prev => !prev)
    }
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const handleOnboardingComplete = async () => {
    if (profile) {
      await supabase
        .from('profiles')
        .update({ onboarding_completed: true } as Record<string, unknown>)
        .eq('id', profile.id)
    }
    setShowOnboarding(false)
  }

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
    <div className="flex min-h-screen bg-[var(--bg-app)]">
      <Sidebar
        profile={profile}
        onSignOut={signOut}
        onCommandPalette={openCommandPalette}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header profile={profile} />
        <main className="flex-1 overflow-y-auto">
          <div className="page-content">
            {children}
          </div>
        </main>
      </div>

      {/* Global overlays */}
      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
      <ShortcutOverlay open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      {/* Toast system */}
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

      {/* Shortcut hint button */}
      <button
        onClick={() => setShortcutsOpen(true)}
        className="fixed bottom-4 right-4 h-8 w-8 flex items-center justify-center rounded-full bg-[var(--bg-surface)] border border-[var(--border-default)] shadow-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:shadow-md transition-all duration-150 text-sm font-medium z-40"
        title="Keyboard shortcuts (?)"
      >
        ?
      </button>
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <Sidebar profile={profile} onSignOut={signOut} />
      </div>

      {/* Mobile sidebar drawer */}
      <MobileSidebar profile={profile} onSignOut={signOut} />

      <main className="flex-1 overflow-hidden min-w-0">
        {/* Search bar header */}
        <div className="h-12 border-b bg-card/80 backdrop-blur px-4 md:px-6 flex items-center justify-end gap-2 sticky top-0 z-10">
          <button
            onClick={() => setPaletteOpen(true)}
            className="flex items-center gap-2 text-sm text-muted-foreground border rounded-lg px-3 py-1.5 hover:bg-muted/50 transition-colors w-48 md:w-64"
          >
            <Search className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1 text-left">Search...</span>
            <kbd className="hidden sm:flex items-center gap-0.5 text-xs border rounded px-1">
              <span>⌘</span>K
            </kbd>
          </button>
        </div>
        <div className="overflow-auto">
          {children}
        </div>
      </main>

      {/* Command Palette */}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />

      {/* Onboarding Wizard */}
      {showOnboarding && profile && (
        <OnboardingWizard profile={profile} onComplete={handleOnboardingComplete} />
      )}
    </div>
  )
}
