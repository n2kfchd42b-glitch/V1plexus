"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ShieldCheck, ShieldAlert, Loader2 } from 'lucide-react'

interface HashVerificationBadgeProps {
  projectId?: string
}

export function HashVerificationBadge({ projectId }: HashVerificationBadgeProps) {
  const [status, setStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle')

  const verify = async () => {
    setStatus('checking')
    try {
      const params = new URLSearchParams()
      if (projectId) params.set('project_id', projectId)

      const res = await fetch(`/api/audit/verify?${params}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const result = await res.json()
      setStatus(result.violations?.length === 0 ? 'valid' : 'invalid')
    } catch {
      setStatus('invalid')
    }
  }

  if (status === 'idle') {
    return (
      <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={verify}>
        <ShieldCheck className="h-3.5 w-3.5" />
        Verify Chain
      </Button>
    )
  }

  if (status === 'checking') {
    return (
      <Badge variant="outline" className="gap-1.5 text-xs">
        <Loader2 className="h-3 w-3 animate-spin" />
        Verifying...
      </Badge>
    )
  }

  if (status === 'valid') {
    return (
      <Badge className="gap-1.5 text-xs text-green-700 bg-green-50 border-green-200 border">
        <ShieldCheck className="h-3 w-3" />
        Chain Intact
      </Badge>
    )
  }

  return (
    <Badge className="gap-1.5 text-xs text-red-700 bg-red-50 border-red-200 border">
      <ShieldAlert className="h-3 w-3" />
      Chain Broken
    </Badge>
  )
}
