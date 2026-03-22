"use client"

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn, formatDate } from '@/lib/utils'
import { AlertTriangle, CheckCircle2, Clock, Minus, ExternalLink } from 'lucide-react'
import type { Project, EthicsApplication } from '@/types/database'

interface ComplianceCardProps {
  project: Project
  ethics: EthicsApplication | null
}

function ethicsStatus(ethics: EthicsApplication | null): {
  label: string
  color: string
  icon: React.ReactNode
  expired: boolean
} {
  if (!ethics) return {
    label: 'No Application',
    color: 'text-gray-600 bg-gray-50 border-gray-200',
    icon: <Minus className="h-3.5 w-3.5" />,
    expired: false,
  }

  const now = new Date()
  const expiry = ethics.expires_at ? new Date(ethics.expires_at) : null
  const isExpired = expiry ? expiry < now : false

  if (isExpired) return {
    label: 'Expired',
    color: 'text-red-700 bg-red-50 border-red-200',
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
    expired: true,
  }

  if (ethics.status === 'approved') return {
    label: 'Approved',
    color: 'text-green-700 bg-green-50 border-green-200',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    expired: false,
  }

  if (ethics.status === 'pending' || ethics.status === 'submitted') return {
    label: 'Pending',
    color: 'text-yellow-700 bg-yellow-50 border-yellow-200',
    icon: <Clock className="h-3.5 w-3.5" />,
    expired: false,
  }

  return {
    label: ethics.status.replace(/_/g, ' '),
    color: 'text-gray-600 bg-gray-50 border-gray-200',
    icon: <Minus className="h-3.5 w-3.5" />,
    expired: false,
  }
}

export function ComplianceCard({ project, ethics }: ComplianceCardProps) {
  const { label, color, icon, expired } = ethicsStatus(ethics)
  const expiry = ethics?.expires_at

  return (
    <Card className="hover:shadow-sm transition-shadow">
      <CardContent className="p-4 flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm truncate">{project.title}</p>
          {ethics?.protocol_number && (
            <p className="text-xs text-muted-foreground mt-0.5">Protocol: {ethics.protocol_number}</p>
          )}
          {expiry && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {expired ? 'Expired' : 'Expires'}: {formatDate(expiry)}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Badge className={cn('text-xs border gap-1', color)}>
            {icon}
            {label}
          </Badge>

          {expired && (
            <Link href={`/projects/${project.id}`}>
              <Button size="sm" variant="destructive" className="h-6 text-[11px] px-2">
                Renew
              </Button>
            </Link>
          )}

          {ethics?.status === 'pending' && (
            <Link href={`/projects/${project.id}`}>
              <Button size="sm" variant="outline" className="h-6 text-[11px] px-2">
                Review
              </Button>
            </Link>
          )}

          <Link href={`/projects/${project.id}`}>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
