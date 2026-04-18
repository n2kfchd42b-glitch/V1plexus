"use client"

import { useEffect, useState } from 'react'
import { AuditLogViewer } from '@/components/audit/AuditLogViewer'
import { createClient } from '@/lib/supabase/client'

export default function PersonalAuditPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null)
      setLoading(false)
    })
  }, [supabase])

  return (
    <div className="px-8 py-6 max-w-[1600px] mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 font-headline">My Activity</h1>
        <p className="text-slate-500 mt-1 font-medium text-sm">
          Every action you have performed across your projects — cryptographically recorded and tamper-evident.
        </p>
      </div>

      {loading && (
        <p className="text-sm text-muted-foreground">Loading...</p>
      )}
      {!loading && userId && <AuditLogViewer actorId={userId} />}
      {!loading && !userId && (
        <p className="text-sm text-muted-foreground">Could not load user session.</p>
      )}
    </div>
  )
}
