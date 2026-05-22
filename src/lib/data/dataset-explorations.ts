/*
 * DATASET EXPLORATIONS DATA ACCESS
 *
 * Replaces direct supabase.from('dataset_explorations') calls found in:
 *
 *   src/components/data/DatasetDetailPanel.tsx
 *     - select * by dataset_id order by created_at desc (line 199)
 *     - delete by id (line 242)
 *
 *   src/app/(dashboard)/projects/[id]/data/[datasetId]/explore/page.tsx
 *     - insert exploration (lines 176-183)
 *
 *   src/components/analysis/ChartEditor.tsx
 *     - insert exploration (lines 177-185)
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { DatasetExploration, ChartType, ChartConfig } from '@/types/database'
import { DataResult, DataListResult, ok, okList, err, errList } from './types'

type ExplorationInsert = {
  dataset_id: string
  version_id: string | null
  title: string
  chart_type: ChartType
  config: Record<string, unknown>
  thumbnail_path?: string | null
  created_by: string | null
}

// Replaces:
//   DatasetDetailPanel.tsx
//   supabase.from('dataset_explorations').select('*')
//     .eq('dataset_id', datasetId).order('created_at', { ascending: false })
export async function getDatasetExplorations(
  supabase: SupabaseClient,
  datasetId: string
): Promise<DataListResult<DatasetExploration>> {
  const { data, error } = await supabase
    .from('dataset_explorations')
    .select('*')
    .eq('dataset_id', datasetId)
    .order('created_at', { ascending: false })
  if (error) return errList(error.message)
  return okList((data ?? []) as DatasetExploration[])
}

// Replaces:
//   explore/page.tsx
//   supabase.from('dataset_explorations').insert({ dataset_id, version_id, title, chart_type, config, created_by })
//
//   ChartEditor.tsx
//   supabase.from('dataset_explorations').insert({ dataset_id, version_id, title, chart_type, config, thumbnail_path, created_by })
export async function createDatasetExploration(
  supabase: SupabaseClient,
  input: ExplorationInsert
): Promise<DataResult<DatasetExploration>> {
  const { data, error } = await supabase
    .from('dataset_explorations')
    .insert(input)
    .select()
    .single()
  if (error) return err(error.message)
  return ok(data as DatasetExploration)
}

// Replaces:
//   DatasetDetailPanel.tsx
//   supabase.from('dataset_explorations').delete().eq('id', id)
export async function deleteDatasetExploration(
  supabase: SupabaseClient,
  id: string
): Promise<DataResult<null>> {
  const { error } = await supabase
    .from('dataset_explorations')
    .delete()
    .eq('id', id)
  if (error) return err(error.message)
  return ok(null)
}
