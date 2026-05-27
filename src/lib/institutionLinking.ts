/**
 * Institution linking helpers (PR B).
 *
 * Centralises the "approve a link request" transition so the user auto-approval
 * path and the admin manual approval path do the same thing:
 *   1. Find the institutional workspace
 *   2. Set profiles.institution_id
 *   3. Upsert an active workspace_memberships row
 *   4. Insert / update the institution_link_requests row to status='approved'
 *
 * Always called with a service-role client because steps 2–4 cross RLS
 * boundaries that no single user can satisfy.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// The shared helper is called from both the user-facing route (service client
// typed via createServiceClient) and the admin route (same). Both produce the
// untyped default SupabaseClient, so we accept the generic shape here.
type ServiceClient = SupabaseClient

export type LinkResult = { requestId: string } | { error: string }

export async function linkUserToInstitution(args: {
  svc: ServiceClient
  userId: string
  institutionId: string
  decidedBy: string
  autoApproved: boolean
  message?: string | null
  requestId?: string | null
}): Promise<LinkResult> {
  const { svc, userId, institutionId, decidedBy, autoApproved, message, requestId } = args

  const { data: workspace, error: wsErr } = await svc
    .from('workspaces')
    .select('id')
    .eq('institution_id', institutionId)
    .eq('type', 'institutional')
    .maybeSingle()

  if (wsErr || !workspace) {
    console.error('[INSTITUTION_LINK] Institutional workspace lookup failed:', wsErr)
    return { error: 'Institutional workspace not found' }
  }

  const { error: profileErr } = await svc
    .from('profiles')
    .update({ institution_id: institutionId })
    .eq('id', userId)

  if (profileErr) {
    console.error('[INSTITUTION_LINK] Profile update failed:', profileErr)
    return { error: profileErr.message }
  }

  const { error: memErr } = await svc
    .from('workspace_memberships')
    .upsert(
      {
        workspace_id: workspace.id,
        user_id: userId,
        role: 'researcher',
        status: 'active',
        invited_by: decidedBy,
      },
      { onConflict: 'workspace_id,user_id' },
    )

  if (memErr) {
    console.error('[INSTITUTION_LINK] Membership upsert failed:', memErr)
    return { error: memErr.message }
  }

  if (requestId) {
    const { error: updErr } = await svc
      .from('institution_link_requests')
      .update({
        status: 'approved',
        decided_by: decidedBy,
        decided_at: new Date().toISOString(),
        auto_approved: autoApproved,
      })
      .eq('id', requestId)
    if (updErr) {
      console.error('[INSTITUTION_LINK] Request update failed:', updErr)
      return { error: updErr.message }
    }
    return { requestId }
  }

  const { data: inserted, error: insErr } = await svc
    .from('institution_link_requests')
    .insert({
      user_id: userId,
      institution_id: institutionId,
      status: 'approved',
      message: message ?? null,
      auto_approved: autoApproved,
      decided_by: decidedBy,
      decided_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (insErr || !inserted) {
    console.error('[INSTITUTION_LINK] Request insert failed:', insErr)
    return { error: insErr?.message ?? 'Could not record link' }
  }

  return { requestId: inserted.id }
}
