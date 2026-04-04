"use client"

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, FolderOpen, ClipboardList, Bell,
  LogOut, Menu, X, Settings
} from 'lucide-react'
import { BrandLogo } from '@/components/layout/BrandLogo'
import { cn, getInitials } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { Profile } from '@/types/database'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/projects', label: 'Projects', icon: FolderOpen },
  { href: '/reviews', label: 'Reviews', icon: ClipboardList },
  { href: '/notifications', label: 'Notifications', icon: Bell },
  { href: '/settings/sso', label: 'SSO Settings', icon: Settings },
]

interface MobileSidebarProps {
  profile: Profile | null
  onSignOut: () => void
}

export function MobileSidebar({ profile, onSignOut }: MobileSidebarProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  return (
    <>
      {/* Hamburger button */}
      <button
        className="md:hidden fixed top-4 left-4 z-50 h-9 w-9 flex items-center justify-center rounded-lg bg-white border shadow-sm"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Overlay */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <aside
        className={cn(
          'md:hidden fixed inset-y-0 left-0 z-50 w-72 bg-card border-r flex flex-col h-screen transition-transform duration-300',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="p-4 border-b flex items-center justify-between">
          <BrandLogo variant="light" />
          <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map(item => {
            const Icon = item.icon
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>
                <Button
                  variant={active ? 'secondary' : 'ghost'}
                  className={cn('w-full justify-start gap-3 h-11', active && 'font-medium')}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </Button>
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold">
              {getInitials(profile?.full_name)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{profile?.full_name ?? 'User'}</p>
              <p className="text-xs text-muted-foreground truncate capitalize">{profile?.role}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-muted-foreground h-11"
            onClick={() => { setOpen(false); onSignOut() }}
          >
            <LogOut className="h-5 w-5" />
            Sign out
          </Button>
        </div>
      </aside>
    </>
  )
}
