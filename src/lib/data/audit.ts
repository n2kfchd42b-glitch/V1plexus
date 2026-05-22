import type { SupabaseClient } from '@supabase/supabase-js'
import type { AuditLog } from '@/types/database'
import { DataResult, ok, err } from './types'

// Read-only helper used by portfolio/certificates to check whether any audit
// chain entry exists for a dataset (used to set chain_verified on a certificate).
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
