'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, FolderOpen, Building2, Settings, LogOut, FlaskConical } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getInitials } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { toast } from 'sonner'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/projects', label: 'Projects', icon: FolderOpen },
  { href: '/institution', label: 'Institution', icon: Building2 },
]

interface AppSidebarProps {
  collapsed?: boolean
}

export function AppSidebar({ collapsed = false }: AppSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { profile } = useUser()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    toast.success('Signed out')
    router.push('/login')
  }

  return (
    <aside
      className={cn(
        'flex flex-col h-full bg-[#1B3A5C] text-white transition-all duration-200',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-5 border-b border-white/10">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-white/10 shrink-0">
          <FlaskConical className="h-5 w-5 text-white" />
        </div>
        {!collapsed && (
          <span className="font-bold text-lg tracking-tight">PLEXUS</span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-white/15 text-white'
                  : 'text-blue-200 hover:bg-white/10 hover:text-white'
              )}
              title={collapsed ? label : undefined}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-white/10 p-2">
        <Link
          href="/settings"
          className="flex items-center gap-3 rounded-md px-2.5 py-2 text-sm text-blue-200 hover:bg-white/10 hover:text-white transition-colors"
          title={collapsed ? 'Settings' : undefined}
        >
          <Settings className="h-5 w-5 shrink-0" />
          {!collapsed && <span>Settings</span>}
        </Link>

        {profile && (
          <div className={cn('flex items-center gap-3 px-2.5 py-2 mt-1', collapsed && 'justify-center')}>
            <Avatar className="h-7 w-7 shrink-0">
              <AvatarImage src={profile.avatar_url ?? undefined} />
              <AvatarFallback className="text-xs">{getInitials(profile.full_name)}</AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{profile.full_name}</p>
                <p className="text-xs text-blue-300 truncate">{profile.email}</p>
              </div>
            )}
          </div>
        )}

        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-sm text-blue-200 hover:bg-white/10 hover:text-white transition-colors mt-1"
          title={collapsed ? 'Sign out' : undefined}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>
    </aside>
  )
}
