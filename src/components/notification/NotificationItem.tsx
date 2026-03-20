"use client"

import { Bell, FileText, CheckCircle, MessageSquare, Shield } from 'lucide-react'
import { cn, formatRelative } from '@/lib/utils'
import type { Notification } from '@/types/database'

const typeIcons = {
  review_request: FileText,
  review_complete: CheckCircle,
  ethics_expiry: Shield,
  comment: MessageSquare,
  gate_approved: CheckCircle,
}

const typeColors = {
  review_request: 'text-blue-500',
  review_complete: 'text-green-500',
  ethics_expiry: 'text-orange-500',
  comment: 'text-purple-500',
  gate_approved: 'text-emerald-500',
}

interface NotificationItemProps {
  notification: Notification
  onMarkRead: (id: string) => void
}

export function NotificationItem({ notification, onMarkRead }: NotificationItemProps) {
  const Icon = typeIcons[notification.type] ?? Bell
  const iconColor = typeColors[notification.type] ?? 'text-gray-500'

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-4 hover:bg-muted/50 cursor-pointer transition-colors',
        !notification.is_read && 'bg-blue-50/50 border-l-2 border-l-blue-500'
      )}
      onClick={() => !notification.is_read && onMarkRead(notification.id)}
    >
      <div className={cn('mt-0.5 shrink-0', iconColor)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm', !notification.is_read ? 'font-medium' : 'font-normal')}>
          {notification.title}
        </p>
        {notification.body && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {notification.body}
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          {formatRelative(notification.created_at)}
        </p>
      </div>
      {!notification.is_read && (
        <div className="h-2 w-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
      )}
    </div>
  )
}
