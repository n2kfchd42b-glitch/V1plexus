"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, FolderOpen, ClipboardList, Bell, Settings, Command, Database
} from 'lucide-react'
import { cn } from '@/lib/utils'

const personalNav = [
  { href: '/dashboard',     label: 'Dashboard',     icon: LayoutDashboard, shortcut: 'G D' },
  { href: '/projects',      label: 'My Projects',   icon: FolderOpen,      shortcut: 'G P' },
  { href: '/reviews',       label: 'Reviews',       icon: ClipboardList,   shortcut: 'G R' },
  { href: '/notifications', label: 'Notifications', icon: Bell,            shortcut: 'G N' },
  { href: '/settings',      label: 'Settings',      icon: Settings },
]

interface PersonalSidebarProps {
  collapsed: boolean
  onCommandPalette?: () => void
}

export function PersonalSidebar({ collapsed, onCommandPalette }: PersonalSidebarProps) {
  const pathname = usePathname()

  const projectMatch = pathname.match(/\/projects\/([^/]+)/)
  const projectId = projectMatch?.[1]
  const dataHref = projectId ? `/projects/${projectId}/data` : null
  const dataActive = dataHref ? pathname.startsWith(dataHref) : false

  return (
    <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
      {personalNav.map(item => {
        const Icon = item.icon
        const active = pathname === item.href || pathname.startsWith(item.href + '/')
        return (
          <Link key={item.href} href={item.href} title={collapsed ? item.label : undefined}>
            <div className={cn(
              'relative flex items-center gap-3 h-8 rounded-md transition-all duration-150 ease-out cursor-pointer select-none',
              collapsed ? 'justify-center px-0 w-8 mx-auto' : 'px-2.5',
              active
                ? 'bg-[#3F3F46] text-white'
                : 'text-[#A1A1AA] hover:bg-[#27272A] hover:text-white/80'
            )}>
              {active && (
                <div className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-[#3B82F6]" />
              )}
              <Icon className={cn('flex-shrink-0 h-4 w-4', active ? 'text-white' : 'text-[#71717A]')} />
              {!collapsed && (
                <span className={cn('text-sm font-medium', active ? 'text-white' : 'text-[#A1A1AA]')}>
                  {item.label}
                </span>
              )}
            </div>
          </Link>
        )
      })}

      <div className="my-2 h-px bg-white/10" />

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

      {dataHref && (
        <>
          <div className="pt-3 pb-1">
            {!collapsed && (
              <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider px-2.5 mb-1">
                Current Project
              </p>
            )}
          </div>
          <Link href={dataHref}>
            <div className={cn(
              'relative flex items-center gap-3 h-8 rounded-md transition-all duration-150 ease-out cursor-pointer select-none',
              collapsed ? 'justify-center px-0 w-8 mx-auto' : 'px-2.5',
              dataActive
                ? 'bg-[#3F3F46] text-white'
                : 'text-[#A1A1AA] hover:bg-[#27272A] hover:text-white/80'
            )}>
              {dataActive && <div className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-[#3B82F6]" />}
              <Database className={cn('flex-shrink-0 h-4 w-4', dataActive ? 'text-white' : 'text-[#71717A]')} />
              {!collapsed && (
                <span className={cn('text-sm font-medium', dataActive ? 'text-white' : 'text-[#A1A1AA]')}>
                  Data
                </span>
              )}
            </div>
          </Link>
        </>
      )}
    </nav>
  )
}
