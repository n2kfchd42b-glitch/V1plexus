"use client"

import { CheckCircle, Clock, XCircle, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn, formatDate, statusColor } from '@/lib/utils'
import type { ApprovalGate, Profile } from '@/types/database'

interface ApprovalGateCardProps {
  gate: ApprovalGate
  currentProfile: Profile | null
  onApprove: (id: string) => void
  onBlock: (id: string) => void
}

const statusIcons = {
  pending: Clock,
  approved: CheckCircle,
  blocked: XCircle,
}

export function ApprovalGateCard({ gate, currentProfile, onApprove, onBlock }: ApprovalGateCardProps) {
  const Icon = statusIcons[gate.status] ?? Clock
  const canApprove = currentProfile?.role === 'supervisor' || currentProfile?.role === 'admin'

  return (
    <div className={cn(
      'rounded-lg border p-4 flex items-start gap-4',
      gate.status === 'approved' && 'border-green-200 bg-green-50/50',
      gate.status === 'blocked' && 'border-red-200 bg-red-50/50',
    )}>
      <div className={cn(
        'h-8 w-8 rounded-full flex items-center justify-center shrink-0',
        gate.status === 'approved' && 'bg-green-100 text-green-600',
        gate.status === 'blocked' && 'bg-red-100 text-red-600',
        gate.status === 'pending' && 'bg-yellow-100 text-yellow-600',
      )}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className="font-medium text-sm">{gate.title}</h4>
            {gate.description && (
              <p className="text-xs text-muted-foreground mt-0.5">{gate.description}</p>
            )}
          </div>
          <Badge className={cn('text-xs border', statusColor(gate.status))}>
            {gate.status}
          </Badge>
        </div>
        {gate.approved_at && (
          <p className="text-xs text-muted-foreground mt-2">
            Approved {formatDate(gate.approved_at)}
          </p>
        )}
        {gate.status === 'pending' && canApprove && (
          <div className="flex gap-2 mt-3">
            <Button size="sm" className="h-7 text-xs" onClick={() => onApprove(gate.id)}>
              <CheckCircle className="h-3 w-3 mr-1" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs text-red-600 hover:text-red-700"
              onClick={() => onBlock(gate.id)}
            >
              <XCircle className="h-3 w-3 mr-1" />
              Block
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
