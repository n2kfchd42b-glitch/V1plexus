"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, FolderOpen, ClipboardList, Bell,
  LogOut, ChevronLeft, ChevronRight, Command,
  Database, Settings, Shield, ClipboardCheck, Users, GraduationCap,
  BarChart3, DollarSign, BookOpen, PackageOpen
} from 'lucide-react'
import { BrandLogo } from '@/components/layout/BrandLogo'
import { cn, getInitials } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { Profile } from '@/types/database'
import { THESIS_ENABLED, INSTITUTIONAL_INTELLIGENCE_ENABLED } from '@/lib/flags'

const navItems = [
  { href: '/dashboard',     label: 'Dashboard', icon: LayoutDashboard, shortcut: 'G D' },
  { href: '/reviews',       label: 'Reviews',   icon: ClipboardList,   shortcut: 'G R' },
  { href: '/approvals',     label: 'Approvals', icon: Shield,          shortcut: 'G A' },
  { href: '/notifications', label: 'Inbox',     icon: Bell,            shortcut: 'G N' },
  { href: '/settings/sso',  label: 'SSO Settings', icon: Settings, adminOnly: true },
]

const institutionItems = [
  { href: '/institution/members',    label: 'Members',        icon: Users },
  { href: '/institution/compliance', label: 'Compliance',     icon: ClipboardCheck },
  { href: '/institution/audit',      label: 'Audit Log',      icon: Shield },
  ...(THESIS_ENABLED ? [{ href: '/graduate', label: 'Graduate Theses', icon: GraduationCap }] : []),
  ...(INSTITUTIONAL_INTELLIGENCE_ENABLED ? [
    { href: '/institution/impact',    label: 'Research Impact', icon: BarChart3 },
    { href: '/institution/grants',    label: 'Grants',          icon: DollarSign },
    { href: '/institution/knowledge', label: 'Knowledge Base',  icon: BookOpen },
  ] : []),
]

interface SidebarProps {
  profile: Profile | null
  onSignOut: () => void
  onCommandPalette?: () => void
}

export function Sidebar({ profile, onSignOut, onCommandPalette }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(true)
  const [activeIndex, setActiveIndex] = useState(0)
  const [prevIndex, setPrevIndex] = useState(0)

  // Collapse sidebar on navigation
  useEffect(() => {
    setCollapsed(true)
  }, [pathname])

  // Track active item index for sliding indicator
  useEffect(() => {
    const idx = navItems.findIndex(item =>
      pathname === item.href || pathname.startsWith(item.href + '/')
    )
    if (idx !== -1 && idx !== activeIndex) {
      setPrevIndex(activeIndex)
      setActiveIndex(idx)
    }
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard shortcut: Cmd+\ to toggle sidebar
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault()
        setCollapsed(c => !c)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Extract project ID if we're inside a project route
  const projectMatch = pathname.match(/\/projects\/([^/]+)/)
  const projectId = projectMatch?.[1]
  const dataHref = projectId ? `/projects/${projectId}/data` : null
  const dataActive = dataHref ? pathname.startsWith(dataHref) : false

  return (
    <aside
      className={cn(
        'flex flex-col h-screen sticky top-0 transition-all duration-200 ease-out flex-shrink-0',
        'bg-[#18181B] border-r border-white/10',
        collapsed ? 'w-12' : 'w-60'
      )}
    >
      {/* Logo area */}
      <div className={cn(
        'flex items-center border-b border-white/10 transition-all duration-200',
        collapsed ? 'h-12 justify-center px-0' : 'h-14 px-4 gap-2'
      )}>
        <BrandLogo variant="dark" collapsed={collapsed} />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {navItems.filter(item => !item.adminOnly || profile?.role === 'admin').map((item) => {
          const Icon = item.icon
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link key={item.href} href={item.href} title={collapsed ? item.label : undefined}>
              <div
                className={cn(
                  'relative flex items-center gap-3 h-8 rounded-md transition-all duration-150 ease-out cursor-pointer select-none',
                  collapsed ? 'justify-center px-0 w-8 mx-auto' : 'px-2.5',
                  active
                    ? 'bg-[#3F3F46] text-white'
                    : 'text-[#A1A1AA] hover:bg-[#27272A] hover:text-white/80'
                )}
              >
                {/* Active left border */}
                {active && (
                  <div className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-[#3B82F6]" />
                )}
                <Icon className={cn(
                  'flex-shrink-0 transition-colors duration-150',
                  'h-4 w-4',
                  active ? 'text-white' : 'text-[#71717A]'
                )} />
                {!collapsed && (
                  <span className={cn(
                    'text-sm font-medium transition-opacity duration-100',
                    active ? 'text-white' : 'text-[#A1A1AA]'
                  )}>
                    {item.label}
                  </span>
                )}
              </div>
            </Link>
          )
        })}

        {/* Divider */}
        <div className="my-2 h-px bg-white/10" />

        {/* Command palette shortcut */}
        <button
          onClick={onCommandPalette}
          title={collapsed ? 'Command Palette (⌘K)' : undefined}
          className={cn(
            'w-full flex items-center gap-3 h-8 rounded-md transition-all duration-150 ease-out cursor-pointer select-none text-left',
            collapsed ? 'justify-center px-0 w-8 mx-auto' : 'px-2.5',
            'text-[#A1A1AA] hover:bg-[#27272A] hover:text-white/80'
          )}
        >
          <Command className="h-4 w-4 text-[#71717A] flex-shrink-0" />
          {!collapsed && (
            <div className="flex items-center justify-between flex-1 min-w-0">
              <span className="text-sm font-medium text-[#A1A1AA]">Command</span>
              <kbd className="text-[10px] text-[#71717A] bg-white/5 border border-white/10 rounded px-1 py-0.5 font-mono">⌘K</kbd>
            </div>
          )}
        </button>

        {/* Contextual data + output links when inside a project */}
        {dataHref && (
          <>
            <div className="pt-3 pb-1">
              <p className="text-xs font-medium text-muted-foreground px-3 uppercase tracking-wider">Current Project</p>
            </div>
            <Link href={dataHref}>
              <Button
                variant={dataActive ? 'secondary' : 'ghost'}
                className={cn('w-full justify-start gap-3', dataActive && 'font-medium')}
              >
                <Database className="h-4 w-4" />
                Data
              </Button>
            </Link>
            {(() => {
              const outputHref = `/projects/${projectId}/output`
              const outputActive = pathname.startsWith(outputHref)
              return (
                <Link href={outputHref} title={collapsed ? 'Output' : undefined}>
                  <Button
                    variant={outputActive ? 'secondary' : 'ghost'}
                    className={cn('w-full justify-start gap-3', outputActive && 'font-medium')}
                  >
                    <PackageOpen className="h-4 w-4" />
                    {!collapsed && 'Output'}
                  </Button>
                </Link>
              )
            })()}
          </>
        )}

        <div className="pt-3 pb-1">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-1">Institution</p>
          {institutionItems.map(item => {
            const Icon = item.icon
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={active ? 'secondary' : 'ghost'}
                  className={cn('w-full justify-start gap-3', active && 'font-medium')}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Button>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* User + collapse controls */}
      <div className="border-t border-white/10">
        {/* User info */}
        <div className={cn(
          'flex items-center gap-2.5 transition-all duration-200',
          collapsed ? 'px-2 py-2 justify-center' : 'px-3 py-3'
        )}>
          <div className={cn(
            'flex items-center justify-center rounded-full bg-[#1B3A5C] text-white text-xs font-bold flex-shrink-0',
            'h-7 w-7'
          )}>
            {getInitials(profile?.full_name)}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white/90 truncate leading-tight">
                {profile?.full_name ?? 'User'}
              </p>
              <p className="text-xs text-[#71717A] capitalize truncate">
                {profile?.role}
              </p>
            </div>
          )}
        </div>

        {/* Sign out + collapse row */}
        <div className={cn(
          'flex items-center border-t border-white/5 transition-all duration-200',
          collapsed ? 'flex-col px-2 py-2 gap-1' : 'px-2 py-2 gap-1'
        )}>
          <button
            onClick={onSignOut}
            title="Sign out"
            className={cn(
              'flex items-center gap-2 h-7 rounded-md transition-colors duration-150 text-[#71717A] hover:text-[#EF4444] hover:bg-red-950/30',
              collapsed ? 'w-8 justify-center px-0' : 'flex-1 px-2.5'
            )}
          >
            <LogOut className="h-3.5 w-3.5 flex-shrink-0" />
            {!collapsed && <span className="text-xs">Sign out</span>}
          </button>

          <button
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? 'Expand sidebar (⌘\\)' : 'Collapse sidebar (⌘\\)'}
            className="flex items-center justify-center h-7 w-7 rounded-md text-[#71717A] hover:text-white hover:bg-[#27272A] transition-colors duration-150 flex-shrink-0"
          >
            {collapsed
              ? <ChevronRight className="h-3.5 w-3.5" />
              : <ChevronLeft className="h-3.5 w-3.5" />
            }
          </button>
        </div>
      </div>
    </aside>
  )
}
