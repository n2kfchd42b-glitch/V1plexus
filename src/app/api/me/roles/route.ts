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

  const [profileRes, supAssignRes, stuAssignRes, membershipRes, headRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('available_to_supervise, role, institution_id')
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
    // All depts this user heads (could be more than one across workspaces in
    // principle; the schema's UNIQUE(workspace_id, user_id) caps it at one
    // per workspace today, but read defensively).
    supabase
      .from('workspace_memberships')
      .select('department_id, department:departments(id, name)')
      .eq('user_id', user.id)
      .eq('role', 'department_head')
      .eq('status', 'active')
      .not('department_id', 'is', null),
  ])

  const optedIn = profileRes.data?.available_to_supervise === true
  const supervisingCount = supAssignRes.count ?? 0
  const beingSupervisedCount = stuAssignRes.count ?? 0
  const legacyRole = membershipRes.data?.role as string | undefined
  const wsType = (membershipRes.data?.workspace as { type?: string } | null)?.type ?? null

  const profileRole = profileRes.data?.role as string | undefined
  const institutionId = profileRes.data?.institution_id as string | null | undefined
  const isInstitutionAdmin = profileRole === 'admin' && !!institutionId

  const headDepts = (headRes.data ?? [])
    .map(r => (r as unknown as { department: { id: string; name: string } | null }).department)
    .filter((d): d is { id: string; name: string } => d !== null)

  return NextResponse.json({
    is_supervisor: optedIn || supervisingCount > 0 || legacyRole === 'supervisor' || headDepts.length > 0,
    is_student: beingSupervisedCount > 0 || legacyRole === 'student',
    is_platform_admin: isPlatformAdmin(user.id),
    is_institution_admin: isInstitutionAdmin,
    is_department_head: headDepts.length > 0,
    head_departments: headDepts,
    institution_id: institutionId ?? null,
    workspace_type: wsType,
    supervising_count: supervisingCount,
    being_supervised_count: beingSupervisedCount,
    available_to_supervise: optedIn,
  })
}
