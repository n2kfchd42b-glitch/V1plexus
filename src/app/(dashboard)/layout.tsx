"use client"

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { CommandPalette } from '@/components/layout/CommandPalette'
import { ShortcutOverlay } from '@/components/layout/ShortcutOverlay'
import { MobileSidebar } from '@/components/layout/MobileSidebar'
import { WorkspaceSidebar } from '@/components/layout/WorkspaceSidebar'
import { WorkspaceProvider } from '@/components/workspace/WorkspaceProvider'
import { useAuth } from '@/hooks/useAuth'
import { useGlobalShortcuts } from '@/hooks/useKeyboardShortcuts'
import { OfflineBanner } from '@/components/offline/OfflineBanner'
import { Toaster } from 'sonner'

function DashboardContent({ children }: { children: React.ReactNode }) {
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
    <div className="flex min-h-screen bg-[var(--bg-app)]">
      <OfflineBanner />
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

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header profile={profile} />
        <main className="flex-1 overflow-hidden">
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
