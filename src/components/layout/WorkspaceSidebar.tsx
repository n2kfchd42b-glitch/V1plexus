"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { FlaskConical, LogOut, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'
import { WorkspaceSwitcher } from '@/components/workspace/WorkspaceSwitcher'
import { PersonalSidebar } from '@/components/sidebar/PersonalSidebar'
import { InstitutionalSidebar } from '@/components/sidebar/InstitutionalSidebar'
import { useWorkspaceContext } from '@/components/workspace/WorkspaceProvider'
import type { Profile } from '@/types/database'

interface WorkspaceSidebarProps {
  profile: Profile | null
  onSignOut: () => void
  onCommandPalette?: () => void
}

export function WorkspaceSidebar({ profile, onSignOut, onCommandPalette }: WorkspaceSidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const { isPersonal, isInstitutional, loading } = useWorkspaceContext()

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

  return (
    <aside className={cn(
      'flex flex-col h-screen sticky top-0 transition-all duration-200 ease-out flex-shrink-0',
      'bg-white border-r border-[#E4E4E7]',
      collapsed ? 'w-12' : 'w-60'
    )}>
      {/* Logo + workspace switcher area */}
      <div className={cn(
        'border-b border-[#E4E4E7] transition-all duration-200',
        collapsed ? 'px-1.5 py-2' : 'px-3 py-2'
      )}>
        {/* Logo */}
        <div className={cn(
          'flex items-center gap-2 mb-2',
          collapsed ? 'justify-center' : ''
        )}>
          <div className="flex items-center justify-center w-7 h-7 rounded-md bg-[#0052CC] flex-shrink-0">
            <FlaskConical className="h-4 w-4 text-white" />
          </div>
          {!collapsed && (
            <span className="font-bold text-base text-[#18181B] tracking-tight">
              PLEXUS
            </span>
          )}
        </div>

        {/* Workspace switcher */}
        {!loading && (
          <WorkspaceSwitcher collapsed={collapsed} />
        )}
      </div>

      {/* Context label */}
      {!collapsed && !loading && (
        <div className="px-3 pt-3 pb-1">
          <p className="text-[10px] font-semibold text-[#52525B] uppercase tracking-wider">
            {isPersonal ? 'Navigation' : isInstitutional ? 'Navigation' : 'Navigation'}
          </p>
        </div>
      )}

      {/* Navigation — switches based on workspace type */}
      {isPersonal ? (
        <PersonalSidebar collapsed={collapsed} onCommandPalette={onCommandPalette} />
      ) : isInstitutional ? (
        <InstitutionalSidebar collapsed={collapsed} onCommandPalette={onCommandPalette} />
      ) : (
        <PersonalSidebar collapsed={collapsed} onCommandPalette={onCommandPalette} />
      )}

      {/* User + collapse controls */}
      <div className="border-t border-[#E4E4E7]">
        <Link
          href="/settings"
          title="Profile settings"
          className={cn(
            'flex items-center gap-2.5 transition-all duration-200 rounded-lg hover:bg-[#F4F7FF] group',
            collapsed ? 'px-2 py-2 justify-center' : 'px-3 py-3'
          )}
        >
          <div className={cn(
            'flex items-center justify-center rounded-full bg-[#0052CC] text-white text-xs font-bold flex-shrink-0 ring-2 ring-transparent group-hover:ring-[#0052CC]/20 transition-all',
            'h-7 w-7'
          )}>
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" />
            ) : (
              getInitials(profile?.full_name)
            )}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#18181B] truncate leading-tight">
                {profile?.full_name ?? 'User'}
              </p>
              <p className="text-xs text-[#52525B] capitalize truncate">
                {profile?.role}
              </p>
            </div>
          )}
        </Link>

        <div className={cn(
          'flex items-center border-t border-[#E4E4E7] transition-all duration-200',
          collapsed ? 'flex-col px-2 py-2 gap-1' : 'px-2 py-2 gap-1'
        )}>
          <button
            onClick={onSignOut}
            title="Sign out"
            className={cn(
              'flex items-center gap-2 h-7 rounded-md transition-colors duration-150 text-[#52525B] hover:text-[#EF4444] hover:bg-red-50',
              collapsed ? 'w-8 justify-center px-0' : 'flex-1 px-2.5'
            )}
          >
            <LogOut className="h-3.5 w-3.5 flex-shrink-0" />
            {!collapsed && <span className="text-xs">Sign out</span>}
          </button>

          <button
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? 'Expand sidebar (⌘\\)' : 'Collapse sidebar (⌘\\)'}
            className="flex items-center justify-center h-7 w-7 rounded-md text-[#52525B] hover:text-[#18181B] hover:bg-[#F4F7FF] transition-colors duration-150 flex-shrink-0"
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
