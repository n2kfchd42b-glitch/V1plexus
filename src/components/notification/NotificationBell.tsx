"use client"

import { useState } from 'react'
import { Bell, Check } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { NotificationItem } from './NotificationItem'
import { useNotifications } from '@/hooks/useNotifications'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import Link from 'next/link'

interface NotificationBellProps {
  userId: string
}

export function NotificationBell({ userId }: NotificationBellProps) {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications(userId)
  const [open, setOpen] = useState(false)
  const recent = notifications.slice(0, 8)

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button className="relative h-8 w-8 flex items-center justify-center rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors duration-100">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-[var(--status-error)] text-white text-[10px] flex items-center justify-center font-semibold count-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0 shadow-lg rounded-xl border border-[var(--border-default)]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)]">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Notifications</h3>
          {unreadCount > 0 && (
            <button
              className="inline-flex items-center gap-1 h-6 px-2 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
              onClick={markAllAsRead}
            >
              <Check className="h-3 w-3" />
              Mark all read
            </button>
          )}
        </div>

        <ScrollArea className="max-h-[380px]">
          {recent.length === 0 ? (
            <div className="py-10 text-center">
              <Bell className="h-8 w-8 mx-auto text-[var(--text-tertiary)] mb-2" />
              <p className="text-sm text-[var(--text-tertiary)]">No notifications</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-subtle)]">
              {recent.map(notification => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkRead={markAsRead}
                  onClose={() => setOpen(false)}
                />
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="p-2 border-t border-[var(--border-subtle)]">
          <Link href="/notifications">
            <button className="w-full h-7 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] rounded-md transition-colors">
              View all notifications
            </button>
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
