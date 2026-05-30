/**
 * Unified scope resolver for institution-level endpoints.
 *
 * Resolves a caller into the set of departments they're allowed to see/manage.
 * Combines the two historical auth models (profile-based admin gate and
 * workspace_memberships role rows) into one answer:
 *
 *   - Institution owner / institution admin → all departments in the institution
 *   - Department head(s)                    → only their assigned departments
 *   - Supervisor                            → all departments (route is expected
 *                                             to additionally filter by their
 *                                             own supervisor_id)
 *
 * Returns null when the caller has no institution affiliation at all.
 *
 * Usage:
 *   const scope = await getScope(supabase)
 *   if (!scope) return 403
 *   if (scope.departmentIds !== 'all') {
 *     query = query.in('department_id', scope.departmentIds)
 *   }
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface UserScope {
  userId: string
  institutionId: string
  isInstitutionAdmin: boolean
  isDepartmentHead: boolean
  isSupervisor: boolean
  departmentIds: string[] | 'all'
}

export async function getScope(
  supabase: SupabaseClient,
): Promise<UserScope | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, institution_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.institution_id) return null

  // Profile-level institution admin → full institution scope.
  // Mirrors getInstitutionAdminContext() so the two helpers agree.
  if (profile.role === 'admin') {
    return {
      userId: user.id,
      institutionId: profile.institution_id as string,
      isInstitutionAdmin: true,
      isDepartmentHead: false,
      isSupervisor: false,
      departmentIds: 'all',
    }
  }

  // Otherwise derive from workspace_memberships.
  const { data: memberships } = await supabase
    .from('workspace_memberships')
    .select('role, department_id')
    .eq('user_id', user.id)
    .eq('status', 'active')

  const ms = memberships ?? []

  // Workspace owner = institution admin (legacy path).
  if (ms.some(m => m.role === 'owner')) {
    return {
      userId: user.id,
      institutionId: profile.institution_id as string,
      isInstitutionAdmin: true,
      isDepartmentHead: false,
      isSupervisor: false,
      departmentIds: 'all',
    }
  }

  const headDeptIds = ms
    .filter(m => m.role === 'department_head' && m.department_id)
    .map(m => m.department_id as string)
  const isDepartmentHead = headDeptIds.length > 0
  const isSupervisor = ms.some(m => m.role === 'supervisor')

  if (!isDepartmentHead && !isSupervisor) return null

  return {
    userId: user.id,
    institutionId: profile.institution_id as string,
    isInstitutionAdmin: false,
    isDepartmentHead,
    isSupervisor,
    departmentIds: isDepartmentHead ? headDeptIds : 'all',
  }
}
