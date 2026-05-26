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
} from '@/types/thesis-workflow'

const PERMISSIVE_DEFAULT: ThesisPolicySnapshot = {
  institution_id: '',
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
 * Get the snapshot frozen onto this thesis at creation. Falls back to the
 * permissive default for theses created before the snapshot column was
 * backfilled and for projects with no institution.
 */
export async function getThesisPolicySnapshot(
  supabase: SupabaseClient,
  projectId: string,
): Promise<ThesisPolicySnapshot> {
  const { data } = await supabase
    .from('thesis_metadata')
    .select('policy_snapshot, institution_id')
    .eq('project_id', projectId)
    .maybeSingle()

  if (data?.policy_snapshot) {
    return data.policy_snapshot as ThesisPolicySnapshot
  }

  // No snapshot yet — read the live institution policy as a fallback.
  if (data?.institution_id) {
    const live = await getLiveInstitutionPolicy(supabase, data.institution_id)
    if (live) return policyToSnapshot(live)
  }

  return PERMISSIVE_DEFAULT
}

export async function getLiveInstitutionPolicy(
  supabase: SupabaseClient,
  institutionId: string,
): Promise<InstitutionThesisPolicy | null> {
  const { data } = await supabase
    .from('institution_thesis_policy')
    .select('*')
    .eq('institution_id', institutionId)
    .maybeSingle()

  return (data as InstitutionThesisPolicy | null) ?? null
}

export function policyToSnapshot(policy: InstitutionThesisPolicy): ThesisPolicySnapshot {
  const { created_at: _ca, updated_at: _ua, updated_by: _ub, ...snapshot } = policy
  void _ca; void _ua; void _ub
  return snapshot
}
