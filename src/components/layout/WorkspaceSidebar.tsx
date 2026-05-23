"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  FolderOpen, LogOut, ChevronLeft, ChevronRight, Command,
  Users, GraduationCap, Building2, Inbox, UserCheck,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { WorkspaceMemberRole } from '@/types/database'
import { BrandLogo } from '@/components/layout/BrandLogo'
import { LanguageSelector } from '@/components/i18n/LanguageSelector'
import { useTranslations } from '@/i18n/useTranslations'
import { cn, getInitials } from '@/lib/utils'
import type { Profile } from '@/types/database'

interface WorkspaceSidebarProps {
  profile: Profile | null
  onSignOut: () => void
  onCommandPalette?: () => void
}

export function WorkspaceSidebar({ profile, onSignOut, onCommandPalette }: WorkspaceSidebarProps) {
  const pathname = usePathname()
  const { t } = useTranslations()
  const [collapsed, setCollapsed] = useState(true)
  const [workspaceRole, setWorkspaceRole] = useState<WorkspaceMemberRole | null>(null)
  const [thesisProjectId, setThesisProjectId] = useState<string | null>(null)

  useEffect(() => {
    if (!profile) return
    const supabase = createClient()
    supabase
      .from('workspace_memberships')
      .select('role')
      .eq('user_id', profile.id)
      .eq('status', 'active')
      .single()
      .then(({ data }) => { if (data) setWorkspaceRole(data.role as WorkspaceMemberRole) })

    // Resolve thesis project for "My Roadmap" deep-link
    supabase
      .from('projects')
      .select('id')
      .eq('owner_id', profile.id)
      .eq('project_type', 'thesis')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => { if (data) setThesisProjectId(data.id) })
  }, [profile])

  // Detect if we're inside a project — used only for auto-collapse
  const projectMatch = pathname.match(/^\/projects\/([^/]+)/)
  const isInProject  = !!projectMatch?.[1] && projectMatch[1] !== 'new'

  // Collapse when leaving a project; project tabs live in the horizontal tab bar
  useEffect(() => {
    if (!isInProject) setCollapsed(true)
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
          subtitle={collapsed ? undefined : t('workspace.subtitle', 'Research Lab')}
        />
      </div>

      {/* Navigation */}
      <nav className="relative z-10 flex-1 px-2 py-3 overflow-y-auto">

        {/* Section label */}
        {!collapsed && (
          <p className="px-2.5 pt-0.5 pb-1.5 text-[9px] font-medium uppercase tracking-[0.10em] text-[var(--text-sidebar-icon)]">
            {t('nav.workspace', 'Workspace')}
          </p>
        )}

        {/* Projects */}
        <Link href="/projects" title={collapsed ? t('nav.projects', 'Projects') : undefined}>
          <div className={cn(
            'relative flex items-center gap-3 h-8 rounded-md transition-all duration-150 ease-out cursor-pointer select-none',
            collapsed ? 'justify-center px-0 w-8 mx-auto' : 'px-2.5',
            projectsActive
              ? 'bg-[var(--bg-sidebar-active)] text-[var(--text-sidebar-active)]'
              : 'text-[var(--text-sidebar)] hover:bg-[var(--bg-sidebar-hover)] hover:text-white/80'
          )}>
            {projectsActive && (
              <div className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-[var(--accent-primary)]" />
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
                {t('nav.projects', 'Projects')}
              </span>
            )}
          </div>
        </Link>


        {/* Divider */}
        <div className="my-2 h-px bg-white/10" />

        {/* Role-based nav — supervisor */}
        {workspaceRole === 'supervisor' && (() => {
          const studentsHref = '/supervisor/dashboard'
          const deptHref = '/department'
          const studentsActive = pathname.startsWith('/supervisor')
          const deptActive = pathname.startsWith('/department')
          return (
            <>
              {!collapsed && (
                <p className="px-2.5 pt-0.5 pb-1.5 text-[9px] font-medium uppercase tracking-[0.10em] text-[var(--text-sidebar-icon)]">
                  Supervision
                </p>
              )}
              <Link href={studentsHref} title={collapsed ? 'My Students' : undefined}>
                <div className={cn(
                  'relative flex items-center gap-3 h-8 rounded-md transition-all duration-150 ease-out cursor-pointer select-none',
                  collapsed ? 'justify-center px-0 w-8 mx-auto' : 'px-2.5',
                  studentsActive
                    ? 'bg-[var(--bg-sidebar-active)] text-[var(--text-sidebar-active)]'
                    : 'text-[var(--text-sidebar)] hover:bg-[var(--bg-sidebar-hover)] hover:text-white/80'
                )}>
                  {studentsActive && (
                    <div className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-[var(--accent-primary)]" />
                  )}
                  <Users className={cn('flex-shrink-0 h-4 w-4', studentsActive ? 'text-white' : 'text-[var(--text-sidebar-icon)]')} />
                  {!collapsed && <span className="text-sm font-medium">{t('nav.myStudents', 'My Students')}</span>}
                </div>
              </Link>
              <Link href="/supervisor/inbox" title={collapsed ? 'Inbox' : undefined}>
                <div className={cn(
                  'relative flex items-center gap-3 h-8 rounded-md transition-all duration-150 ease-out cursor-pointer select-none',
                  collapsed ? 'justify-center px-0 w-8 mx-auto' : 'px-2.5',
                  pathname === '/supervisor/inbox'
                    ? 'bg-[var(--bg-sidebar-active)] text-[var(--text-sidebar-active)]'
                    : 'text-[var(--text-sidebar)] hover:bg-[var(--bg-sidebar-hover)] hover:text-white/80'
                )}>
                  {pathname === '/supervisor/inbox' && (
                    <div className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-[var(--accent-primary)]" />
                  )}
                  <Inbox className={cn('flex-shrink-0 h-4 w-4', pathname === '/supervisor/inbox' ? 'text-white' : 'text-[var(--text-sidebar-icon)]')} />
                  {!collapsed && <span className="text-sm font-medium">Inbox</span>}
                </div>
              </Link>
              <Link href={deptHref} title={collapsed ? 'Department' : undefined}>
                <div className={cn(
                  'relative flex items-center gap-3 h-8 rounded-md transition-all duration-150 ease-out cursor-pointer select-none',
                  collapsed ? 'justify-center px-0 w-8 mx-auto' : 'px-2.5',
                  deptActive
                    ? 'bg-[var(--bg-sidebar-active)] text-[var(--text-sidebar-active)]'
                    : 'text-[var(--text-sidebar)] hover:bg-[var(--bg-sidebar-hover)] hover:text-white/80'
                )}>
                  {deptActive && (
                    <div className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-[var(--accent-primary)]" />
                  )}
                  <Building2 className={cn('flex-shrink-0 h-4 w-4', deptActive ? 'text-white' : 'text-[var(--text-sidebar-icon)]')} />
                  {!collapsed && <span className="text-sm font-medium">Department</span>}
                </div>
              </Link>
              <div className="my-2 h-px bg-white/10" />
            </>
          )
        })()}

        {/* Role-based nav — student */}
        {workspaceRole === 'student' && (() => {
          const roadmapHref = thesisProjectId ? `/projects/${thesisProjectId}/chapters` : '/student/milestones'
          const roadmapActive = pathname.startsWith('/student/milestones') || pathname === '/student'
            || (thesisProjectId ? pathname.startsWith(`/projects/${thesisProjectId}/chapters`) : false)
          const supervisorActive = pathname.startsWith('/student/supervisor')
          return (
            <>
              {!collapsed && (
                <p className="px-2.5 pt-0.5 pb-1.5 text-[9px] font-medium uppercase tracking-[0.10em] text-[var(--text-sidebar-icon)]">
                  My Research
                </p>
              )}
              <Link href={roadmapHref} title={collapsed ? 'My Roadmap' : undefined}>
                <div className={cn(
                  'relative flex items-center gap-3 h-8 rounded-md transition-all duration-150 ease-out cursor-pointer select-none',
                  collapsed ? 'justify-center px-0 w-8 mx-auto' : 'px-2.5',
                  roadmapActive
                    ? 'bg-[var(--bg-sidebar-active)] text-[var(--text-sidebar-active)]'
                    : 'text-[var(--text-sidebar)] hover:bg-[var(--bg-sidebar-hover)] hover:text-white/80'
                )}>
                  {roadmapActive && (
                    <div className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-[var(--accent-primary)]" />
                  )}
                  <GraduationCap className={cn('flex-shrink-0 h-4 w-4', roadmapActive ? 'text-white' : 'text-[var(--text-sidebar-icon)]')} />
                  {!collapsed && <span className="text-sm font-medium">{t('nav.myRoadmap', 'My Roadmap')}</span>}
                </div>
              </Link>
              <Link href="/student/supervisor" title={collapsed ? 'My Supervisor' : undefined}>
                <div className={cn(
                  'relative flex items-center gap-3 h-8 rounded-md transition-all duration-150 ease-out cursor-pointer select-none',
                  collapsed ? 'justify-center px-0 w-8 mx-auto' : 'px-2.5',
                  supervisorActive
                    ? 'bg-[var(--bg-sidebar-active)] text-[var(--text-sidebar-active)]'
                    : 'text-[var(--text-sidebar)] hover:bg-[var(--bg-sidebar-hover)] hover:text-white/80'
                )}>
                  {supervisorActive && (
                    <div className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-[var(--accent-primary)]" />
                  )}
                  <UserCheck className={cn('flex-shrink-0 h-4 w-4', supervisorActive ? 'text-white' : 'text-[var(--text-sidebar-icon)]')} />
                  {!collapsed && <span className="text-sm font-medium">My Supervisor</span>}
                </div>
              </Link>
              <div className="my-2 h-px bg-white/10" />
            </>
          )
        })()}

        {/* Section label — tools */}
        {!collapsed && (
          <p className="px-2.5 pt-0.5 pb-1.5 text-[9px] font-medium uppercase tracking-[0.10em] text-[var(--text-sidebar-icon)]">
            {t('nav.tools', 'Tools')}
          </p>
        )}

        {/* Command palette */}
        <button
          onClick={onCommandPalette}
          title={collapsed ? `${t('nav.command', 'Command')} (⌘K)` : undefined}
          className={cn(
            'w-full flex items-center gap-3 h-8 rounded-md transition-all duration-150 ease-out cursor-pointer select-none text-left',
            collapsed ? 'justify-center px-0 w-8 mx-auto' : 'px-2.5',
            'text-[var(--text-sidebar)] hover:bg-[var(--bg-sidebar-hover)] hover:text-white/80'
          )}
        >
          <Command className="h-4 w-4 text-[var(--text-sidebar-icon)] flex-shrink-0" />
          {!collapsed && (
            <div className="flex items-center justify-between flex-1 min-w-0">
              <span className="text-sm font-medium text-[var(--text-sidebar)]">{t('nav.command', 'Command')}</span>
              <kbd className="text-[10px] text-[var(--text-sidebar-icon)] bg-white/5 border border-white/10 rounded px-1 py-0.5 font-mono">⌘K</kbd>
            </div>
          )}
        </button>
      </nav>

      {/* User chip + language selector + collapse controls */}
      <div className="relative z-10 border-t border-white/10">
        <Link
          href="/settings"
          className={cn(
            'flex items-center gap-2.5 transition-all duration-200 hover:bg-[var(--bg-sidebar-hover)] rounded-md',
            collapsed ? 'px-2 py-2 justify-center' : 'px-3 py-3'
          )}
          title={collapsed ? (profile?.full_name ?? 'Profile') : undefined}
        >
          <div className="flex items-center justify-center rounded-full bg-[var(--accent-primary)] text-white text-xs font-bold flex-shrink-0 h-7 w-7">
            {profile?.avatar_url ? (
              <Image src={profile.avatar_url} alt="" width={28} height={28} className="h-7 w-7 rounded-full object-cover" />
            ) : (
              getInitials(profile?.full_name)
            )}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white/90 truncate leading-tight">
                {profile?.full_name ?? 'Account'}
              </p>
            </div>
          )}
        </Link>

        {/* Language selector — only when expanded */}
        {!collapsed && (
          <div className="px-3 pb-2">
            <LanguageSelector className="w-full" />
          </div>
        )}

        <div className={cn(
          'flex items-center border-t border-white/5 transition-all duration-200',
          collapsed ? 'flex-col px-2 py-2 gap-1' : 'px-2 py-2 gap-1'
        )}>
          <button
            onClick={onSignOut}
            title={t('nav.signOut', 'Sign out')}
            className={cn(
              'flex items-center gap-2 h-7 rounded-md transition-colors duration-150 text-[var(--text-sidebar-icon)] hover:text-[var(--status-error)] hover:bg-red-950/30',
              collapsed ? 'w-8 justify-center px-0' : 'flex-1 px-2.5'
            )}
          >
            <LogOut className="h-3.5 w-3.5 flex-shrink-0" />
            {!collapsed && <span className="text-xs">{t('nav.signOut', 'Sign out')}</span>}
          </button>

          <button
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? `${t('nav.expand', 'Expand')} (⌘\\)` : `${t('nav.collapse', 'Collapse')} (⌘\\)`}
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
