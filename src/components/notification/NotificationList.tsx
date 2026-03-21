"use client"

import { Check, Bell } from 'lucide-react'
import { NotificationItem } from './NotificationItem'
import { useNotifications } from '@/hooks/useNotifications'

interface NotificationListProps {
  userId: string
}

export function NotificationList({ userId }: NotificationListProps) {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications(userId)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm text-[var(--text-tertiary)]">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="inline-flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-medium text-[var(--text-secondary)] border border-[var(--border-default)] hover:bg-[var(--bg-surface-hover)] transition-colors"
          >
            <Check className="h-3 w-3" />
            Mark all read
          </button>
        )}
      </div>

      <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg overflow-hidden">
        {notifications.length === 0 ? (
          <div className="py-16 text-center">
            <div className="h-12 w-12 mx-auto mb-3 rounded-full bg-[var(--bg-inset)] flex items-center justify-center">
              <Bell className="h-5 w-5 text-[var(--text-tertiary)]" />
            </div>
            <p className="text-base font-semibold text-[var(--text-primary)] mb-1">No notifications yet</p>
            <p className="text-sm text-[var(--text-tertiary)]">
              You&apos;re all caught up! Activity will appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-subtle)]">
            {notifications.map(notification => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkRead={markAsRead}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
