"use client"

import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NotificationItem } from './NotificationItem'
import { useNotifications } from '@/hooks/useNotifications'
import { Separator } from '@/components/ui/separator'

interface NotificationListProps {
  userId: string
}

export function NotificationList({ userId }: NotificationListProps) {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications(userId)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllAsRead}>
            <Check className="h-4 w-4 mr-2" />
            Mark all as read
          </Button>
        )}
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        {notifications.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-muted-foreground">No notifications yet</p>
          </div>
        ) : (
          <div className="divide-y">
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
