"use client"

export const dynamic = 'force-dynamic'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SetupPage() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('workspace_setup_completed')
        .eq('id', user.id)
        .maybeSingle()

      if (profile?.workspace_setup_completed) {
        router.push('/projects')
        return
      }

      // Individual researcher workspace only — skip chooser
      router.push('/setup/individual')
    }
    check()
  }, [router, supabase])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin h-8 w-8 rounded-full border-2 border-blue-600 border-t-transparent" />
    </div>
  )
}
