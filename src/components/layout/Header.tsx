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
    const el = document.querySelector('main')
    if (!el) return
    const handler = () => setScrolled(el.scrollTop > 4)
    el.addEventListener('scroll', handler, { passive: true })
    return () => el.removeEventListener('scroll', handler)
  }, [])

  return (
    <header
      className={cn(
        'h-12 px-5 flex items-center justify-between sticky top-0 z-20',
        'bg-[var(--bg-surface)] border-b transition-all duration-150',
        scrolled
          ? 'border-[var(--border-default)] shadow-xs'
          : 'border-[var(--border-subtle)]'
      )}
    >
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1 min-w-0">
        {breadcrumbs.map((crumb, i) => (
          <div key={crumb.href} className="flex items-center gap-1 min-w-0">
            {i > 0 && (
              <ChevronRight className="h-3 w-3 text-[var(--text-tertiary)] flex-shrink-0" />
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
      <div className="flex items-center gap-3">
        {/* Search with ⌘K hint */}
        <button
          onClick={onSearchClick}
          className="hidden md:flex items-center gap-2 bg-[var(--bg-inset)] border border-[var(--border-row)] rounded-md px-3 py-1.5 text-xs w-52 text-[var(--text-tertiary)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface-hover)] transition-colors cursor-text"
        >
          <Search className="h-3 w-3 flex-shrink-0" />
          <span className="flex-1 text-left">Search…</span>
          <kbd className="text-[10px] font-mono bg-[var(--bg-surface)] border border-[var(--border-default)] rounded px-1.5 py-0.5 text-[var(--text-tertiary)]">⌘K</kbd>
        </button>

        {/* Notifications */}
        {profile && <NotificationBell userId={profile.id} />}

        {/* Avatar → settings */}
        {profile && (
          <Link href="/settings" className="flex items-center gap-2">
            <div className="hidden sm:block text-right">
              <p className="text-xs font-semibold text-[var(--text-primary)] leading-none">
                {profile.full_name ?? 'User'}
              </p>
              {profile.role && (
                <p className="text-[10px] text-[var(--text-tertiary)] capitalize mt-0.5">{profile.role}</p>
              )}
            </div>
            <div className="w-7 h-7 rounded-full bg-[var(--accent-primary)] flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
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
