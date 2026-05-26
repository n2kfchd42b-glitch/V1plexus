/**
 * Centralised permission check for thesis state transitions.
 *
 * Single entry point: `canTransition(supabase, userId, projectId, toState)`.
 * Resolves the caller's role, loads the thesis's policy snapshot, fetches
 * the gate state, and runs the state-machine evaluation in one pass.
 *
 * Server-side use only — the supabase client carries the caller's RLS
 * identity. The verdict is the source of truth; the underlying DB trigger
 * is the second layer of defense.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  PermissionVerdict,
  ThesisLifecycleContext,
  ThesisLifecycleState,
  ThesisRole,
} from '@/types/thesis-workflow'
import { getThesisRole, loadRoleInputs, resolveRole } from './role'
import { evaluateTransition, type GateState } from './stateMachine'
import { getThesisPolicySnapshot } from './policy'

export interface CanTransitionResult extends Record<string, unknown> {
  verdict: PermissionVerdict
  role: ThesisRole
  context: ThesisLifecycleContext | null
}

export async function canTransition(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  toState: ThesisLifecycleState,
): Promise<CanTransitionResult> {
  const inputs = await loadRoleInputs(supabase, projectId)
  if (!inputs) {
    return {
      verdict: { allowed: false, reason: 'Thesis not found', code: 'no_such_transition' },
      role: 'none',
      context: null,
    }
  }

  const role = await resolveRole(supabase, userId, inputs)
  if (role === 'none') {
    return {
      verdict: { allowed: false, reason: 'You have no access to this thesis', code: 'role_mismatch' },
      role,
      context: null,
    }
  }

  const [{ data: thesisRow }, policy] = await Promise.all([
    supabase
      .from('thesis_metadata')
      .select('id, lifecycle_state')
      .eq('project_id', projectId)
      .maybeSingle(),
    getThesisPolicySnapshot(supabase, projectId),
  ])

  if (!thesisRow) {
    return {
      verdict: { allowed: false, reason: 'Thesis metadata missing', code: 'no_such_transition' },
      role,
      context: null,
    }
  }

  const context: ThesisLifecycleContext = {
    thesis_id: thesisRow.id,
    project_id: projectId,
    current_state: thesisRow.lifecycle_state as ThesisLifecycleState,
    policy,
  }

  const gates = await loadGateState(supabase, projectId)
  const verdict = evaluateTransition(context, toState, role, gates)
  return { verdict, role, context }
}

/**
 * Read the current gate state for a thesis project. One query per gate so
 * the trigger and the application agree about what's true.
 */
export async function loadGateState(
  supabase: SupabaseClient,
  projectId: string,
): Promise<GateState> {
  const [ethics, chapters, defense] = await Promise.all([
    supabase
      .from('approval_gates')
      .select('id')
      .eq('project_id', projectId)
      .eq('gate_type', 'ethics')
      .eq('status', 'approved')
      .maybeSingle(),
    supabase
      .from('thesis_chapters')
      .select('id, status')
      .eq('project_id', projectId),
    supabase
      .from('thesis_defenses')
      .select('id, outcome')
      .eq('project_id', projectId)
      .in('outcome', ['pass', 'pass_with_corrections'])
      .maybeSingle(),
  ])

  const chapterRows = (chapters.data ?? []) as { status: string }[]
  const all_chapters_approved =
    chapterRows.length > 0 &&
    chapterRows.every((c) => c.status === 'approved' || c.status === 'locked')

  return {
    ethics_approved: !!ethics.data,
    all_chapters_approved,
    defense_passed: !!defense.data,
  }
}

/**
 * Convenience wrapper that returns just the role for callers that don't
 * need the full transition context.
 */
export { getThesisRole }
