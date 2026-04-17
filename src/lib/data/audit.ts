/*
 * AUDIT LOGS DATA ACCESS
 *
 * Replaces direct supabase.from('audit_logs') calls found in:
 *
 *   src/app/api/portfolio/publications/route.ts
 *     - insert audit log entry (lines 184-197)
 *
 *   src/app/api/portfolio/certificates/route.ts
 *     - select entry_hash by resource_id order by timestamp desc limit 1 single() (lines 81-87)
 *     - insert audit log entry (lines 146-159)
 *
 *   src/app/api/portfolio/profile/route.ts
 *     - insert audit log entry (lines 143-155)
 *
 * Note: Components that use logAudit() from @/lib/audit are NOT migrated here —
 * logAudit already abstracts over direct Supabase calls via writeAuditEntry.
 * Only the direct supabase.from('audit_logs') calls in API routes are migrated.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { AuditLog } from '@/types/database'
import { DataResult, ok, err } from './types'

export type AuditLogInsert = {
  actor_id: string
  action: string
  resource_type: string
  resource_id: string
  project_id?: string | null
  institution_id?: string | null
  details: Record<string, unknown>
  entry_hash?: string
}

// Replaces:
//   portfolio/certificates/route.ts — check audit chain
//   supabase.from('audit_logs').select('entry_hash')
//     .eq('resource_id', datasetId).order('timestamp', { ascending: false }).limit(1).single()
export async function getLatestAuditHash(
  supabase: SupabaseClient,
  resourceId: string
): Promise<DataResult<Pick<AuditLog, 'entry_hash'> | null>> {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('entry_hash')
    .eq('resource_id', resourceId)
    .order('timestamp', { ascending: false })
    .limit(1)
    .single()
  if (error && error.code !== 'PGRST116') return err(error.message)
  return ok(data as Pick<AuditLog, 'entry_hash'> | null)
}

// Replaces:
//   portfolio/publications/route.ts, portfolio/certificates/route.ts, portfolio/profile/route.ts
//   await supabase.from('audit_logs').insert({ actor_id, action, resource_type, resource_id, details, ... })
export async function insertAuditLog(
  supabase: SupabaseClient,
  input: AuditLogInsert
): Promise<DataResult<null>> {
  const { error } = await supabase
    .from('audit_logs')
    .insert(input)
  if (error) return err(error.message)
  return ok(null)
}
