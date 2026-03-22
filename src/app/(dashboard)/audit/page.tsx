"use client"

import { useEffect, useState } from 'react'
import { Activity } from 'lucide-react'
import { AuditLogViewer } from '@/components/audit/AuditLogViewer'
import { createClient } from '@/lib/supabase/client'

export default function PersonalAuditPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id)
    })
  }, [supabase])

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">Audit Trail</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          A complete log of all actions performed in your personal workspace.
        </p>
      </div>

      {userId && <AuditLogViewer actorId={userId} />}
    </div>
  )
}
