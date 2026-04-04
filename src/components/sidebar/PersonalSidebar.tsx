"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, FolderOpen, ClipboardList, Bell, Command, Database, Activity, Download,
  Network, ShieldCheck, FileSignature, FileText
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { NETWORK_COMPLIANCE_ENABLED } from '@/lib/flags'

const personalNav = [
  { href: '/dashboard',     label: 'Dashboard',     icon: LayoutDashboard, shortcut: 'G D' },
  { href: '/reviews',       label: 'Reviews',       icon: ClipboardList,   shortcut: 'G R' },
  { href: '/notifications', label: 'Notifications', icon: Bell,            shortcut: 'G N' },
  { href: '/exports',       label: 'Exports',       icon: Download },
  { href: '/audit',         label: 'Audit Trail',   icon: Activity },
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
    <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
      {personalNav.map(item => {
        const Icon = item.icon
        const active = pathname === item.href || pathname.startsWith(item.href + '/')
        return (
          <Link key={item.href} href={item.href} title={collapsed ? item.label : undefined}>
            <div className={cn(
              'flex items-center gap-3 py-2.5 transition-all duration-150 ease-out cursor-pointer select-none',
              collapsed ? 'justify-center px-0 w-8 mx-auto rounded-md' : 'px-4',
              active
                ? 'text-[#0052CC] border-r-4 border-[#0052CC] bg-blue-50/50 font-semibold'
                : 'text-slate-500 hover:text-[#0052CC] border-r-4 border-transparent'
            )}>
              <Icon className={cn('flex-shrink-0 h-[20px] w-[20px]', active ? 'text-[#0052CC]' : '')} />
              {!collapsed && (
                <span className="text-sm">
                  {item.label}
                </span>
              )}
            </div>
          </Link>
        )
      })}

      {/* Research Network section — hidden for beta */}
      {false && (
        <>
          <div className="my-2 h-px bg-slate-100" />
          {!collapsed && (
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-4 mb-1 pt-1">
              Network
            </p>
          )}
          {networkNav.map(item => {
            const Icon = item.icon
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link key={item.href} href={item.href} title={collapsed ? item.label : undefined}>
                <div className={cn(
                  'flex items-center gap-3 py-2.5 transition-all duration-150 ease-out cursor-pointer select-none',
                  collapsed ? 'justify-center px-0 w-8 mx-auto rounded-md' : 'px-4',
                  active
                    ? 'text-[#0052CC] border-r-4 border-[#0052CC] bg-blue-50/50 font-semibold'
                    : 'text-slate-500 hover:text-[#0052CC] border-r-4 border-transparent'
                )}>
                  <Icon className={cn('flex-shrink-0 h-[20px] w-[20px]', active ? 'text-[#0052CC]' : '')} />
                  {!collapsed && (
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <span className="text-sm font-medium">
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
        </>
      )}

      <div className="my-2 h-px bg-slate-100" />

      <button
        onClick={onCommandPalette}
        title={collapsed ? 'Command Palette (⌘K)' : undefined}
        className={cn(
          'w-full flex items-center gap-3 py-2.5 transition-all duration-150 ease-out cursor-pointer select-none text-left',
          collapsed ? 'justify-center px-0 w-8 mx-auto rounded-md' : 'px-4',
          'text-slate-500 hover:text-[#0052CC]'
        )}
      >
        <Command className="h-[20px] w-[20px] flex-shrink-0" />
        {!collapsed && (
          <div className="flex items-center justify-between flex-1 min-w-0">
            <span className="text-sm font-medium">Command</span>
            <kbd className="text-[10px] text-slate-500 bg-slate-50 border border-slate-200 rounded px-1 py-0.5 font-mono">⌘K</kbd>
          </div>
        )}
      </button>

      {dataHref && projectId && (
        <>
          <div className="pt-3 pb-1">
            {!collapsed && (
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-4 mb-1">
                Current Project
              </p>
            )}
          </div>
          <Link href={dataHref}>
            <div className={cn(
              'flex items-center gap-3 py-2.5 transition-all duration-150 ease-out cursor-pointer select-none',
              collapsed ? 'justify-center px-0 w-8 mx-auto rounded-md' : 'px-4',
              dataActive
                ? 'text-[#0052CC] border-r-4 border-[#0052CC] bg-blue-50/50 font-semibold'
                : 'text-slate-500 hover:text-[#0052CC] border-r-4 border-transparent'
            )}>
              <Database className={cn('flex-shrink-0 h-[20px] w-[20px]', dataActive ? 'text-[#0052CC]' : '')} />
              {!collapsed && (
                <span className={cn('text-sm font-medium', dataActive ? 'text-[#0052CC]' : '')}>
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
