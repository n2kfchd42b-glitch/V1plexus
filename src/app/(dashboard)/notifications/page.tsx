"use client"

import { useAuth } from '@/hooks/useAuth'
import { NotificationList } from '@/components/notification/NotificationList'
import { Bell } from 'lucide-react'

export default function NotificationsPage() {
  const { profile } = useAuth()

  if (!profile) {
    return (
      <div className="px-6 py-5 max-w-3xl mx-auto">
        <div className="mb-6">
          <div className="skeleton h-7 w-40 mb-1.5" />
          <div className="skeleton h-4 w-24" />
        </div>
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-4">
              <div className="skeleton h-4 w-3/4 mb-2" />
              <div className="skeleton h-3 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="px-6 py-5 max-w-3xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-[var(--text-primary)] tracking-tight">Inbox</h1>
        <p className="text-sm text-[var(--text-tertiary)] mt-0.5">Your notifications and activity</p>
      </div>
      <NotificationList userId={profile.id} />
    </div>
  )
}
