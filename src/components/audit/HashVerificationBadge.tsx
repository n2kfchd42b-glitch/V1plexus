"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ShieldCheck, ShieldAlert, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { AuditLog } from '@/types/database'

async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

interface HashVerificationBadgeProps {
  projectId?: string
}

export function HashVerificationBadge({ projectId }: HashVerificationBadgeProps) {
  const [status, setStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle')
  const supabase = createClient()

  const verify = async () => {
    setStatus('checking')
    try {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('timestamp', { ascending: true })

      if (projectId) query = query.eq('project_id', projectId)

      const { data: entries } = await query.limit(500)
      if (!entries || entries.length === 0) { setStatus('valid'); return }

      let valid = true
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i] as AuditLog
        const prevHash = i === 0 ? null : (entries[i - 1] as AuditLog).entry_hash

        const content = JSON.stringify({
          timestamp: entry.timestamp,
          actor_id: entry.actor_id,
          action: entry.action,
          resource_type: entry.resource_type,
          resource_id: entry.resource_id,
          project_id: entry.project_id,
          institution_id: entry.institution_id,
          details: entry.details,
          prev_hash: prevHash,
        })

        const computed = await sha256(content)
        if (computed !== entry.entry_hash) { valid = false; break }
        if (entry.prev_hash !== prevHash) { valid = false; break }
      }

      setStatus(valid ? 'valid' : 'invalid')
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
