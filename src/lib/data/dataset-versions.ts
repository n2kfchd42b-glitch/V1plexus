/*
 * DATASET VERSIONS DATA ACCESS
 *
 * Replaces direct supabase.from('dataset_versions') calls found in:
 *
 *   src/app/(dashboard)/projects/[id]/data/page.tsx
 *     - select * in(datasetIds) order by version_number desc (line 64-66)
 *
 *   src/app/(dashboard)/projects/[id]/data/[datasetId]/clean/page.tsx
 *     - select * by dataset_id order by version_number desc (line 43)
 *
 *   src/app/(dashboard)/projects/[id]/data/[datasetId]/explore/page.tsx
 *     - select * by dataset_id order by version_number desc (lines 75-79)
 *
 *   src/app/(dashboard)/projects/[id]/data/[datasetId]/versions/page.tsx
 *     - select * by dataset_id order by version_number desc (lines 94-98)
 *
 *   src/components/data/DatasetDetailPanel.tsx
 *     - select * by dataset_id order by version_number desc (line 197)
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { DatasetVersion } from '@/types/database'
import { DataListResult, okList, errList } from './types'

// Replaces:
//   clean, explore, versions pages, DatasetDetailPanel
//   supabase.from('dataset_versions').select('*')
//     .eq('dataset_id', datasetId).order('version_number', { ascending: false })
export async function getDatasetVersions(
  supabase: SupabaseClient,
  datasetId: string
): Promise<DataListResult<DatasetVersion>> {
  const { data, error } = await supabase
    .from('dataset_versions')
    .select('*')
    .eq('dataset_id', datasetId)
    .order('version_number', { ascending: false })
  if (error) return errList(error.message)
  return okList((data ?? []) as DatasetVersion[])
}

// Replaces:
//   data/page.tsx — batch load versions for a list of datasets
//   supabase.from('dataset_versions').select('*')
//     .in('dataset_id', datasetIds).order('version_number', { ascending: false })
export async function getVersionsByDatasetIds(
  supabase: SupabaseClient,
  datasetIds: string[]
): Promise<DataListResult<DatasetVersion>> {
  const { data, error } = await supabase
    .from('dataset_versions')
    .select('*')
    .in('dataset_id', datasetIds)
    .order('version_number', { ascending: false })
  if (error) return errList(error.message)
  return okList((data ?? []) as DatasetVersion[])
}
