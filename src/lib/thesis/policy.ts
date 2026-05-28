/**
 * Read the effective thesis policy for a thesis.
 *
 * Snapshot-first: every thesis carries the policy version that was current
 * at creation. We always serve that snapshot, never the live institution
 * policy, so a mid-flight policy change doesn't move the goalposts under
 * an in-progress student.
 *
 * Live policy is read only by the admin UI (institution settings page) and
 * by the thesis-creation flow (when snapshotting a new thesis).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  InstitutionThesisPolicy,
  ThesisPolicySnapshot,
} from '@/types/database'

const PERMISSIVE_DEFAULT: ThesisPolicySnapshot = {
  id: '',
  institution_id: '',
  programme_id: null,
  policy_version: 0,
  require_ethics_gate: false,
  allow_co_supervisors: true,
  max_co_supervisors: 2,
  require_oral_defense: false,
  require_proposal_defense: false,
  min_chapters: 1,
  default_chapter_titles: [],
  reminder_offsets_days: [7, 2],
  escalation_delay_hours: 24,
}

/**
 * Get the snapshot frozen onto this thesis at creation. If the snapshot is
 * missing (pre-PR-H rows, imports, or NULL projects), we *resolve* the
 * most-specific policy for the project owner via the
 * `resolve_thesis_policy_for_user` RPC — NOT the institution default. The
 * old "live institution default" fallback silently ignored programme
 * overrides and surfaced the wrong policy whenever a student had an
 * override-bearing enrollment.
 */
export async function getThesisPolicySnapshot(
  supabase: SupabaseClient,
  projectId: string,
): Promise<ThesisPolicySnapshot> {
  const { data } = await supabase
    .from('thesis_metadata')
    .select('policy_snapshot, institution_id, project_id, projects:projects!inner(owner_id)')
    .eq('project_id', projectId)
    .maybeSingle()

  if (data?.policy_snapshot) {
    return data.policy_snapshot as ThesisPolicySnapshot
  }

  // Fallback: resolve the most-specific policy via RPC so programme
  // overrides apply. The RPC is SECURITY DEFINER on the server side; only
  // service_role is granted execute, so this fallback path only really
  // works in server contexts. The browser path will see PERMISSIVE_DEFAULT.
  const ownerId = (data?.projects as { owner_id?: string } | null)?.owner_id ?? null
  if (data?.institution_id && ownerId) {
    const { data: resolved } = await supabase.rpc('resolve_thesis_policy_for_user', {
      p_user_id: ownerId,
      p_institution_id: data.institution_id,
    })
    if (resolved && (resolved as InstitutionThesisPolicy).id) {
      return policyToSnapshot(resolved as InstitutionThesisPolicy)
    }
  }

  return PERMISSIVE_DEFAULT
}

/**
 * Read the live institution-default policy row. Programme overrides are
 * *not* returned here — used only by the admin editor that wants to display
 * the institution default specifically. For "which policy applies to this
 * user," call the resolve_thesis_policy_for_user RPC.
 */
export async function getLiveInstitutionPolicy(
  supabase: SupabaseClient,
  institutionId: string,
): Promise<InstitutionThesisPolicy | null> {
  const { data } = await supabase
    .from('institution_thesis_policy')
    .select('*')
    .eq('institution_id', institutionId)
    .is('programme_id', null)
    .maybeSingle()

  return (data as InstitutionThesisPolicy | null) ?? null
}

export function policyToSnapshot(policy: InstitutionThesisPolicy): ThesisPolicySnapshot {
  const { created_at: _ca, updated_at: _ua, updated_by: _ub, ...snapshot } = policy
  void _ca; void _ua; void _ub
  return snapshot
}
