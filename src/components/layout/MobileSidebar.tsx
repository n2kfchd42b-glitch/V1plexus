"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  FolderOpen, LogOut, Menu, X, Command,
  LayoutDashboard, Database, BarChart2, Clock, BookOpen, FileText, Settings,
  ClipboardList, Bell,
} from 'lucide-react'
import { BrandLogo } from '@/components/layout/BrandLogo'
import { cn, getInitials } from '@/lib/utils'
import type { Profile } from '@/types/database'

const TOP_NAV = [
  { href: '/projects',      label: 'Projects',       icon: FolderOpen      },
  { href: '/reviews',       label: 'Reviews',        icon: ClipboardList   },
  { href: '/notifications', label: 'Notifications',  icon: Bell            },
  { href: '/settings',      label: 'Settings',       icon: Settings        },
]

const PROJECT_TABS = [
  { slug: 'overview',  label: 'Overview',  icon: LayoutDashboard },
  { slug: 'data',      label: 'Data',      icon: Database        },
  { slug: 'analysis',  label: 'Analysis',  icon: BarChart2       },
  { slug: 'timeline',  label: 'Timeline',  icon: Clock           },
  { slug: 'documents', label: 'Documents', icon: BookOpen        },
  { slug: 'report',    label: 'Report',    icon: FileText        },
  { slug: 'settings',  label: 'Settings',  icon: Settings        },
]

interface MobileSidebarProps {
  profile: Profile | null
  onSignOut: () => void
}

export function MobileSidebar({ profile, onSignOut }: MobileSidebarProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // Close drawer on any route change
  useEffect(() => { setOpen(false) }, [pathname])

  // Detect if we're inside a project
  const projectMatch = pathname.match(/^\/projects\/([^/]+)/)
  const projectId    = projectMatch?.[1] ?? null
  const isInProject  = !!projectId && projectId !== 'new'

  return (
    <>
      {/* Hamburger button — sits inside the 64px header row */}
      <button
        className="md:hidden fixed top-0 left-0 z-50 h-16 w-12 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer — responsive width, matches dark sidebar design */}
      <aside
        className={cn(
          'md:hidden fixed inset-y-0 left-0 z-50 flex flex-col',
          'w-[min(320px,85vw)]',
          'bg-[var(--bg-sidebar)] border-r border-white/10',
          'transition-transform duration-300 ease-out',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Radial glow accent */}
        <div
          className="absolute top-0 left-0 w-40 h-40 pointer-events-none"
          style={{ background: 'radial-gradient(circle at top left, rgba(59,130,246,0.18) 0%, transparent 60%)' }}
        />

        {/* Header */}
        <div className="relative z-10 flex items-center justify-between h-16 px-4 border-b border-white/10 flex-shrink-0">
          <BrandLogo variant="dark" />
          <button
            onClick={() => setOpen(false)}
            className="h-10 w-10 flex items-center justify-center rounded-lg text-[var(--text-sidebar-icon)] hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="relative z-10 flex-1 px-2 py-3 overflow-y-auto">
          <p className="px-2.5 pt-0.5 pb-1.5 text-[9px] font-medium uppercase tracking-[0.10em] text-[var(--text-sidebar-icon)]">
            Workspace
          </p>

          {TOP_NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link key={href} href={href}>
                <div className={cn(
                  'flex items-center gap-3 h-11 rounded-md px-3 mb-0.5 transition-all duration-150 cursor-pointer select-none',
                  active
                    ? 'bg-[var(--bg-sidebar-active)] text-white'
                    : 'text-[var(--text-sidebar)] hover:bg-[var(--bg-sidebar-hover)] hover:text-white/80'
                )}>
                  {active && (
                    <div className="absolute left-2 w-0.5 h-5 bg-[var(--accent-primary)] rounded-full" />
                  )}
                  <Icon className={cn('h-5 w-5 flex-shrink-0', active ? 'text-white' : 'text-[var(--text-sidebar-icon)]')} />
                  <span className="text-sm font-medium">{label}</span>
                </div>
              </Link>
            )
          })}

          {/* Project sub-nav — shown when inside a project */}
          {isInProject && projectId && (
            <>
              <div className="my-2 h-px bg-white/10" />
              <p className="px-2.5 pt-0.5 pb-1.5 text-[9px] font-medium uppercase tracking-[0.10em] text-[var(--text-sidebar-icon)]">
                This Project
              </p>
              {PROJECT_TABS.map(({ slug, label, icon: Icon }) => {
                const href   = `/projects/${projectId}/${slug}`
                const active = pathname === href || pathname.startsWith(href + '/')
                return (
                  <Link key={slug} href={href}>
                    <div className={cn(
                      'flex items-center gap-3 h-11 rounded-md px-3 mb-0.5 transition-all duration-150 cursor-pointer select-none',
                      active
                        ? 'bg-[var(--bg-sidebar-active)] text-white'
                        : 'text-[var(--text-sidebar)] hover:bg-[var(--bg-sidebar-hover)] hover:text-white/80'
                    )}>
                      <Icon className={cn('h-5 w-5 flex-shrink-0', active ? 'text-white' : 'text-[var(--text-sidebar-icon)]')} />
                      <span className="text-sm font-medium">{label}</span>
                    </div>
                  </Link>
                )
              })}
            </>
          )}

          <div className="my-2 h-px bg-white/10" />

          <p className="px-2.5 pt-0.5 pb-1.5 text-[9px] font-medium uppercase tracking-[0.10em] text-[var(--text-sidebar-icon)]">
            Tools
          </p>

          <div className="flex items-center gap-3 h-11 rounded-md px-3 mb-0.5 text-[var(--text-sidebar)] cursor-default select-none">
            <Command className="h-5 w-5 flex-shrink-0 text-[var(--text-sidebar-icon)]" />
            <span className="text-sm font-medium flex-1">Command Palette</span>
            <kbd className="text-[10px] text-[var(--text-sidebar-icon)] bg-white/5 border border-white/10 rounded px-1.5 py-0.5 font-mono">⌘K</kbd>
          </div>
        </nav>

        {/* User footer */}
        <div className="relative z-10 border-t border-white/10 px-3 py-3 flex items-center gap-3 flex-shrink-0">
          <div className="h-9 w-9 rounded-full bg-[var(--accent-primary)] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
            ) : (
              getInitials(profile?.full_name)
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white/90 truncate leading-tight">{profile?.full_name ?? 'Researcher'}</p>
            <p className="text-[11px] text-[var(--text-sidebar-icon)] truncate capitalize">{profile?.role ?? 'Researcher'}</p>
          </div>
          <button
            onClick={() => { setOpen(false); onSignOut() }}
            title="Sign out"
            className="h-10 w-10 flex items-center justify-center rounded-lg text-[var(--text-sidebar-icon)] hover:text-[var(--status-error)] hover:bg-red-950/30 transition-colors flex-shrink-0"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </aside>
    </>
  )
}
