/**
 * Pure state-machine logic for the thesis lifecycle.
 *
 * Mirrors the DB tables `allowed_thesis_transitions` and the gate trigger,
 * so the UI can preview what's possible without an extra round-trip and the
 * API can short-circuit obviously-illegal calls before hitting Postgres.
 *
 * The database trigger is still authoritative — this module exists to give
 * the application layer the same answers without a round-trip.
 */

import type {
  AllowedTransition,
  PermissionVerdict,
  ThesisLifecycleContext,
  ThesisLifecycleState,
  ThesisRole,
} from '@/types/thesis-workflow'
import { canForceTransition } from '@/types/thesis-workflow'

/**
 * Canonical workflow. Kept in sync with the seed in
 * supabase/migrations/20260524000005_thesis_lifecycle_foundation.sql.
 * Coordinator / admin edges are NOT listed here — they bypass the table
 * via canForceTransition().
 */
export const CANONICAL_TRANSITIONS: AllowedTransition[] = [
  {
    from_state: 'matched', to_state: 'proposal_draft',
    required_role: 'primary_supervisor',
    requires_ethics_gate: false, requires_all_chapters_approved: false, requires_defense_pass: false,
    description: 'Supervisor accepts and opens proposal drafting',
  },
  {
    from_state: 'matched', to_state: 'proposal_draft',
    required_role: 'student',
    requires_ethics_gate: false, requires_all_chapters_approved: false, requires_defense_pass: false,
    description: 'Student begins proposal after supervisor confirmation',
  },
  {
    from_state: 'proposal_draft', to_state: 'proposal_review',
    required_role: 'student',
    requires_ethics_gate: false, requires_all_chapters_approved: false, requires_defense_pass: false,
    description: 'Student submits proposal for supervisor review',
  },
  {
    from_state: 'proposal_review', to_state: 'proposal_draft',
    required_role: 'primary_supervisor',
    requires_ethics_gate: false, requires_all_chapters_approved: false, requires_defense_pass: false,
    description: 'Supervisor requests revisions to proposal',
  },
  {
    from_state: 'proposal_review', to_state: 'active',
    required_role: 'primary_supervisor',
    requires_ethics_gate: false, requires_all_chapters_approved: false, requires_defense_pass: false,
    description: 'Supervisor approves proposal — research begins',
  },
  {
    from_state: 'active', to_state: 'chapter_review',
    required_role: 'student',
    requires_ethics_gate: false, requires_all_chapters_approved: true, requires_defense_pass: false,
    description: 'Student submits all chapters for final review',
  },
  {
    from_state: 'chapter_review', to_state: 'active',
    required_role: 'primary_supervisor',
    requires_ethics_gate: false, requires_all_chapters_approved: false, requires_defense_pass: false,
    description: 'Supervisor requests revisions on chapters',
  },
  {
    from_state: 'chapter_review', to_state: 'submitted',
    required_role: 'primary_supervisor',
    requires_ethics_gate: false, requires_all_chapters_approved: false, requires_defense_pass: false,
    description: 'Supervisor signs off on chapters — ready for defense',
  },
  {
    from_state: 'submitted', to_state: 'approved',
    required_role: 'primary_supervisor',
    requires_ethics_gate: false, requires_all_chapters_approved: false, requires_defense_pass: false,
    description: 'Supervisor records pass (when no oral defense required)',
  },
  {
    from_state: 'approved', to_state: 'archived',
    required_role: 'coordinator',
    requires_ethics_gate: false, requires_all_chapters_approved: false, requires_defense_pass: false,
    description: 'Coordinator archives completed thesis',
  },
]

/**
 * Find the edge matching (from, to, role). Returns null if no canonical
 * edge exists — caller decides whether to fall back to force-transition.
 */
export function findTransition(
  from: ThesisLifecycleState,
  to: ThesisLifecycleState,
  role: ThesisRole,
): AllowedTransition | null {
  return CANONICAL_TRANSITIONS.find(
    (t) => t.from_state === from && t.to_state === to && t.required_role === role,
  ) ?? null
}

export interface GateState {
  ethics_approved: boolean
  all_chapters_approved: boolean
  defense_passed: boolean
}

/**
 * Effective gates merge the edge's required gates with the institution's
 * policy. Some gates (oral defense) come from policy, not the edge.
 */
export function getEffectiveGates(
  edge: AllowedTransition,
  context: ThesisLifecycleContext,
): Pick<AllowedTransition, 'requires_ethics_gate' | 'requires_all_chapters_approved' | 'requires_defense_pass'> {
  const { policy } = context

  return {
    requires_ethics_gate:
      edge.requires_ethics_gate ||
      (edge.to_state === 'active' && policy.require_ethics_gate),
    requires_all_chapters_approved: edge.requires_all_chapters_approved,
    requires_defense_pass:
      edge.requires_defense_pass ||
      (edge.from_state === 'submitted' &&
        edge.to_state === 'approved' &&
        policy.require_oral_defense),
  }
}

/**
 * Decide whether a transition is currently allowed. Pure — takes the
 * gate state as input so callers can fetch it once and reuse.
 */
export function evaluateTransition(
  context: ThesisLifecycleContext,
  to: ThesisLifecycleState,
  role: ThesisRole,
  gates: GateState,
): PermissionVerdict {
  if (context.current_state === to) {
    return { allowed: false, reason: 'Thesis is already in this state', code: 'state_unchanged' }
  }

  if (context.current_state === 'archived' && !canForceTransition(role)) {
    return { allowed: false, reason: 'Archived theses are read-only', code: 'thesis_archived' }
  }

  if (canForceTransition(role)) {
    return { allowed: true }
  }

  const edge = findTransition(context.current_state, to, role)
  if (!edge) {
    return {
      allowed: false,
      reason: `Your role (${role}) cannot move this thesis from ${context.current_state} to ${to}`,
      code: 'no_such_transition',
    }
  }

  const effective = getEffectiveGates(edge, context)

  if (effective.requires_ethics_gate && !gates.ethics_approved) {
    return {
      allowed: false,
      reason: 'An approved ethics gate is required before research can begin',
      code: 'ethics_gate_required',
    }
  }

  if (effective.requires_all_chapters_approved && !gates.all_chapters_approved) {
    return {
      allowed: false,
      reason: 'All chapters must be approved before final review',
      code: 'chapters_not_approved',
    }
  }

  if (effective.requires_defense_pass && !gates.defense_passed) {
    return {
      allowed: false,
      reason: 'A passing defense outcome is required to mark the thesis approved',
      code: 'defense_pass_required',
    }
  }

  return { allowed: true }
}

/**
 * Enumerate every reachable next state for a given role. Used by the UI
 * to render only the actions the caller can actually take.
 */
export function nextStatesFor(
  current: ThesisLifecycleState,
  role: ThesisRole,
): ThesisLifecycleState[] {
  if (canForceTransition(role)) {
    return Array.from(
      new Set(CANONICAL_TRANSITIONS.filter((t) => t.from_state === current).map((t) => t.to_state)),
    )
  }
  return CANONICAL_TRANSITIONS
    .filter((t) => t.from_state === current && t.required_role === role)
    .map((t) => t.to_state)
}
