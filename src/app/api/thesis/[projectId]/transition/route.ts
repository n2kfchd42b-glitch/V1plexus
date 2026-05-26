import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { writeAuditEntry } from '@/lib/audit/auditLogger'
import { canTransition } from '@/lib/thesis/permissions'
import { canForceTransition } from '@/types/thesis-workflow'
import type { ThesisLifecycleState, ThesisRole } from '@/types/thesis-workflow'

const TransitionSchema = z.object({
  to_state: z.enum([
    'matched',
    'proposal_draft',
    'proposal_review',
    'active',
    'chapter_review',
    'submitted',
    'approved',
    'archived',
  ]),
  reason: z.string().max(2000).optional(),
})

/**
 * The only writer for thesis_metadata.lifecycle_state.
 *
 * Pipeline:
 *   1. Authenticate the caller
 *   2. Resolve their role and check the transition against the state machine
 *      (with the policy snapshot frozen onto this thesis)
 *   3. If allowed, call the SECURITY DEFINER RPC which sets the actor role,
 *      performs the UPDATE, and lets the guard trigger validate from the DB
 *      side as defense in depth
 *   4. Write an audit entry — coordinator/admin force transitions get a
 *      separate action name so they show up in the audit timeline
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = TransitionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const { to_state, reason } = parsed.data

  const { verdict, role, context } = await canTransition(supabase, user.id, projectId, to_state)
  if (!verdict.allowed) {
    return NextResponse.json(
      { error: verdict.reason, code: verdict.code },
      { status: verdict.code === 'role_mismatch' ? 403 : 400 },
    )
  }
  if (!context) {
    return NextResponse.json({ error: 'Thesis not found' }, { status: 404 })
  }

  const forced = canForceTransition(role)
  if (forced && !reason) {
    return NextResponse.json(
      { error: 'A reason is required for coordinator/admin force-transitions' },
      { status: 400 },
    )
  }

  const service = createServiceClient()
  const { data: updated, error } = await service.rpc('transition_thesis_state', {
    p_project_id: projectId,
    p_to_state:   to_state,
    p_actor_role: roleToTriggerRole(role),
    p_actor_id:   user.id,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 409 })
  }

  void writeAuditEntry({
    actor_id: user.id,
    action: forced ? 'thesis.state.force_transitioned' : 'thesis.state.transitioned',
    resource_type: 'thesis_metadata',
    resource_id: context.thesis_id,
    project_id: projectId,
    details: {
      summary: `Thesis ${context.current_state} → ${to_state}`,
      operation: {
        from: context.current_state,
        to: to_state,
        role,
        policy_version: context.policy.policy_version,
        reason: reason ?? null,
      },
    },
  })

  return NextResponse.json({
    success: true,
    thesis: updated,
    from: context.current_state,
    to: to_state,
    role,
  })
}

/**
 * Roles the DB trigger recognises. UI-facing roles like `co_supervisor`
 * and `committee_member` aren't transition actors — they cannot move
 * state, so they never reach the RPC.
 */
function roleToTriggerRole(role: ThesisRole): 'student' | 'primary_supervisor' | 'coordinator' | 'admin' | 'system' {
  switch (role) {
    case 'student':
    case 'primary_supervisor':
    case 'coordinator':
    case 'admin':
      return role
    default:
      return 'system'
  }
}

/**
 * GET — preview which transitions the caller can make right now.
 * Used by the UI to render only the buttons that would succeed.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const possibleStates: ThesisLifecycleState[] = [
    'matched', 'proposal_draft', 'proposal_review', 'active',
    'chapter_review', 'submitted', 'approved', 'archived',
  ]

  const results = await Promise.all(
    possibleStates.map(async (state) => {
      const { verdict, role, context } = await canTransition(supabase, user.id, projectId, state)
      return { state, verdict, role, current: context?.current_state ?? null }
    }),
  )

  const allowed = results.filter((r) => r.verdict.allowed)
  const current = results.find((r) => r.current)?.current ?? null
  const role = results[0]?.role ?? 'none'

  return NextResponse.json({
    current_state: current,
    role,
    allowed_next: allowed.map((r) => r.state),
    denied: results
      .filter((r) => !r.verdict.allowed && r.state !== current)
      .map((r) => ({
        state: r.state,
        reason: r.verdict.allowed ? null : r.verdict.reason,
        code:   r.verdict.allowed ? null : r.verdict.code,
      })),
  })
}
