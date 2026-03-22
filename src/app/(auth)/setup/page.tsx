"use client"

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { WorkspaceChooser } from '@/components/auth/WorkspaceChooser'

export default function SetupPage() {
  const [userName, setUserName] = useState('')
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, workspace_setup_completed')
        .eq('id', user.id)
        .maybeSingle()

      if (profile?.workspace_setup_completed) {
        router.push('/dashboard')
        return
      }

      setUserName(profile?.full_name ?? user.email?.split('@')[0] ?? 'there')
      setLoading(false)
    }
    check()
  }, [router, supabase])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    )
  }

  return <WorkspaceChooser userName={userName} />
}
