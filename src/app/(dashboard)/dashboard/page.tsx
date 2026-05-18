import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const { data: membership } = await supabase
      .from('workspace_memberships')
      .select('role')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    if (membership?.role === 'supervisor') redirect('/supervisor/dashboard')
    if (membership?.role === 'student') redirect('/student/milestones')
  }

  redirect('/projects')
}
