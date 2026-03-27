"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { LogOut, ChevronLeft, ChevronRight } from 'lucide-react'
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
      'bg-white border-r border-slate-200',
      collapsed ? 'w-12' : 'w-64'
    )}>
      {/* Logo + workspace switcher area */}
      <div className={cn(
        'border-b border-slate-200 transition-all duration-200',
        collapsed ? 'px-1.5 py-3' : 'p-6 pb-4'
      )}>
        {/* Logo */}
        <div className={cn(
          'flex items-center gap-3',
          collapsed ? 'justify-center' : '',
          !collapsed ? 'mb-4' : 'mb-2'
        )}>
          <div className="relative flex items-center justify-center w-9 h-9 rounded-lg bg-[#00288e] flex-shrink-0 shadow-md shadow-[#00288e]/30 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-[#1e40af] to-[#00288e]" />
            <span className="relative z-10 text-white font-black text-sm tracking-tight leading-none select-none">PR</span>
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-blue-300/20 rounded-tl-lg" />
          </div>
          {!collapsed && (
            <span className="text-[15px] font-bold tracking-tight text-[#00288e] font-manrope">
              PLEXUS <span className="text-slate-400 font-normal">Research</span>
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
        <div className="px-4 pt-3 pb-1">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Navigation
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
      <div className="mt-auto border-t border-slate-100">
        {/* Usage indicator */}
        {!collapsed && (
          <div className="px-4 pt-3 pb-2">
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase mb-2">
                <span>Storage</span>
              </div>
              <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden">
                <div className="bg-[#0052CC] h-full rounded-full w-[32%] transition-all" />
              </div>
            </div>
          </div>
        )}

        <Link
          href="/settings"
          title="Profile settings"
          className={cn(
            'flex items-center gap-2.5 transition-all duration-200 hover:bg-slate-50 group',
            collapsed ? 'px-2 py-2 justify-center' : 'px-4 py-3'
          )}
        >
          <div className={cn(
            'flex items-center justify-center rounded-lg bg-[#0052CC] text-white text-xs font-bold flex-shrink-0 ring-2 ring-transparent group-hover:ring-[#0052CC]/20 transition-all',
            'h-8 w-8'
          )}>
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-8 w-8 rounded-lg object-cover" />
            ) : (
              getInitials(profile?.full_name)
            )}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-900 truncate leading-none">
                {profile?.full_name ?? 'User'}
              </p>
              <p className="text-[10px] text-slate-500 font-medium capitalize truncate mt-0.5">
                {profile?.role}
              </p>
            </div>
          )}
        </Link>

        <div className={cn(
          'flex items-center border-t border-slate-100 transition-all duration-200',
          collapsed ? 'flex-col px-2 py-2 gap-1' : 'px-3 py-2 gap-1'
        )}>
          <button
            onClick={onSignOut}
            title="Sign out"
            className={cn(
              'flex items-center gap-2 h-7 rounded-md transition-colors duration-150 text-slate-500 hover:text-red-600',
              collapsed ? 'w-8 justify-center px-0' : 'flex-1 px-2.5'
            )}
          >
            <LogOut className="h-3.5 w-3.5 flex-shrink-0" />
            {!collapsed && <span className="text-xs font-medium">Sign out</span>}
          </button>

          <button
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? 'Expand sidebar (⌘\\)' : 'Collapse sidebar (⌘\\)'}
            className="flex items-center justify-center h-7 w-7 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors duration-150 flex-shrink-0"
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
