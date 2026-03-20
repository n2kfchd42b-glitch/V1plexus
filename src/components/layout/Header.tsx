"use client"

import { NotificationBell } from '@/components/notification/NotificationBell'
import type { Profile } from '@/types/database'

interface HeaderProps {
  profile: Profile | null
  title?: string
}

export function Header({ profile, title }: HeaderProps) {
  return (
    <header className="h-14 border-b bg-card/50 backdrop-blur px-6 flex items-center justify-between sticky top-0 z-10">
      <h1 className="font-semibold text-sm text-muted-foreground">{title}</h1>
      <div className="flex items-center gap-2">
        {profile && <NotificationBell userId={profile.id} />}
      </div>
    </header>
  )
}
