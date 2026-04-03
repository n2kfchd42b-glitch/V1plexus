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

// Build breadcrumbs from pathname
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
  }

  segments.forEach((seg, i) => {
    const href = '/' + segments.slice(0, i + 1).join('/')
    // Skip UUIDs in display but include in href
    const isId = /^[0-9a-f-]{36}$/.test(seg) || /^[0-9a-f]{20,}$/.test(seg)
    const label = isId ? '…' : (labelMap[seg] ?? seg.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()))
    crumbs.push({ label, href })
  })

  return crumbs
}

export function Header({ profile, title, onSearchClick }: HeaderProps) {
  const pathname = usePathname()
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
        'h-16 px-8 flex items-center justify-between sticky top-0 z-20 transition-all duration-150',
        'bg-white/90 backdrop-blur-md',
        scrolled
          ? 'border-b border-slate-200'
          : 'border-b border-slate-100'
      )}
    >
      {/* Breadcrumbs */}
      <div className="flex items-center gap-4">
        <nav className="flex items-center gap-1 min-w-0">
          {breadcrumbs.map((crumb, i) => (
            <div key={crumb.href} className="flex items-center gap-1 min-w-0">
              {i > 0 && (
                <ChevronRight className="h-3.5 w-3.5 text-slate-300 flex-shrink-0" />
              )}
              {i === breadcrumbs.length - 1 ? (
                <span className="text-sm font-bold text-slate-800 font-manrope truncate">
                  {title ?? crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="text-sm text-slate-400 hover:text-slate-600 transition-colors duration-100 truncate"
                >
                  {crumb.label}
                </Link>
              )}
            </div>
          ))}
        </nav>
        {profile?.role && (
          <>
            <span className="text-slate-200">|</span>
            <span className="text-[11px] font-bold text-slate-400 capitalize">{profile.role}</span>
          </>
        )}
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-6">
        {/* Search — opens command palette */}
        <button
          onClick={onSearchClick}
          className="relative hidden md:flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg py-1.5 pl-9 pr-4 text-xs w-64 text-slate-400 hover:border-slate-300 hover:bg-slate-100 transition-all cursor-text"
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
          <span>Search projects, documents…</span>
          <kbd className="ml-auto text-[10px] font-mono bg-white border border-slate-200 rounded px-1.5 py-0.5 text-slate-400">⌘K</kbd>
        </button>

        <div className="flex items-center gap-3">
          {profile && (
            <Link
              href="/profile/me"
              title="My Research Portfolio"
              className="hidden md:flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#0052cc] transition-colors px-2 py-1 rounded-lg hover:bg-slate-50"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              Portfolio
            </Link>
          )}
          {profile && <NotificationBell userId={profile.id} />}
          {profile && (
            <Link href="/settings" className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-slate-900 leading-none">{profile.full_name ?? 'User'}</p>
                <p className="text-[10px] text-slate-500 font-medium capitalize">{profile.role}</p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-clinical-blue flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-8 h-8 rounded-lg object-cover" />
                ) : (
                  getInitials(profile.full_name)
                )}
              </div>
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
