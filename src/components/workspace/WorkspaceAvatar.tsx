"use client"

import { cn } from '@/lib/utils'
import type { Workspace } from '@/types/database'
import { Building2, User } from 'lucide-react'

interface WorkspaceAvatarProps {
  workspace: Workspace | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeMap = {
  sm: 'h-6 w-6 text-xs',
  md: 'h-8 w-8 text-sm',
  lg: 'h-10 w-10 text-base',
}

const iconSizeMap = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
}

export function WorkspaceAvatar({ workspace, size = 'md', className }: WorkspaceAvatarProps) {
  const sizeClass = sizeMap[size]
  const iconClass = iconSizeMap[size]

  if (workspace?.avatar_url) {
    return (
      <img
        src={workspace.avatar_url}
        alt={workspace.name}
        className={cn('rounded-md object-cover flex-shrink-0', sizeClass, className)}
      />
    )
  }

  if (workspace?.type === 'institutional') {
    return (
      <div className={cn(
        'rounded-md flex items-center justify-center flex-shrink-0 bg-[#1B3A5C] text-white',
        sizeClass, className
      )}>
        <Building2 className={iconClass} />
      </div>
    )
  }

  return (
    <div className={cn(
      'rounded-md flex items-center justify-center flex-shrink-0 bg-[#2D3748] text-white',
      sizeClass, className
    )}>
      <User className={iconClass} />
    </div>
  )
}
