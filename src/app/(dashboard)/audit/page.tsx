"use client"

import { useEffect, useState } from 'react'
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
    <div className="px-8 py-6 max-w-[1600px] mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 font-headline">Audit Trail</h1>
        <p className="text-slate-500 mt-1 font-medium text-sm">
          A complete log of all actions performed in your personal workspace.
        </p>
      </div>

      {userId && <AuditLogViewer actorId={userId} />}
    </div>
  )
}
