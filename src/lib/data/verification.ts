/*
 * VERIFICATION TOKENS DATA ACCESS
 *
 * Replaces direct supabase.from('verification_tokens') calls found in:
 *
 *   src/app/api/portfolio/certificates/route.ts
 *     - select id, token by dataset_id and version_id limit 1 single() (lines 93-99)
 *     - insert new token select id single() (lines 104-112)
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { DataResult, ok, err } from './types'

// verification_tokens row (not in database.ts, defined here from actual schema)
export type VerificationToken = {
  id: string
  token: string
  dataset_id: string
  version_id: string
  created_by: string | null
  created_at: string
}

// Replaces:
//   portfolio/certificates/route.ts — check for existing token
//   supabase.from('verification_tokens').select('id, token')
//     .eq('dataset_id', datasetId).eq('version_id', versionId).limit(1).single()
export async function getVerificationToken(
  supabase: SupabaseClient,
  datasetId: string,
  versionId: string
): Promise<DataResult<Pick<VerificationToken, 'id' | 'token'> | null>> {
  const { data, error } = await supabase
    .from('verification_tokens')
    .select('id, token')
    .eq('dataset_id', datasetId)
    .eq('version_id', versionId)
    .limit(1)
    .single()
  if (error && error.code !== 'PGRST116') return err(error.message)
  return ok(data as Pick<VerificationToken, 'id' | 'token'> | null)
}

// Replaces:
//   portfolio/certificates/route.ts — create new token
//   supabase.from('verification_tokens')
//     .insert({ dataset_id, version_id, created_by }).select('id').single()
export async function createVerificationToken(
  supabase: SupabaseClient,
  input: { dataset_id: string; version_id: string; created_by: string }
): Promise<DataResult<{ id: string }>> {
  const { data, error } = await supabase
    .from('verification_tokens')
    .insert(input)
    .select('id')
    .single()
  if (error) return err(error.message)
  return ok(data as { id: string })
}
