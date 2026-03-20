"use client"

import { useAuth } from '@/hooks/useAuth'
import { NotificationList } from '@/components/notification/NotificationList'

export default function NotificationsPage() {
  const { profile } = useAuth()

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <NotificationList userId={profile.id} />
    </div>
  )
}
