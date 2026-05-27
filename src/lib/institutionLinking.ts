/**
 * Institution linking helpers (PR B).
 *
 * Centralises the "approve a link request" transition so the user
 * auto-approval path and the admin manual approval path do the same thing.
 *
 * The 4-step transition (workspace lookup → profile update → membership
 * upsert → link-request row) runs inside the `link_user_to_institution`
 * Postgres function so it's atomic: either all four writes commit, or none
 * do. The function is SECURITY DEFINER and execute is restricted to
 * service_role — we still always call it with a service-role client.
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

  const { data, error } = await svc.rpc('link_user_to_institution', {
    p_user_id: userId,
    p_institution_id: institutionId,
    p_decided_by: decidedBy,
    p_auto_approved: autoApproved,
    p_message: message ?? null,
    p_request_id: requestId ?? null,
  })

  if (error) {
    console.error('[INSTITUTION_LINK] RPC link_user_to_institution failed:', error)
    return { error: error.message }
  }

  const resultId = typeof data === 'string' ? data : null
  if (!resultId) {
    return { error: 'Linking did not return a request id' }
  }

  return { requestId: resultId }
}
