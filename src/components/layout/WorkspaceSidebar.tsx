"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FolderOpen, LogOut, ChevronLeft, ChevronRight, Command } from 'lucide-react'
import { BrandLogo } from '@/components/layout/BrandLogo'
import { cn, getInitials } from '@/lib/utils'
import type { Profile } from '@/types/database'

interface WorkspaceSidebarProps {
  profile: Profile | null
  onSignOut: () => void
  onCommandPalette?: () => void
}

export function WorkspaceSidebar({ profile, onSignOut, onCommandPalette }: WorkspaceSidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(true)

  // Collapse on navigation
  useEffect(() => {
    setCollapsed(true)
  }, [pathname])

  // Cmd+\ to toggle
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

  const projectsActive = pathname === '/projects' || pathname.startsWith('/projects')

  return (
    <aside className={cn(
      'flex flex-col h-screen sticky top-0 transition-all duration-200 ease-out flex-shrink-0',
      'bg-[#18181B] border-r border-white/10',
      collapsed ? 'w-12' : 'w-52'
    )}>
      {/* Logo */}
      <div className={cn(
        'flex items-center border-b border-white/10 transition-all duration-200',
        collapsed ? 'h-12 justify-center px-0' : 'h-14 px-4 gap-2'
      )}>
        <BrandLogo variant="dark" collapsed={collapsed} />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">

        {/* Projects */}
        <Link href="/projects" title={collapsed ? 'Projects' : undefined}>
          <div className={cn(
            'relative flex items-center gap-3 h-8 rounded-md transition-all duration-150 ease-out cursor-pointer select-none',
            collapsed ? 'justify-center px-0 w-8 mx-auto' : 'px-2.5',
            projectsActive
              ? 'bg-[#3F3F46] text-white'
              : 'text-[#A1A1AA] hover:bg-[#27272A] hover:text-white/80'
          )}>
            {projectsActive && (
              <div className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-[#3B82F6]" />
            )}
            <FolderOpen className={cn(
              'flex-shrink-0 h-4 w-4 transition-colors duration-150',
              projectsActive ? 'text-white' : 'text-[#71717A]'
            )} />
            {!collapsed && (
              <span className={cn(
                'text-sm font-medium transition-opacity duration-100',
                projectsActive ? 'text-white' : 'text-[#A1A1AA]'
              )}>
                Projects
              </span>
            )}
          </div>
        </Link>

        {/* Divider */}
        <div className="my-2 h-px bg-white/10" />

        {/* Command palette */}
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
      </nav>

      {/* User + collapse controls */}
      <div className="border-t border-white/10">
        <div className={cn(
          'flex items-center gap-2.5 transition-all duration-200',
          collapsed ? 'px-2 py-2 justify-center' : 'px-3 py-3'
        )}>
          <div className="flex items-center justify-center rounded-full bg-[#1B3A5C] text-white text-xs font-bold flex-shrink-0 h-7 w-7">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" />
            ) : (
              getInitials(profile?.full_name)
            )}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white/90 truncate leading-tight">
                {profile?.full_name ?? 'Researcher'}
              </p>
              <p className="text-xs text-[#71717A] truncate">
                {profile?.email ?? ''}
              </p>
            </div>
          )}
        </div>

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
            title={collapsed ? 'Expand (⌘\\)' : 'Collapse (⌘\\)'}
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
