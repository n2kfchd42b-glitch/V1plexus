/**
 * Types for the thesis lifecycle workflow.
 *
 * The lifecycle is a finite state machine with eight states. Transitions are
 * declarative (DB table `allowed_thesis_transitions`) and gated by:
 *   - the actor's role relative to this thesis
 *   - per-edge conditions (chapter approval, ethics, defense)
 *   - the institution's policy snapshot frozen onto the thesis at creation
 */

export type ThesisLifecycleState =
  | 'matched'
  | 'proposal_draft'
  | 'proposal_review'
  | 'active'
  | 'chapter_review'
  | 'submitted'
  | 'approved'
  | 'archived'

export const THESIS_LIFECYCLE_ORDER: ThesisLifecycleState[] = [
  'matched',
  'proposal_draft',
  'proposal_review',
  'active',
  'chapter_review',
  'submitted',
  'approved',
  'archived',
]

/**
 * Role of a caller relative to a specific thesis. Resolved by
 * `getThesisRole(userId, projectId)` from existing membership tables —
 * never stored.
 */
export type ThesisRole =
  | 'student'
  | 'primary_supervisor'
  | 'co_supervisor'
  | 'committee_member'
  | 'coordinator'
  | 'admin'
  | 'guest'
  | 'none'

export interface AllowedTransition {
  from_state: ThesisLifecycleState
  to_state: ThesisLifecycleState
  required_role: ThesisRole
  requires_ethics_gate: boolean
  requires_all_chapters_approved: boolean
  requires_defense_pass: boolean
  description: string | null
}

// InstitutionThesisPolicy + ThesisPolicySnapshot live in src/types/database.ts
// (canonical hand-curated schema mirror). Re-export here so existing imports
// from '@/types/thesis-workflow' keep working without duplicating the shape.
export type { InstitutionThesisPolicy, ThesisPolicySnapshot } from '@/types/database'
import type { ThesisPolicySnapshot } from '@/types/database'

export interface ThesisLifecycleContext {
  thesis_id: string
  project_id: string
  current_state: ThesisLifecycleState
  policy: ThesisPolicySnapshot
}

/**
 * Outcome of a permission check. `allowed: false` always carries a `reason`
 * that's safe to surface to the user.
 */
export type PermissionVerdict =
  | { allowed: true }
  | { allowed: false; reason: string; code: PermissionDenyCode }

export type PermissionDenyCode =
  | 'not_authenticated'
  | 'role_mismatch'
  | 'no_such_transition'
  | 'ethics_gate_required'
  | 'chapters_not_approved'
  | 'defense_pass_required'
  | 'state_unchanged'
  | 'thesis_archived'

export interface TransitionRequest {
  to_state: ThesisLifecycleState
  reason?: string
}

export const FORCE_TRANSITION_ROLES: ReadonlySet<ThesisRole> = new Set([
  'coordinator',
  'admin',
])

export function canForceTransition(role: ThesisRole): boolean {
  return FORCE_TRANSITION_ROLES.has(role)
}

// ─── Chapter revision loop ──────────────────────────────────────────────────

export type ChapterSubmissionDecision = 'approved' | 'revision_requested'

export interface ThesisChapterSubmission {
  id: string
  chapter_id: string
  project_id: string
  student_id: string
  round: number
  document_id: string | null
  document_version_number: number | null
  note: string | null
  review_request_id: string | null
  submitted_at: string
  reviewed_by: string | null
  reviewed_at: string | null
  decision: ChapterSubmissionDecision | null
  feedback: string | null
}

export interface ChapterHistoryEntry {
  kind: 'submission' | 'document_version' | 'review_comment'
  at: string
  data: Record<string, unknown>
}
