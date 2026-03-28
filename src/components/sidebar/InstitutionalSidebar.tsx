"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, FolderOpen, ClipboardList, Bell,
  Command, Building2, Users, GraduationCap, UserCheck, Database, Activity, ClipboardCheck, Download,
  Network, ShieldCheck, FileSignature, FileText, BarChart3, BookOpen, Landmark
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWorkspaceContext } from '@/components/workspace/WorkspaceProvider'
import { NETWORK_COMPLIANCE_ENABLED, INSTITUTIONAL_INTELLIGENCE_ENABLED } from '@/lib/flags'

interface InstitutionalSidebarProps {
  collapsed: boolean
  onCommandPalette?: () => void
}

export function InstitutionalSidebar({ collapsed, onCommandPalette }: InstitutionalSidebarProps) {
  const pathname = usePathname()
  const { isAdmin, isDepartmentHead, isSupervisor, isStudent } = useWorkspaceContext()

  const projectMatch = pathname.match(/\/projects\/([^/]+)/)
  const projectId = projectMatch?.[1]
  const dataHref = projectId ? `/projects/${projectId}/data` : null
  const dataActive = dataHref ? pathname.startsWith(dataHref) : false

  const coreNav = [
    { href: '/dashboard',     label: 'Dashboard',     icon: LayoutDashboard, shortcut: 'G D' },
    { href: '/reviews',       label: 'Reviews',       icon: ClipboardList,   shortcut: 'G R' },
    { href: '/notifications', label: 'Notifications', icon: Bell,            shortcut: 'G N' },
    { href: '/exports',       label: 'Exports',       icon: Download },
  ]

  const networkNav = [
    { href: '/network',    label: 'Research Network', icon: Network },
    { href: '/compliance', label: 'Compliance',       icon: ShieldCheck },
    { href: '/consent',    label: 'Consent',          icon: FileSignature },
    { href: '/dmp',        label: 'Data Plans',       icon: FileText },
  ]

  const institutionNav = [
    ...(isAdmin || isDepartmentHead ? [
      { href: '/members',      label: 'Members',     icon: Users },
      { href: '/departments',  label: 'Departments', icon: Building2 },
    ] : []),
    ...(isSupervisor || isDepartmentHead ? [
      { href: '/supervisor/students', label: 'My Students', icon: GraduationCap },
    ] : []),
    ...(isStudent ? [
      { href: '/student/supervisor', label: 'My Supervisor', icon: UserCheck },
    ] : []),
    ...(isAdmin ? [
      { href: '/institution', label: 'Institution Settings', icon: Building2 },
      { href: '/institution/compliance', label: 'Compliance', icon: ClipboardCheck },
      { href: '/institution/audit', label: 'Audit Trail', icon: Activity },
    ] : []),
  ]

  const NavItem = ({ href, label, icon: Icon, soon }: { href: string; label: string; icon: React.ElementType; soon?: boolean }) => {
    const active = pathname === href || pathname.startsWith(href + '/')
    return (
      <Link href={href} title={collapsed ? label : undefined}>
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
                {label}
              </span>
              {soon && (
                <span className="text-[9px] font-semibold bg-amber-50 text-amber-600 border border-amber-200 rounded px-1 leading-4">
                  Soon
                </span>
              )}
            </div>
          )}
        </div>
      </Link>
    )
  }

  return (
    <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
      {coreNav.map(item => (
        <NavItem key={item.href} {...item} />
      ))}

      {institutionNav.length > 0 && (
        <>
          <div className="my-2 h-px bg-slate-100" />
          {!collapsed && (
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-4 mb-1 pt-1">
              Institution
            </p>
          )}
          {institutionNav.map(item => (
            <NavItem key={item.href} {...item} />
          ))}
        </>
      )}

      {/* Phase 11: Institutional Intelligence */}
      {(isAdmin || isDepartmentHead) && (
        <>
          <div className="my-2 h-px bg-slate-100" />
          {!collapsed && (
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-4 mb-1 pt-1">
              Intelligence
            </p>
          )}
          <NavItem href="/institution/impact"    label="Research Impact" icon={BarChart3}  soon={!INSTITUTIONAL_INTELLIGENCE_ENABLED} />
          <NavItem href="/institution/grants"    label="Grants"          icon={Landmark}   soon={!INSTITUTIONAL_INTELLIGENCE_ENABLED} />
          <NavItem href="/institution/knowledge" label="Knowledge Base"  icon={BookOpen}   soon={!INSTITUTIONAL_INTELLIGENCE_ENABLED} />
        </>
      )}

      {/* Phase 12: Research Network */}
      <div className="my-2 h-px bg-slate-100" />
      {!collapsed && (
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-4 mb-1 pt-1">
          Network
        </p>
      )}
      {networkNav.map(item => (
        <NavItem key={item.href} {...item} soon={!NETWORK_COMPLIANCE_ENABLED} />
      ))}

      {/* Command palette */}
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
                <span className={cn('text-sm font-medium', dataActive ? 'text-[#0052CC]' : '')}>Data</span>
              )}
            </div>
          </Link>
        </>
      )}
    </nav>
  )
}
