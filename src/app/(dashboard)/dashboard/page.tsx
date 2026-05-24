import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    // Derived role: supervisor if they have any active supervisees, student if
    // they have an active supervisor. Either path lands first.
    const [supRes, stuRes] = await Promise.all([
      supabase
        .from('supervisor_assignments')
        .select('id', { count: 'exact', head: true })
        .eq('supervisor_id', user.id)
        .eq('status', 'active'),
      supabase
        .from('supervisor_assignments')
        .select('id', { count: 'exact', head: true })
        .eq('student_id', user.id)
        .eq('status', 'active'),
    ])
    if ((supRes.count ?? 0) > 0) redirect('/supervisor/dashboard')
    if ((stuRes.count ?? 0) > 0) redirect('/student/milestones')
  }

  redirect('/projects')
}
