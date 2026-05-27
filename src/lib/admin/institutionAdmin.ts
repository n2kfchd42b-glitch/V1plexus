/**
 * Institution admin gate.
 *
 * A user is an "institution admin" when their profile has role='admin' and a
 * non-null institution_id. This is the gate used by the dedicated /institution
 * section (overview, members, policy, link requests, audit, inquiries).
 *
 * Coordinators have access to a subset of institutional surfaces through
 * route-level checks (e.g. link-requests RLS), but they are not shown the
 * Institution sidebar group — keep the surface narrowly targeted at the
 * person actually running the institution.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface InstitutionAdminContext {
  userId: string
  institutionId: string
}

export async function getInstitutionAdminContext(
  supabase: SupabaseClient,
): Promise<InstitutionAdminContext | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, institution_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || profile.role !== 'admin' || !profile.institution_id) return null

  return { userId: user.id, institutionId: profile.institution_id as string }
}
