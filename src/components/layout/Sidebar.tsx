"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, FolderOpen, ClipboardList, Bell,
  FlaskConical, LogOut, Shield, ClipboardCheck
} from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { Profile } from '@/types/database'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/projects', label: 'Projects', icon: FolderOpen },
  { href: '/reviews', label: 'Reviews', icon: ClipboardList },
  { href: '/notifications', label: 'Notifications', icon: Bell },
]

const institutionItems = [
  { href: '/institution/compliance', label: 'Compliance', icon: ClipboardCheck },
  { href: '/institution/audit', label: 'Audit Log', icon: Shield },
]

interface SidebarProps {
  profile: Profile | null
  onSignOut: () => void
}

export function Sidebar({ profile, onSignOut }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside className="w-64 bg-card border-r flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="p-6 border-b">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-6 w-6 text-primary" />
          <span className="font-bold text-lg">PLEXUS</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">Research Lab</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map(item => {
          const Icon = item.icon
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link key={item.href} href={item.href}>
              <Button
                variant={active ? 'secondary' : 'ghost'}
                className={cn('w-full justify-start gap-3', active && 'font-medium')}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Button>
            </Link>
          )
        })}

        <div className="pt-3 pb-1">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-1">Institution</p>
          {institutionItems.map(item => {
            const Icon = item.icon
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={active ? 'secondary' : 'ghost'}
                  className={cn('w-full justify-start gap-3', active && 'font-medium')}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Button>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* User */}
      <div className="p-4 border-t">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
            {getInitials(profile?.full_name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{profile?.full_name ?? 'User'}</p>
            <p className="text-xs text-muted-foreground truncate capitalize">{profile?.role}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground" onClick={onSignOut}>
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </aside>
  )
}
