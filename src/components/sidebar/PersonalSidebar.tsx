"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, FolderOpen, ClipboardList, Bell, Settings, Command, Database, Activity, Download,
  Network, ShieldCheck, FileSignature, FileText
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { NETWORK_COMPLIANCE_ENABLED } from '@/lib/flags'

const personalNav = [
  { href: '/dashboard',     label: 'Dashboard',     icon: LayoutDashboard, shortcut: 'G D' },
  { href: '/projects',      label: 'My Projects',   icon: FolderOpen,      shortcut: 'G P' },
  { href: '/reviews',       label: 'Reviews',       icon: ClipboardList,   shortcut: 'G R' },
  { href: '/notifications', label: 'Notifications', icon: Bell,            shortcut: 'G N' },
  { href: '/exports',       label: 'Exports',       icon: Download },
  { href: '/audit',         label: 'Audit Trail',   icon: Activity },
  { href: '/settings',      label: 'Settings',      icon: Settings },
]

const networkNav = [
  { href: '/network',    label: 'Research Network', icon: Network },
  { href: '/compliance', label: 'Compliance',       icon: ShieldCheck },
  { href: '/consent',    label: 'Consent',          icon: FileSignature },
  { href: '/dmp',        label: 'Data Plans',       icon: FileText },
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
                ? 'bg-[#EFF6FF] text-[#0052CC]'
                : 'text-[#52525B] hover:bg-[#F4F7FF] hover:text-[#18181B]'
            )}>
              {active && (
                <div className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-[#0052CC]" />
              )}
              <Icon className={cn('flex-shrink-0 h-4 w-4', active ? 'text-[#0052CC]' : 'text-[#71717A]')} />
              {!collapsed && (
                <span className={cn('text-sm font-medium', active ? 'text-[#0052CC]' : 'text-[#52525B]')}>
                  {item.label}
                </span>
              )}
            </div>
          </Link>
        )
      })}

      {/* Research Network section */}
      <div className="my-2 h-px bg-[#E4E4E7]" />
      {!collapsed && (
        <p className="text-[10px] font-semibold text-[#52525B] uppercase tracking-wider px-2.5 mb-1 pt-1">
          Network
        </p>
      )}
      {networkNav.map(item => {
        const Icon = item.icon
        const active = pathname === item.href || pathname.startsWith(item.href + '/')
        return (
          <Link key={item.href} href={item.href} title={collapsed ? item.label : undefined}>
            <div className={cn(
              'relative flex items-center gap-3 h-8 rounded-md transition-all duration-150 ease-out cursor-pointer select-none',
              collapsed ? 'justify-center px-0 w-8 mx-auto' : 'px-2.5',
              active ? 'bg-[#EFF6FF] text-[#0052CC]' : 'text-[#52525B] hover:bg-[#F4F7FF] hover:text-[#18181B]'
            )}>
              {active && <div className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-[#0052CC]" />}
              <Icon className={cn('flex-shrink-0 h-4 w-4', active ? 'text-[#0052CC]' : 'text-[#71717A]')} />
              {!collapsed && (
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <span className={cn('text-sm font-medium', active ? 'text-[#0052CC]' : 'text-[#52525B]')}>
                    {item.label}
                  </span>
                  {!NETWORK_COMPLIANCE_ENABLED && (
                    <span className="text-[9px] font-semibold bg-amber-50 text-amber-600 border border-amber-200 rounded px-1 leading-4">
                      Soon
                    </span>
                  )}
                </div>
              )}
            </div>
          </Link>
        )
      })}

      <div className="my-2 h-px bg-[#E4E4E7]" />

      <button
        onClick={onCommandPalette}
        title={collapsed ? 'Command Palette (⌘K)' : undefined}
        className={cn(
          'w-full flex items-center gap-3 h-8 rounded-md transition-all duration-150 ease-out cursor-pointer select-none text-left',
          collapsed ? 'justify-center px-0 w-8 mx-auto' : 'px-2.5',
          'text-[#52525B] hover:bg-[#F4F7FF] hover:text-[#18181B]'
        )}
      >
        <Command className="h-4 w-4 text-[#71717A] flex-shrink-0" />
        {!collapsed && (
          <div className="flex items-center justify-between flex-1 min-w-0">
            <span className="text-sm font-medium text-[#52525B]">Command</span>
            <kbd className="text-[10px] text-[#52525B] bg-[#F4F4F5] border border-[#E4E4E7] rounded px-1 py-0.5 font-mono">⌘K</kbd>
          </div>
        )}
      </button>

      {dataHref && projectId && (
        <>
          <div className="pt-3 pb-1">
            {!collapsed && (
              <p className="text-[10px] font-semibold text-[#52525B] uppercase tracking-wider px-2.5 mb-1">
                Current Project
              </p>
            )}
          </div>
          <Link href={dataHref}>
            <div className={cn(
              'relative flex items-center gap-3 h-8 rounded-md transition-all duration-150 ease-out cursor-pointer select-none',
              collapsed ? 'justify-center px-0 w-8 mx-auto' : 'px-2.5',
              dataActive
                ? 'bg-[#EFF6FF] text-[#0052CC]'
                : 'text-[#52525B] hover:bg-[#F4F7FF] hover:text-[#18181B]'
            )}>
              {dataActive && <div className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-[#0052CC]" />}
              <Database className={cn('flex-shrink-0 h-4 w-4', dataActive ? 'text-[#0052CC]' : 'text-[#71717A]')} />
              {!collapsed && (
                <span className={cn('text-sm font-medium', dataActive ? 'text-[#0052CC]' : 'text-[#52525B]')}>
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
