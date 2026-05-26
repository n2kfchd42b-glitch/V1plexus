/**
 * Resolve a caller's role relative to a specific thesis.
 *
 * The role is computed from existing membership tables — never stored —
 * so adding a co-supervisor automatically grants co-supervisor permissions
 * and removing one revokes them. No drift possible.
 *
 * Resolution precedence (first hit wins):
 *   1. admin              — workspace owner/admin or institution admin
 *   2. coordinator        — workspace coordinator/department_head
 *   3. primary_supervisor — thesis_metadata.supervisor_id match,
 *                           OR active 'primary' supervisor_assignment
 *   4. co_supervisor      — active 'co_supervisor' supervisor_assignment
 *   5. committee_member   — confirmed thesis_committees row
 *   6. student            — project owner
 *   7. guest              — anything else with project_members read access
 *   8. none               — no relationship
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ThesisRole } from '@/types/thesis-workflow'

interface ThesisRoleInputs {
  project_id: string
  project_owner_id: string
  workspace_id: string | null
  institution_id: string | null
  thesis_supervisor_id: string | null
}

/**
 * Fetch the minimal slice of project + thesis state needed to resolve roles.
 * Returns null when the project isn't a thesis or doesn't exist.
 */
export async function loadRoleInputs(
  supabase: SupabaseClient,
  projectId: string,
): Promise<ThesisRoleInputs | null> {
  const { data: project } = await supabase
    .from('projects')
    .select('id, owner_id, workspace_id, institution_id, project_type')
    .eq('id', projectId)
    .maybeSingle()

  if (!project || project.project_type !== 'thesis') return null

  const { data: thesis } = await supabase
    .from('thesis_metadata')
    .select('supervisor_id')
    .eq('project_id', projectId)
    .maybeSingle()

  return {
    project_id: project.id,
    project_owner_id: project.owner_id,
    workspace_id: project.workspace_id,
    institution_id: project.institution_id,
    thesis_supervisor_id: thesis?.supervisor_id ?? null,
  }
}

export async function getThesisRole(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
): Promise<ThesisRole> {
  const inputs = await loadRoleInputs(supabase, projectId)
  if (!inputs) return 'none'
  return resolveRole(supabase, userId, inputs)
}

/**
 * Pure-ish helper — takes pre-fetched inputs and does the membership lookups
 * separately. Split out so callers that already have `loadRoleInputs` results
 * don't re-fetch.
 */
export async function resolveRole(
  supabase: SupabaseClient,
  userId: string,
  inputs: ThesisRoleInputs,
): Promise<ThesisRole> {
  // 1. Institution / workspace admin
  if (inputs.institution_id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, institution_id')
      .eq('id', userId)
      .maybeSingle()

    if (profile?.role === 'admin' && profile.institution_id === inputs.institution_id) {
      return 'admin'
    }
  }

  if (inputs.workspace_id) {
    const { data: membership } = await supabase
      .from('workspace_memberships')
      .select('role')
      .eq('workspace_id', inputs.workspace_id)
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle()

    if (membership?.role === 'owner' || membership?.role === 'admin') return 'admin'
    if (membership?.role === 'department_head') return 'coordinator'
  }

  // 2. Coordinator at the institution level
  const { data: coordProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()
  if (coordProfile?.role === 'coordinator') return 'coordinator'

  // 3. Primary supervisor
  if (inputs.thesis_supervisor_id === userId) return 'primary_supervisor'

  const { data: primaryAssignment } = await supabase
    .from('supervisor_assignments')
    .select('id')
    .eq('supervisor_id', userId)
    .eq('student_id', inputs.project_owner_id)
    .eq('role', 'primary')
    .eq('status', 'active')
    .maybeSingle()
  if (primaryAssignment) return 'primary_supervisor'

  // 4. Co-supervisor
  const { data: coAssignment } = await supabase
    .from('supervisor_assignments')
    .select('id')
    .eq('supervisor_id', userId)
    .eq('student_id', inputs.project_owner_id)
    .eq('role', 'co_supervisor')
    .eq('status', 'active')
    .maybeSingle()
  if (coAssignment) return 'co_supervisor'

  // 5. Committee member
  const { data: committee } = await supabase
    .from('thesis_committees')
    .select('id')
    .eq('project_id', inputs.project_id)
    .eq('user_id', userId)
    .eq('status', 'confirmed')
    .maybeSingle()
  if (committee) return 'committee_member'

  // 6. Student (project owner)
  if (inputs.project_owner_id === userId) return 'student'

  // 7. Guest with project membership
  const { data: member } = await supabase
    .from('project_members')
    .select('id')
    .eq('project_id', inputs.project_id)
    .eq('user_id', userId)
    .maybeSingle()
  if (member) return 'guest'

  return 'none'
}
