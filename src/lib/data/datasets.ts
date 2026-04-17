/*
 * DATASETS DATA ACCESS
 *
 * Replaces direct supabase.from('datasets') calls found in:
 *
 *   src/app/(dashboard)/projects/[id]/data/page.tsx
 *     - select * active datasets for project (lines 51-52)
 *     - select * archived datasets for project (lines 51-52)
 *     - select id count archived (line 56)
 *     - update deleted_at (line 97)
 *     - update archived_at (line 117)
 *
 *   src/app/(dashboard)/projects/page.tsx
 *     - select project_id in(projectIds) for count (line 255)
 *
 *   src/app/(dashboard)/projects/[id]/data/[datasetId]/clean/page.tsx
 *     - select * by id single() (line 42)
 *
 *   src/app/(dashboard)/projects/[id]/data/[datasetId]/explore/page.tsx
 *     - select * by id single() (line 74)
 *
 *   src/app/(dashboard)/projects/[id]/data/[datasetId]/versions/page.tsx
 *     - select * by id single() (line 93)
 *
 *   src/components/data/DatasetDetailPanel.tsx
 *     - select * by id single() (line 196)
 *
 *   src/app/api/portfolio/publications/route.ts
 *     - select id by id+uploaded_by single() (line 94-99)
 *
 *   src/app/api/portfolio/certificates/route.ts
 *     - select id, name by id+uploaded_by single() (line 33-38)
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Dataset } from '@/types/database'
import { DataResult, DataListResult, ok, okList, err, errList } from './types'

// ─── READS ────────────────────────────────────────────────────────────────────

// Replaces:
//   DatasetDetailPanel.tsx, clean/page.tsx, explore/page.tsx, versions/page.tsx
//   supabase.from('datasets').select('*').eq('id', datasetId).single()
export async function getDataset(
  supabase: SupabaseClient,
  id: string
): Promise<DataResult<Dataset>> {
  const { data, error } = await supabase
    .from('datasets')
    .select('*')
    .eq('id', id)
    .single()
  if (error) return err(error.message)
  return ok(data as Dataset)
}

// Replaces:
//   data/page.tsx — active datasets branch
//   supabase.from('datasets').select('*').eq('project_id', projectId)
//     .is('deleted_at', null).is('archived_at', null).order('updated_at', { ascending: false })
export async function getActiveProjectDatasets(
  supabase: SupabaseClient,
  projectId: string
): Promise<DataListResult<Dataset>> {
  const { data, error } = await supabase
    .from('datasets')
    .select('*')
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .is('archived_at', null)
    .order('updated_at', { ascending: false })
  if (error) return errList(error.message)
  return okList((data ?? []) as Dataset[])
}

// Replaces:
//   data/page.tsx — archived datasets branch
//   supabase.from('datasets').select('*').eq('project_id', projectId)
//     .is('deleted_at', null).not('archived_at', 'is', null).order('updated_at', { ascending: false })
export async function getArchivedProjectDatasets(
  supabase: SupabaseClient,
  projectId: string
): Promise<DataListResult<Dataset>> {
  const { data, error } = await supabase
    .from('datasets')
    .select('*')
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .not('archived_at', 'is', null)
    .order('updated_at', { ascending: false })
  if (error) return errList(error.message)
  return okList((data ?? []) as Dataset[])
}

// Replaces:
//   data/page.tsx — archived count
//   supabase.from('datasets').select('id', { count: 'exact', head: true })
//     .eq('project_id', projectId).is('deleted_at', null).not('archived_at', 'is', null)
export async function countArchivedProjectDatasets(
  supabase: SupabaseClient,
  projectId: string
): Promise<DataResult<number>> {
  const { count, error } = await supabase
    .from('datasets')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .not('archived_at', 'is', null)
  if (error) return err(error.message)
  return ok(count ?? 0)
}

// Replaces:
//   projects/page.tsx — dataset counts for hero banner
//   supabase.from('datasets').select('project_id').in('project_id', ids)
export async function getDatasetProjectIds(
  supabase: SupabaseClient,
  projectIds: string[]
): Promise<DataListResult<{ project_id: string }>> {
  const { data, error } = await supabase
    .from('datasets')
    .select('project_id')
    .in('project_id', projectIds)
  if (error) return errList(error.message)
  return okList((data ?? []) as { project_id: string }[])
}

// Replaces:
//   portfolio/publications/route.ts — verify ownership
//   supabase.from('datasets').select('id').eq('id', id).eq('uploaded_by', userId).single()
export async function verifyDatasetAccess(
  supabase: SupabaseClient,
  id: string,
  userId: string
): Promise<DataResult<{ id: string }>> {
  const { data, error } = await supabase
    .from('datasets')
    .select('id')
    .eq('id', id)
    .eq('uploaded_by', userId)
    .single()
  if (error) return err(error.message)
  return ok(data as { id: string })
}

// Replaces:
//   portfolio/certificates/route.ts — verify ownership with name
//   supabase.from('datasets').select('id, name').eq('id', id).eq('uploaded_by', userId).single()
export async function verifyDatasetAccessWithName(
  supabase: SupabaseClient,
  id: string,
  userId: string
): Promise<DataResult<{ id: string; name: string }>> {
  const { data, error } = await supabase
    .from('datasets')
    .select('id, name')
    .eq('id', id)
    .eq('uploaded_by', userId)
    .single()
  if (error) return err(error.message)
  return ok(data as { id: string; name: string })
}

// ─── WRITES ───────────────────────────────────────────────────────────────────

// Replaces:
//   data/page.tsx — soft delete
//   supabase.from('datasets').update({ deleted_at: new Date().toISOString() }).eq('id', id)
export async function softDeleteDataset(
  supabase: SupabaseClient,
  id: string
): Promise<DataResult<null>> {
  const { error } = await supabase
    .from('datasets')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return err(error.message)
  return ok(null)
}

// Replaces:
//   data/page.tsx — archive / unarchive
//   supabase.from('datasets').update({ archived_at: archive ? new Date().toISOString() : null }).eq('id', id)
export async function setDatasetArchived(
  supabase: SupabaseClient,
  id: string,
  archive: boolean
): Promise<DataResult<null>> {
  const { error } = await supabase
    .from('datasets')
    .update({ archived_at: archive ? new Date().toISOString() : null })
    .eq('id', id)
  if (error) return err(error.message)
  return ok(null)
}
