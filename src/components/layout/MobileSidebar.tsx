"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  FolderOpen, LogOut, Menu, X, Command,
  LayoutDashboard, Database, BarChart2, BookOpen, GraduationCap, Settings2,
  ClipboardList, Award, Users, UserPlus, FileSearch, Mail, ScrollText, Shield, Building2,
} from 'lucide-react'
import { BrandLogo } from '@/components/layout/BrandLogo'
import { LanguageSelector } from '@/components/i18n/LanguageSelector'
import { useTranslations } from '@/i18n/useTranslations'
import { createClient } from '@/lib/supabase/client'
import { cn, getInitials } from '@/lib/utils'
import { REVIEWS_ENABLED } from '@/lib/flags'
import type { Profile } from '@/types/database'

interface MobileSidebarProps {
  profile: Profile | null
  onSignOut: () => void
}

export function MobileSidebar({ profile, onSignOut }: MobileSidebarProps) {
  const [open, setOpen] = useState(false)
  const [isThesis, setIsThesis] = useState(false)
  const [isInstitutionAdmin, setIsInstitutionAdmin] = useState(false)
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false)
  const pathname = usePathname()
  const { t } = useTranslations()

  // Close drawer on any route change
  useEffect(() => { setOpen(false) }, [pathname])

  // Authoritative role check — mirrors WorkspaceSidebar so the mobile drawer
  // surfaces the same Institution / Platform admin groups.
  useEffect(() => {
    if (!profile) return
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/me/roles', { cache: 'no-store' })
        if (!res.ok || cancelled) return
        const data = await res.json() as {
          is_platform_admin?: boolean
          is_institution_admin?: boolean
        }
        setIsInstitutionAdmin(data.is_institution_admin === true)
        setIsPlatformAdmin(data.is_platform_admin === true)
      } catch { /* leave previous state */ }
    })()
    return () => { cancelled = true }
  }, [profile])

  // Detect if we're inside a project
  const projectMatch = pathname.match(/^\/projects\/([^/]+)/)
  const projectId    = projectMatch?.[1] ?? null
  const isInProject  = !!projectId && projectId !== 'new'

  // Resolve project type to show correct tabs
  useEffect(() => {
    if (!projectId || !isInProject) { setIsThesis(false); return }
    const supabase = createClient()
    supabase
      .from('projects')
      .select('project_type')
      .eq('id', projectId)
      .maybeSingle()
      .then(({ data }) => setIsThesis((data as { project_type?: string } | null)?.project_type === 'thesis'))
  }, [projectId, isInProject])

  const TOP_NAV = [
    { href: '/projects', labelKey: 'nav.projects', icon: FolderOpen    },
    ...(REVIEWS_ENABLED
      ? [{ href: '/reviews', labelKey: 'nav.reviews', icon: ClipboardList }]
      : []),
  ]

  const RESEARCH_TABS = [
    { slug: 'overview',  label: 'Overview', icon: LayoutDashboard },
    { slug: 'data',      label: 'Data',     icon: Database        },
    { slug: 'analysis',  label: 'Analysis', icon: BarChart2       },
    { slug: 'documents', label: 'Writing',  icon: BookOpen        },
  ]

  const THESIS_TABS = [
    { slug: 'overview',  label: 'Overview', icon: LayoutDashboard },
    { slug: 'chapters',  label: 'Chapters', icon: GraduationCap  },
    { slug: 'data',      label: 'Data',     icon: Database        },
    { slug: 'analysis',  label: 'Analysis', icon: BarChart2       },
    { slug: 'documents', label: 'Writing',  icon: BookOpen        },
    { slug: 'defense',   label: 'Defense',  icon: Award           },
    { slug: 'setup',     label: 'Setup',    icon: Settings2       },
  ]

  const projectTabs = isThesis ? THESIS_TABS : RESEARCH_TABS

  return (
    <>
      {/* Hamburger button — sits inside the 64px header row */}
      <button
        className="md:hidden fixed top-0 left-0 z-50 h-16 w-12 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        onClick={() => setOpen(true)}
        aria-label={t('nav.projects', 'Open menu')}
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

      {/* Drawer */}
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
            aria-label={t('common.close', 'Close menu')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="relative z-10 flex-1 px-2 py-3 overflow-y-auto">
          <p className="px-2.5 pt-0.5 pb-1.5 text-[9px] font-medium uppercase tracking-[0.10em] text-[var(--text-sidebar-icon)]">
            {t('nav.workspace', 'Workspace')}
          </p>

          {TOP_NAV.map(({ href, labelKey, icon: Icon }) => {
            const label  = t(labelKey)
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
                {isThesis ? 'Thesis' : t('nav.thisProject', 'This Project')}
              </p>
              {projectTabs.map(({ slug, label, icon: Icon }) => {
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

          {isInstitutionAdmin && (
            <>
              <div className="my-2 h-px bg-white/10" />
              <p className="px-2.5 pt-0.5 pb-1.5 text-[9px] font-medium uppercase tracking-[0.10em] text-[var(--text-sidebar-icon)]">
                Institution
              </p>
              {[
                { href: '/institution',               icon: LayoutDashboard, label: 'Overview',      exact: true },
                { href: '/institution/members',       icon: Users,           label: 'Members' },
                { href: '/institution/departments',   icon: Building2,       label: 'Departments' },
                { href: '/institution/policy',        icon: ScrollText,      label: 'Thesis policy' },
                { href: '/institution/link-requests', icon: UserPlus,        label: 'Link requests' },
                { href: '/institution/audit',         icon: FileSearch,      label: 'Audit' },
                { href: '/institution/inquiries',     icon: Mail,            label: 'Inquiries' },
              ].map(({ href, icon: Icon, label, exact }) => {
                const active = exact ? pathname === href : (pathname === href || pathname.startsWith(href + '/'))
                return (
                  <Link key={href} href={href}>
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

          {isPlatformAdmin && (
            <>
              <div className="my-2 h-px bg-white/10" />
              <p className="px-2.5 pt-0.5 pb-1.5 text-[9px] font-medium uppercase tracking-[0.10em] text-[var(--text-sidebar-icon)]">
                Platform
              </p>
              <Link href="/admin/institutions">
                <div className={cn(
                  'flex items-center gap-3 h-11 rounded-md px-3 mb-0.5 transition-all duration-150 cursor-pointer select-none',
                  pathname.startsWith('/admin/institutions')
                    ? 'bg-[var(--bg-sidebar-active)] text-white'
                    : 'text-[var(--text-sidebar)] hover:bg-[var(--bg-sidebar-hover)] hover:text-white/80'
                )}>
                  <Shield className={cn('h-5 w-5 flex-shrink-0', pathname.startsWith('/admin/institutions') ? 'text-white' : 'text-[var(--text-sidebar-icon)]')} />
                  <span className="text-sm font-medium">Institutions</span>
                </div>
              </Link>
            </>
          )}

          <div className="my-2 h-px bg-white/10" />

          <p className="px-2.5 pt-0.5 pb-1.5 text-[9px] font-medium uppercase tracking-[0.10em] text-[var(--text-sidebar-icon)]">
            {t('nav.tools', 'Tools')}
          </p>

          <div className="flex items-center gap-3 h-11 rounded-md px-3 mb-0.5 text-[var(--text-sidebar)] cursor-default select-none">
            <Command className="h-5 w-5 flex-shrink-0 text-[var(--text-sidebar-icon)]" />
            <span className="text-sm font-medium flex-1">{t('nav.commandPalette', 'Command Palette')}</span>
            <kbd className="text-[10px] text-[var(--text-sidebar-icon)] bg-white/5 border border-white/10 rounded px-1.5 py-0.5 font-mono">⌘K</kbd>
          </div>
        </nav>

        {/* User footer */}
        <div className="relative z-10 border-t border-white/10 flex-shrink-0">
          <div className="px-3 py-3 flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-[var(--accent-primary)] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              {profile?.avatar_url ? (
                <Image src={profile.avatar_url} alt="" width={36} height={36} className="h-9 w-9 rounded-full object-cover" />
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
              title={t('nav.signOut', 'Sign out')}
              className="h-10 w-10 flex items-center justify-center rounded-lg text-[var(--text-sidebar-icon)] hover:text-[var(--status-error)] hover:bg-red-950/30 transition-colors flex-shrink-0"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>

          {/* Language selector */}
          <div className="px-3 pb-3">
            <LanguageSelector className="w-full" />
          </div>
        </div>
      </aside>
    </>
  )
}
