import type { SupabaseClient } from '@supabase/supabase-js'
import type { ApprovalCheck, ApprovalStatus } from '@/types/approvals'

/**
 * Check whether a dataset version can be used for analysis.
 *
 * - If the project has no supervisors in its workspace → not_required → can_analyze: true
 * - If no approval request exists for the version → not_requested → blocked
 * - Otherwise → mirrors the request status
 */
export async function checkVersionApproval(
  version_id: string,
  project_id: string,
  supabaseClient: SupabaseClient
): Promise<ApprovalCheck> {
  // Fetch project workspace and approval request in parallel
  const [{ data: project }, { data: request }] = await Promise.all([
    supabaseClient
      .from('projects')
      .select('workspace_id')
      .eq('id', project_id)
      .single(),
    supabaseClient
      .from('dataset_approval_requests')
      .select('id, status, requested_at, reviewed_at, reviewer_note, approved_version_hash')
      .eq('version_id', version_id)
      .maybeSingle(),
  ])

  if (!project?.workspace_id) {
    return { status: 'not_required', can_analyze: true }
  }

  // Check if the workspace has any active supervisors
  const { data: supervisors } = await supabaseClient
    .from('workspace_memberships')
    .select('id')
    .eq('workspace_id', project.workspace_id)
    .eq('role', 'supervisor')
    .eq('status', 'active')
    .limit(1)

  if (!supervisors || supervisors.length === 0) {
    return { status: 'not_required', can_analyze: true }
  }

  if (!request) {
    return {
      status: 'not_requested',
      can_analyze: false,
      reason:
        'This dataset version has not been submitted for supervisor approval. ' +
        'Submit for approval before running analyses.',
    }
  }

  return {
    status: request.status as ApprovalStatus,
    request: {
      id: request.id,
      requested_at: request.requested_at,
      reviewed_at: request.reviewed_at,
      reviewer_note: request.reviewer_note,
      approved_version_hash: request.approved_version_hash,
    },
    can_analyze: request.status === 'approved',
    reason: request.status !== 'approved' ? getBlockedReason(request.status) : undefined,
  }
}

export function getBlockedReason(status: string): string {
  switch (status) {
    case 'pending':
      return 'Awaiting supervisor review. Analysis will be available once approved.'
    case 'in_review':
      return 'Supervisor is reviewing this dataset version. Analysis will be available once approved.'
    case 'rejected':
      return 'This dataset version was rejected by your supervisor. Review the feedback and submit a revised version.'
    case 'revision_requested':
      return 'Your supervisor has requested revisions. Review their feedback before resubmitting.'
    default:
      return 'Supervisor approval is required before analysis.'
  }
}
