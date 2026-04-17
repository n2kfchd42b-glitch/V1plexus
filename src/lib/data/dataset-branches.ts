/*
 * DATASET BRANCHES DATA ACCESS
 *
 * Replaces direct supabase.from('dataset_branches') calls found in:
 *
 *   src/app/(dashboard)/projects/[id]/data/[datasetId]/clean/page.tsx
 *     - select * by dataset_id no ordering (line 44)
 *
 *   src/app/(dashboard)/projects/[id]/data/[datasetId]/explore/page.tsx
 *     - select * by dataset_id order by is_default desc (lines 80-84)
 *
 *   src/app/(dashboard)/projects/[id]/data/[datasetId]/versions/page.tsx
 *     - select * by dataset_id order by is_default desc (lines 99-103)
 *
 *   src/components/data/DatasetDetailPanel.tsx
 *     - select * by dataset_id order by is_default desc (line 198)
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { DatasetBranch } from '@/types/database'
import { DataListResult, okList, errList } from './types'

// Replaces:
//   clean/page.tsx
//   supabase.from('dataset_branches').select('*').eq('dataset_id', datasetId)
export async function getDatasetBranches(
  supabase: SupabaseClient,
  datasetId: string
): Promise<DataListResult<DatasetBranch>> {
  const { data, error } = await supabase
    .from('dataset_branches')
    .select('*')
    .eq('dataset_id', datasetId)
  if (error) return errList(error.message)
  return okList((data ?? []) as DatasetBranch[])
}

// Replaces:
//   explore/page.tsx, versions/page.tsx, DatasetDetailPanel.tsx
//   supabase.from('dataset_branches').select('*')
//     .eq('dataset_id', datasetId).order('is_default', { ascending: false })
export async function getDatasetBranchesOrdered(
  supabase: SupabaseClient,
  datasetId: string
): Promise<DataListResult<DatasetBranch>> {
  const { data, error } = await supabase
    .from('dataset_branches')
    .select('*')
    .eq('dataset_id', datasetId)
    .order('is_default', { ascending: false })
  if (error) return errList(error.message)
  return okList((data ?? []) as DatasetBranch[])
}
