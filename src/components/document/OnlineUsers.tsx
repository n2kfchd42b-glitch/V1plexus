"use client"

import { Users } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { getInitials } from '@/lib/utils'

export interface OnlineUser {
  id: string
  name: string
  color: string
}

interface OnlineUsersProps {
  users: OnlineUser[]
}

export function OnlineUsers({ users }: OnlineUsersProps) {
  if (users.length === 0) return null

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1.5">
        <Users className="h-3.5 w-3.5 text-muted-foreground" />
        <div className="flex -space-x-1.5">
          {users.slice(0, 5).map(user => (
            <Tooltip key={user.id}>
              <TooltipTrigger>
                <Avatar className="h-6 w-6 border-2 border-background">
                  <AvatarFallback
                    className="text-xs text-white font-medium"
                    style={{ backgroundColor: user.color }}
                  >
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">{user.name}</p>
              </TooltipContent>
            </Tooltip>
          ))}
          {users.length > 5 && (
            <div className="h-6 w-6 rounded-full bg-muted border-2 border-background flex items-center justify-center">
              <span className="text-xs font-medium">+{users.length - 5}</span>
            </div>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {users.length === 1 ? '1 editor' : `${users.length} editors`}
        </span>
      </div>
    </TooltipProvider>
  )
}
