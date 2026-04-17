/*
 * DATASET QUALITY REPORTS DATA ACCESS
 *
 * Replaces direct supabase.from('dataset_quality_reports') calls found in:
 *
 *   src/app/api/portfolio/publications/route.ts
 *     - select overall_score by version_id order by created_at desc limit 1 single() (lines 109-115)
 *
 *   src/app/api/portfolio/certificates/route.ts
 *     - select overall_score by version_id order by created_at desc limit 1 single() (lines 48-54)
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { DataQualityScore } from '@/types/database'
import { DataResult, ok, err } from './types'

// Replaces:
//   portfolio/publications/route.ts, portfolio/certificates/route.ts
//   supabase.from('dataset_quality_reports').select('overall_score')
//     .eq('version_id', versionId).order('created_at', { ascending: false }).limit(1).single()
export async function getLatestQualityReport(
  supabase: SupabaseClient,
  versionId: string
): Promise<DataResult<Pick<DataQualityScore, 'overall_score'> | null>> {
  const { data, error } = await supabase
    .from('dataset_quality_reports')
    .select('overall_score')
    .eq('version_id', versionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  if (error && error.code !== 'PGRST116') return err(error.message)
  return ok(data as Pick<DataQualityScore, 'overall_score'> | null)
}
