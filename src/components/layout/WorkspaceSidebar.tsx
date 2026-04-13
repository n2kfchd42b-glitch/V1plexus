"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  FolderOpen, LogOut, ChevronLeft, ChevronRight, Command,
  LayoutDashboard, Database, BarChart2, Clock, FileText, Settings,
} from 'lucide-react'
import { BrandLogo } from '@/components/layout/BrandLogo'
import { cn, getInitials } from '@/lib/utils'
import type { Profile } from '@/types/database'

interface WorkspaceSidebarProps {
  profile: Profile | null
  onSignOut: () => void
  onCommandPalette?: () => void
}

const PROJECT_TABS = [
  { slug: 'overview',  label: 'Overview',  icon: LayoutDashboard },
  { slug: 'data',      label: 'Data',      icon: Database        },
  { slug: 'analysis',  label: 'Analysis',  icon: BarChart2       },
  { slug: 'timeline',  label: 'Timeline',  icon: Clock           },
  { slug: 'report',    label: 'Report',    icon: FileText        },
  { slug: 'settings',  label: 'Settings',  icon: Settings        },
]

export function WorkspaceSidebar({ profile, onSignOut, onCommandPalette }: WorkspaceSidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(true)

  // Detect if we're inside a project
  const projectMatch = pathname.match(/^\/projects\/([^/]+)/)
  const projectId    = projectMatch?.[1] ?? null
  const isInProject  = !!projectId && projectId !== 'new'

  // Auto-expand when entering a project; collapse when leaving
  useEffect(() => {
    if (isInProject) {
      setCollapsed(false)
    } else {
      setCollapsed(true)
    }
  }, [isInProject])

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
      'relative flex flex-col h-screen sticky top-0 transition-all duration-200 ease-out flex-shrink-0',
      'bg-[var(--bg-sidebar)] border-r border-white/10',
      collapsed ? 'w-12' : 'w-52'
    )}>

      {/* Radial glow */}
      <div
        className="absolute top-0 left-0 w-40 h-40 pointer-events-none"
        style={{ background: 'radial-gradient(circle at top left, rgba(59,130,246,0.18) 0%, transparent 60%)' }}
      />

      {/* Logo */}
      <div className={cn(
        'relative z-10 flex items-center border-b border-white/10 transition-all duration-200',
        collapsed ? 'h-12 justify-center px-0' : 'h-[60px] px-4 gap-2'
      )}>
        <BrandLogo
          variant="dark"
          collapsed={collapsed}
          subtitle={collapsed ? undefined : 'Research Lab'}
        />
      </div>

      {/* Navigation */}
      <nav className="relative z-10 flex-1 px-2 py-3 overflow-y-auto">

        {/* Section label */}
        {!collapsed && (
          <p className="px-2.5 pt-0.5 pb-1.5 text-[9px] font-medium uppercase tracking-[0.10em] text-[var(--text-sidebar-icon)]">
            Workspace
          </p>
        )}

        {/* Projects */}
        <Link href="/projects" title={collapsed ? 'Projects' : undefined}>
          <div className={cn(
            'relative flex items-center gap-3 h-8 rounded-md transition-all duration-150 ease-out cursor-pointer select-none',
            collapsed ? 'justify-center px-0 w-8 mx-auto' : 'px-2.5',
            projectsActive
              ? 'bg-[var(--bg-sidebar-active)] text-[var(--text-sidebar-active)]'
              : 'text-[var(--text-sidebar)] hover:bg-[var(--bg-sidebar-hover)] hover:text-white/80'
          )}>
            {projectsActive && (
              <div className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-[var(--accent-blue)]" />
            )}
            <FolderOpen className={cn(
              'flex-shrink-0 h-4 w-4 transition-colors duration-150',
              projectsActive ? 'text-white' : 'text-[var(--text-sidebar-icon)]'
            )} />
            {!collapsed && (
              <span className={cn(
                'text-sm font-medium transition-opacity duration-100',
                projectsActive ? 'text-[var(--text-sidebar-active)]' : 'text-[var(--text-sidebar)]'
              )}>
                Projects
              </span>
            )}
          </div>
        </Link>

        {/* ── Project sub-nav — only when inside a project ─────────────────── */}
        {isInProject && projectId && (
          <div className={cn(
            'mt-1 mb-1',
            collapsed ? 'flex flex-col items-center gap-0.5' : 'ml-3 border-l border-white/10 pl-2 flex flex-col gap-0.5'
          )}>
            {PROJECT_TABS.map(({ slug, label, icon: Icon }) => {
              const href   = `/projects/${projectId}/${slug}`
              const active = pathname === href || pathname.startsWith(href + '/')
              return (
                <Link
                  key={slug}
                  href={href}
                  title={collapsed ? label : undefined}
                >
                  <div className={cn(
                    'relative flex items-center gap-2.5 h-7 rounded-md transition-all duration-150 ease-out cursor-pointer select-none',
                    collapsed ? 'justify-center w-8 mx-auto px-0' : 'px-2',
                    active
                      ? 'bg-[var(--bg-sidebar-active)] text-white'
                      : 'text-[var(--text-sidebar)] hover:bg-[var(--bg-sidebar-hover)] hover:text-white/80'
                  )}>
                    {active && !collapsed && (
                      <div className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-[var(--accent-blue)]" />
                    )}
                    <Icon className={cn(
                      'flex-shrink-0 h-3.5 w-3.5 transition-colors duration-150',
                      active ? 'text-white' : 'text-[var(--text-sidebar-icon)]'
                    )} />
                    {!collapsed && (
                      <span className={cn(
                        'text-xs font-medium',
                        active ? 'text-white' : 'text-[var(--text-sidebar)]'
                      )}>
                        {label}
                      </span>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        {/* Divider */}
        <div className="my-2 h-px bg-white/10" />

        {/* Section label — tools */}
        {!collapsed && (
          <p className="px-2.5 pt-0.5 pb-1.5 text-[9px] font-medium uppercase tracking-[0.10em] text-[var(--text-sidebar-icon)]">
            Tools
          </p>
        )}

        {/* Command palette */}
        <button
          onClick={onCommandPalette}
          title={collapsed ? 'Command Palette (⌘K)' : undefined}
          className={cn(
            'w-full flex items-center gap-3 h-8 rounded-md transition-all duration-150 ease-out cursor-pointer select-none text-left',
            collapsed ? 'justify-center px-0 w-8 mx-auto' : 'px-2.5',
            'text-[var(--text-sidebar)] hover:bg-[var(--bg-sidebar-hover)] hover:text-white/80'
          )}
        >
          <Command className="h-4 w-4 text-[var(--text-sidebar-icon)] flex-shrink-0" />
          {!collapsed && (
            <div className="flex items-center justify-between flex-1 min-w-0">
              <span className="text-sm font-medium text-[var(--text-sidebar)]">Command</span>
              <kbd className="text-[10px] text-[var(--text-sidebar-icon)] bg-white/5 border border-white/10 rounded px-1 py-0.5 font-mono">⌘K</kbd>
            </div>
          )}
        </button>
      </nav>

      {/* User chip + collapse controls */}
      <div className="relative z-10 border-t border-white/10">
        <div className={cn(
          'flex items-center gap-2.5 transition-all duration-200',
          collapsed ? 'px-2 py-2 justify-center' : 'px-3 py-3'
        )}>
          <div className="flex items-center justify-center rounded-full bg-[var(--accent-primary)] text-white text-xs font-bold flex-shrink-0 h-7 w-7">
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
              <p className="text-[10px] text-[var(--text-sidebar-icon)] truncate capitalize">
                {profile?.role ?? 'Researcher'}
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
              'flex items-center gap-2 h-7 rounded-md transition-colors duration-150 text-[var(--text-sidebar-icon)] hover:text-[var(--status-error)] hover:bg-red-950/30',
              collapsed ? 'w-8 justify-center px-0' : 'flex-1 px-2.5'
            )}
          >
            <LogOut className="h-3.5 w-3.5 flex-shrink-0" />
            {!collapsed && <span className="text-xs">Sign out</span>}
          </button>

          <button
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? 'Expand (⌘\\)' : 'Collapse (⌘\\)'}
            className="flex items-center justify-center h-7 w-7 rounded-md text-[var(--text-sidebar-icon)] hover:text-white hover:bg-[var(--bg-sidebar-hover)] transition-colors duration-150 flex-shrink-0"
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
