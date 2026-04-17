/*
 * ANALYSIS RUNS DATA ACCESS
 *
 * Replaces direct supabase.from('analysis_runs') calls found in:
 *
 *   src/components/analysis/AnalysisHub.tsx
 *     - select *, dataset:datasets(id,name) for project, not deleted, order by created_at desc limit 50 (line 347-350)
 *     - insert analysis run with select().single() (lines 484-495, 587-594)
 *     - update deleted_at (lines 367-368)
 *
 *   src/components/analysis/HubTableGeneratorModal.tsx
 *     - select * completed runs for project, not deleted, order by created_at desc (lines 435-440)
 *
 *   src/app/(dashboard)/projects/page.tsx
 *     - select project_id in(projectIds) for count (line 256)
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { AnalysisRun, AnalysisType, AnalysisStatus } from '@/types/database'
import { DataResult, DataListResult, ok, okList, err, errList } from './types'

type AnalysisRunInsert = {
  project_id: string
  dataset_id: string | null
  version_id: string | null
  analysis_type: AnalysisType
  title: string
  config: Record<string, unknown>
  results: Record<string, unknown>
  interpretation: string | null
  status: AnalysisStatus
  created_by: string
  user_reasoning?: string | null
}

// Replaces:
//   AnalysisHub.tsx — load all non-deleted runs for a project
//   supabase.from('analysis_runs').select('*, dataset:datasets(id, name)')
//     .eq('project_id', projectId).is('deleted_at', null)
//     .order('created_at', { ascending: false }).limit(50)
export async function getProjectAnalysisRuns(
  supabase: SupabaseClient,
  projectId: string
): Promise<DataListResult<AnalysisRun & { dataset: { id: string; name: string } | null }>> {
  const { data, error } = await supabase
    .from('analysis_runs')
    .select('*, dataset:datasets(id, name)')
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) return errList(error.message)
  return okList((data ?? []) as (AnalysisRun & { dataset: { id: string; name: string } | null })[])
}

// Replaces:
//   HubTableGeneratorModal.tsx — completed runs for table generator
//   supabase.from('analysis_runs').select('*')
//     .eq('project_id', projectId).eq('status', 'completed').is('deleted_at', null)
//     .order('created_at', { ascending: false })
export async function getCompletedProjectAnalysisRuns(
  supabase: SupabaseClient,
  projectId: string
): Promise<DataListResult<AnalysisRun>> {
  const { data, error } = await supabase
    .from('analysis_runs')
    .select('*')
    .eq('project_id', projectId)
    .eq('status', 'completed')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (error) return errList(error.message)
  return okList((data ?? []) as AnalysisRun[])
}

// Replaces:
//   projects/page.tsx — run counts for hero banner
//   supabase.from('analysis_runs').select('project_id').in('project_id', ids)
export async function getAnalysisRunProjectIds(
  supabase: SupabaseClient,
  projectIds: string[]
): Promise<DataListResult<{ project_id: string }>> {
  const { data, error } = await supabase
    .from('analysis_runs')
    .select('project_id')
    .in('project_id', projectIds)
  if (error) return errList(error.message)
  return okList((data ?? []) as { project_id: string }[])
}

// Replaces:
//   AnalysisHub.tsx — save analysis run (both intermediate and final)
//   supabase.from('analysis_runs').insert({ ... }).select().single()
export async function createAnalysisRun(
  supabase: SupabaseClient,
  input: AnalysisRunInsert
): Promise<DataResult<AnalysisRun>> {
  const { data, error } = await supabase
    .from('analysis_runs')
    .insert(input)
    .select()
    .single()
  if (error) return err(error.message)
  return ok(data as AnalysisRun)
}

// Replaces:
//   AnalysisHub.tsx — soft delete analysis run
//   supabase.from('analysis_runs').update({ deleted_at: ... }).eq('id', id)
export async function softDeleteAnalysisRun(
  supabase: SupabaseClient,
  id: string
): Promise<DataResult<null>> {
  const { error } = await supabase
    .from('analysis_runs')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return err(error.message)
  return ok(null)
}
