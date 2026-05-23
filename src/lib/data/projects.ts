/*
 * PROJECTS DATA ACCESS
 *
 * Replaces direct supabase.from('projects') calls found in:
 *
 *   src/app/(dashboard)/projects/page.tsx
 *     - select * not deleted, order by updated_at desc, limit 200 (lines 244-249)
 *     - insert new project select().single() (lines 292-301)
 *     - update status (line 320)
 *
 *   src/app/(dashboard)/projects/[id]/activity/page.tsx
 *     - select * by id single() (line 19)
 *
 *   src/app/(dashboard)/projects/[id]/settings/page.tsx
 *     - select * by id single() (lines 53-57)
 *     - update share_token (line 79)
 *     - update share_token null (line 89)
 *     - update title, description, status, phase, start_date, end_date (lines 108-118)
 *
 *   src/app/(dashboard)/projects/[id]/team/page.tsx
 *     - select owner_id, title, owner:profiles by id single() (line 78)
 *
 *   src/app/(dashboard)/settings/page.tsx
 *     - select id, title, status, phase, updated_at by owner_id not deleted limit 5 (lines 113-119)
 *     - select id count exact head by owner_id (lines 125-128)
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Project, Profile } from '@/types/database'
import { DataResult, DataListResult, ok, okList, err, errList } from './types'

type ProjectInsert = {
  title: string
  description?: string | null
  owner_id: string
  workspace_id?: string | null
  project_type?: 'research' | 'thesis'
}

type ProjectUpdate = Partial<Pick<Project,
  'title' | 'description' | 'status' | 'phase' |
  'start_date' | 'end_date' | 'share_token'
>>

// ─── READS ────────────────────────────────────────────────────────────────────

// Replaces:
//   projects/page.tsx
//   supabase.from('projects').select('*').is('deleted_at', null)
//     .order('updated_at', { ascending: false }).limit(200)
export async function getAllProjects(
  supabase: SupabaseClient
): Promise<DataListResult<Project>> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(200)
  if (error) return errList(error.message)
  return okList((data ?? []) as Project[])
}

// Replaces:
//   activity/page.tsx, settings/page.tsx
//   supabase.from('projects').select('*').eq('id', projectId).single()
export async function getProject(
  supabase: SupabaseClient,
  id: string
): Promise<DataResult<Project>> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single()
  if (error) return err(error.message)
  return ok(data as Project)
}

// Replaces:
//   team/page.tsx — fetch project with owner profile
//   supabase.from('projects').select('owner_id, title, owner:profiles!owner_id(*)').eq('id', projectId).single()
export async function getProjectWithOwner(
  supabase: SupabaseClient,
  id: string
): Promise<DataResult<Pick<Project, 'owner_id' | 'title'> & { owner: Profile | null }>> {
  const { data, error } = await supabase
    .from('projects')
    .select('owner_id, title, owner:profiles!owner_id(*)')
    .eq('id', id)
    .single()
  if (error) return err(error.message)
  // Supabase returns owner as Profile object — cast safely
  return ok(data as unknown as Pick<Project, 'owner_id' | 'title'> & { owner: Profile | null })
}

// Replaces:
//   AnalysisHub.tsx — project metadata for context display
//   supabase.from('projects').select('title, description, methodology, research_objectives')
//     .eq('id', projectId).maybeSingle()
export async function getProjectMeta(
  supabase: SupabaseClient,
  id: string
): Promise<DataResult<Pick<Project, 'title' | 'description' | 'methodology' | 'research_objectives'> | null>> {
  const { data, error } = await supabase
    .from('projects')
    .select('title, description, methodology, research_objectives')
    .eq('id', id)
    .maybeSingle()
  if (error) return err(error.message)
  return ok(data as Pick<Project, 'title' | 'description' | 'methodology' | 'research_objectives'> | null)
}

// Replaces:
//   settings/page.tsx — recent projects for profile overview
//   supabase.from('projects').select('id, title, status, phase, updated_at')
//     .eq('owner_id', userId).is('deleted_at', null)
//     .order('updated_at', { ascending: false }).limit(5)
export async function getRecentProjectsByOwner(
  supabase: SupabaseClient,
  userId: string
): Promise<DataListResult<Pick<Project, 'id' | 'title' | 'status' | 'phase' | 'updated_at'>>> {
  const { data, error } = await supabase
    .from('projects')
    .select('id, title, status, phase, updated_at')
    .eq('owner_id', userId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(5)
  if (error) return errList(error.message)
  return okList((data ?? []) as Pick<Project, 'id' | 'title' | 'status' | 'phase' | 'updated_at'>[])
}

// Replaces:
//   settings/page.tsx — project count for profile stats
//   supabase.from('projects').select('id', { count: 'exact', head: true }).eq('owner_id', userId)
export async function countProjectsByOwner(
  supabase: SupabaseClient,
  userId: string
): Promise<DataResult<number>> {
  const { count, error } = await supabase
    .from('projects')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', userId)
  if (error) return err(error.message)
  return ok(count ?? 0)
}

// ─── WRITES ───────────────────────────────────────────────────────────────────

// Replaces:
//   projects/page.tsx
//   supabase.from('projects').insert({ title, description, owner_id, workspace_id }).select().single()
export async function createProject(
  supabase: SupabaseClient,
  input: ProjectInsert
): Promise<DataResult<Project>> {
  const { data, error } = await supabase
    .from('projects')
    .insert(input)
    .select()
    .single()
  if (error) return err(error.message)
  return ok(data as Project)
}

// Replaces:
//   projects/page.tsx — archive / restore
//   supabase.from('projects').update({ status }).eq('id', id)
export async function updateProjectStatus(
  supabase: SupabaseClient,
  id: string,
  status: Project['status']
): Promise<DataResult<null>> {
  const { error } = await supabase
    .from('projects')
    .update({ status })
    .eq('id', id)
  if (error) return err(error.message)
  return ok(null)
}

// Replaces:
//   settings/page.tsx — save project settings
//   supabase.from('projects').update({ title, description, status, phase, start_date, end_date }).eq('id', projectId)
export async function updateProject(
  supabase: SupabaseClient,
  id: string,
  updates: ProjectUpdate
): Promise<DataResult<null>> {
  const { error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', id)
  if (error) return err(error.message)
  return ok(null)
}

// Replaces:
//   settings/page.tsx — soft delete project
//   supabase.from('projects').update({ deleted_at: new Date().toISOString() }).eq('id', projectId)
export async function softDeleteProject(
  supabase: SupabaseClient,
  id: string
): Promise<DataResult<null>> {
  const { error } = await supabase
    .from('projects')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return err(error.message)
  return ok(null)
}

// Replaces:
//   settings/page.tsx — generate or revoke share link
//   supabase.from('projects').update({ share_token: token }).eq('id', projectId)
//   supabase.from('projects').update({ share_token: null }).eq('id', projectId)
export async function updateProjectShareToken(
  supabase: SupabaseClient,
  id: string,
  token: string | null
): Promise<DataResult<null>> {
  const { error } = await supabase
    .from('projects')
    .update({ share_token: token })
    .eq('id', id)
  if (error) return err(error.message)
  return ok(null)
}
