import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isPlatformAdmin } from '@/lib/admin/platformAdmin'

// GET /api/me/roles
// Returns derived role flags for the current user. Used by the sidebar to
// decide which sections (Supervision / My Research) to render — replaces
// fragile client-side query chains that race or get blocked by schema cache.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [profileRes, supAssignRes, stuAssignRes, membershipRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('available_to_supervise')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('supervisor_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('supervisor_id', user.id)
      .in('status', ['active', 'pending']),
    supabase
      .from('supervisor_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', user.id)
      .in('status', ['active', 'pending']),
    supabase
      .from('workspace_memberships')
      .select('role, workspace:workspaces(type)')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle(),
  ])

  const optedIn = profileRes.data?.available_to_supervise === true
  const supervisingCount = supAssignRes.count ?? 0
  const beingSupervisedCount = stuAssignRes.count ?? 0
  const legacyRole = membershipRes.data?.role as string | undefined
  const wsType = (membershipRes.data?.workspace as { type?: string } | null)?.type ?? null

  return NextResponse.json({
    is_supervisor: optedIn || supervisingCount > 0 || legacyRole === 'supervisor',
    is_student: beingSupervisedCount > 0 || legacyRole === 'student',
    is_platform_admin: isPlatformAdmin(user.id),
    workspace_type: wsType,
    supervising_count: supervisingCount,
    being_supervised_count: beingSupervisedCount,
    available_to_supervise: optedIn,
  })
}
