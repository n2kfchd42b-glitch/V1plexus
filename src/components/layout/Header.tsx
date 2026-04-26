"use client"

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, Search } from 'lucide-react'
import { NotificationBell } from '@/components/notification/NotificationBell'
import { cn, getInitials } from '@/lib/utils'
import type { Profile } from '@/types/database'

interface HeaderProps {
  profile: Profile | null
  title?: string
  onSearchClick?: () => void
}

function useBreadcrumbs(pathname: string) {
  const segments = pathname.split('/').filter(Boolean)
  const crumbs: { label: string; href: string }[] = []

  const labelMap: Record<string, string> = {
    dashboard:     'Dashboard',
    projects:      'Projects',
    reviews:       'Reviews',
    notifications: 'Notifications',
    analysis:      'Analysis',
    documents:     'Documents',
    new:           'New',
    settings:      'Settings',
    data:          'Data',
    timeline:      'Timeline',
    output:        'Report',
    overview:      'Overview',
    report:        'Report',
    ethics:        'Ethics',
    team:          'Team',
    audit:         'Audit',
  }

  segments.forEach((seg, i) => {
    const href = '/' + segments.slice(0, i + 1).join('/')
    const isId = /^[0-9a-f-]{36}$/.test(seg) || /^[0-9a-f]{20,}$/.test(seg)
    if (isId) return // skip UUIDs — they add noise without meaning
    const label = labelMap[seg] ?? seg.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    crumbs.push({ label, href })
  })

  return crumbs
}

export function Header({ profile, title, onSearchClick }: HeaderProps) {
  const pathname    = usePathname()
  const breadcrumbs = useBreadcrumbs(pathname)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    // Query inside the effect so we always get the current DOM element
    const el = document.querySelector<HTMLElement>('main')
    if (!el) return
    const handler = () => setScrolled(el.scrollTop > 4)
    el.addEventListener('scroll', handler, { passive: true })
    return () => el.removeEventListener('scroll', handler)
  // Re-attach if the pathname changes (Next.js may swap the <main> element)
  }, [pathname])

  return (
    <header
      className={cn(
        'h-16 px-6 flex items-center justify-between sticky top-0 z-20',
        'bg-[var(--bg-surface)] border-b transition-all duration-150',
        scrolled
          ? 'border-[var(--border-default)] shadow-xs'
          : 'border-[var(--border-subtle)]'
      )}
    >
      {/* Breadcrumbs — pl-12 on mobile reserves space for the hamburger button */}
      <nav className="flex items-center gap-1.5 min-w-0 pl-12 md:pl-0">
        {breadcrumbs.map((crumb, i) => (
          <div key={crumb.href} className="flex items-center gap-1.5 min-w-0">
            {i > 0 && (
              <ChevronRight className="h-3.5 w-3.5 text-[var(--text-tertiary)] flex-shrink-0" />
            )}
            {i === breadcrumbs.length - 1 ? (
              <span className="text-sm font-semibold text-[var(--text-primary)] truncate">
                {title ?? crumb.label}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="text-sm text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors truncate"
              >
                {crumb.label}
              </Link>
            )}
          </div>
        ))}
      </nav>

      {/* Right actions */}
      <div className="flex items-center gap-4">
        {/* Desktop search bar with ⌘K hint */}
        <button
          onClick={onSearchClick}
          className="hidden md:flex items-center gap-2 bg-[var(--bg-inset)] border border-[var(--border-row)] rounded-lg px-3.5 py-2 text-xs w-56 text-[var(--text-tertiary)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface-hover)] transition-colors cursor-text"
        >
          <Search className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="flex-1 text-left">Search…</span>
          <kbd className="text-[10px] font-mono bg-[var(--bg-surface)] border border-[var(--border-default)] rounded px-1.5 py-0.5 text-[var(--text-tertiary)]">⌘K</kbd>
        </button>

        {/* Mobile search icon — 48 × 48 tap target */}
        <button
          onClick={onSearchClick}
          aria-label="Search"
          className="md:hidden flex items-center justify-center h-12 w-12 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors"
        >
          <Search className="h-5 w-5" />
        </button>

        {/* Notifications */}
        {profile && <NotificationBell userId={profile.id} />}

        {/* Avatar → settings */}
        {profile && (
          <Link href="/settings" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-semibold text-[var(--text-primary)] leading-tight">
                {profile.full_name ?? 'User'}
              </p>
            </div>
            <div className="w-8 h-8 rounded-full bg-[var(--accent-primary)] flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 ring-2 ring-[var(--border-default)]">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
              ) : (
                getInitials(profile.full_name)
              )}
            </div>
          </Link>
        )}
      </div>
    </header>
  )
}
