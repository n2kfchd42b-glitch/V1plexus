"use client"

import { Bell, FileText, CheckCircle, MessageSquare, Shield, UserPlus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn, formatRelative } from '@/lib/utils'
import type { Notification } from '@/types/database'

const typeIcons = {
  review_request:      FileText,
  review_complete:     CheckCircle,
  ethics_expiry:       Shield,
  comment:             MessageSquare,
  gate_approved:       CheckCircle,
  invitation_received: UserPlus,
  supervisor_note:     MessageSquare,
  supervision_session: FileText,
}

const typeColors = {
  review_request:      'text-[var(--accent-blue)] bg-[var(--accent-blue-subtle)]',
  review_complete:     'text-[var(--status-success-text)] bg-[var(--status-success-bg)]',
  ethics_expiry:       'text-[var(--status-warning-text)] bg-[var(--status-warning-bg)]',
  comment:             'text-purple-600 bg-purple-50',
  gate_approved:       'text-[var(--status-success-text)] bg-[var(--status-success-bg)]',
  invitation_received: 'text-emerald-600 bg-emerald-50',
  supervisor_note:     'text-indigo-600 bg-indigo-50',
  supervision_session: 'text-indigo-600 bg-indigo-50',
}

interface NotificationItemProps {
  notification: Notification
  onMarkRead: (id: string) => void
  onClose?: () => void
}

export function NotificationItem({ notification, onMarkRead, onClose }: NotificationItemProps) {
  const router = useRouter()
  const Icon = typeIcons[notification.type as keyof typeof typeIcons] ?? Bell
  const iconColor = typeColors[notification.type as keyof typeof typeColors] ?? 'text-[var(--text-tertiary)] bg-[var(--bg-inset)]'

  const handleClick = () => {
    if (!notification.is_read) onMarkRead(notification.id)
    if (notification.link) {
      onClose?.()
      router.push(notification.link)
    }
  }

  return (
    <div
      className={cn(
        'flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors duration-100',
        'hover:bg-[var(--bg-surface-hover)]',
        !notification.is_read && 'bg-[var(--accent-blue-subtle)]/50'
      )}
      onClick={handleClick}
    >
      {/* Unread dot */}
      {!notification.is_read && (
        <div className="mt-2 h-1.5 w-1.5 rounded-full bg-[var(--accent-primary)] flex-shrink-0" />
      )}
      {notification.is_read && <div className="mt-2 h-1.5 w-1.5 flex-shrink-0" />}

      {/* Icon */}
      <div className={cn('h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5', iconColor)}>
        <Icon className="h-3.5 w-3.5" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-sm leading-tight',
          !notification.is_read ? 'font-semibold text-[var(--text-primary)]' : 'font-normal text-[var(--text-secondary)]'
        )}>
          {notification.title}
        </p>
        {notification.body && (
          <p className="text-xs text-[var(--text-tertiary)] mt-0.5 line-clamp-2">
            {notification.body}
          </p>
        )}
        <p className="text-xs text-[var(--text-tertiary)] mt-1">
          {formatRelative(notification.created_at)}
        </p>
      </div>
    </div>
  )
}
