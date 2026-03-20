"use client"

import { Calendar, Clock, FileText, ArrowRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn, formatDate, formatRelative, getInitials, priorityColor, statusColor, statusLabel } from '@/lib/utils'
import type { ReviewRequest } from '@/types/database'
import Link from 'next/link'

interface ReviewCardProps {
  review: ReviewRequest
  isActive?: boolean
  onClick?: () => void
}

export function ReviewCard({ review, isActive, onClick }: ReviewCardProps) {
  return (
    <div
      className={cn(
        'p-4 border-b cursor-pointer hover:bg-muted/50 transition-colors',
        isActive && 'bg-blue-50/50 border-l-2 border-l-blue-500'
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="text-xs">
            {getInitials(review.requester?.full_name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{review.document?.title ?? 'Untitled'}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {review.requester?.full_name ?? 'Unknown'} · {formatRelative(review.created_at)}
          </p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge className={cn('text-xs border', priorityColor(review.priority))}>
              {review.priority}
            </Badge>
            <Badge className={cn('text-xs border', statusColor(review.status))}>
              {statusLabel(review.status)}
            </Badge>
            {review.due_date && (
              <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                <Calendar className="h-3 w-3" />
                Due {formatDate(review.due_date)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
