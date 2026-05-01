/*
 * PROFILES DATA ACCESS
 *
 * Replaces direct supabase.from('profiles') calls found in:
 *
 *   src/app/(dashboard)/settings/page.tsx
 *     - select *, institution:institutions, department:departments by id maybeSingle() (lines 108-112)
 *     - update avatar_url (line 160)
 *     - update full_name, title, bio, orcid_id, phone, website (lines 172-179)
 *
 *   src/app/(dashboard)/projects/[id]/team/page.tsx
 *     - select * or(full_name, email) neq id limit 8 (lines 95-99)
 *
 *   src/app/api/portfolio/profile/route.ts
 *     - select id ilike username neq id single() (lines 37-42)
 *     - update many portfolio fields, select * single() (lines 126-131)
 *
 *   src/components/auth/InstitutionCreateForm.tsx
 *     - select full_name by id maybeSingle() (line 60)
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Profile } from '@/types/database'
import { DataResult, DataListResult, ok, okList, err } from './types'

// ─── READS ────────────────────────────────────────────────────────────────────

// Replaces:
//   settings/page.tsx
//   supabase.from('profiles')
//     .select('*, institution:institutions(id,name,country), department:departments!department_id(id,name)')
//     .eq('id', userId).maybeSingle()
export async function getProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<DataResult<Profile | null>> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*, institution:institutions(id,name,country), department:departments!department_id(id,name)')
    .eq('id', userId)
    .maybeSingle()
  if (!error) return ok(data as Profile | null)

  // Join may fail if FK relationships aren't exposed via RLS — fall back to plain select
  const fallback = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
  if (fallback.error) return err(fallback.error.message)
  return ok(fallback.data as Profile | null)
}

// Replaces:
//   InstitutionCreateForm.tsx
//   supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle()
export async function getProfileName(
  supabase: SupabaseClient,
  userId: string
): Promise<DataResult<{ full_name: string | null } | null>> {
  const { data, error } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', userId)
    .maybeSingle()
  if (error) return err(error.message)
  return ok(data as { full_name: string | null } | null)
}

// Replaces:
//   portfolio/profile/route.ts — check username uniqueness
//   supabase.from('profiles').select('id').ilike('username', username).neq('id', userId).single()
export async function checkUsernameAvailability(
  supabase: SupabaseClient,
  username: string,
  currentUserId: string
): Promise<DataResult<{ id: string } | null>> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .ilike('username', username)
    .neq('id', currentUserId)
    .single()
  // PGRST116 = row not found = username is available
  if (error && error.code !== 'PGRST116') return err(error.message)
  return ok(data as { id: string } | null)
}

// Replaces:
//   team/page.tsx — profile search
//   supabase.from('profiles').select('*').or(query).neq('id', excludeId).limit(8)
export async function searchProfiles(
  supabase: SupabaseClient,
  query: string,
  excludeId: string
): Promise<DataListResult<Profile>> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .or(query)
    .neq('id', excludeId)
    .limit(8)
  if (error) return { data: [], error: error.message, status: 'error' }
  return okList((data ?? []) as Profile[])
}

// ─── WRITES ───────────────────────────────────────────────────────────────────

// Replaces:
//   portfolio/profile/route.ts — update portfolio profile
//   supabase.from('profiles').update(updateData).eq('id', userId).select('*').single()
//
//   settings/page.tsx — update profile fields
//   supabase.from('profiles').update({ full_name, title, bio, orcid_id, phone, website }).eq('id', authUser.id)
export async function updateProfile(
  supabase: SupabaseClient,
  id: string,
  updates: Record<string, unknown>
): Promise<DataResult<Profile>> {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', id)
    .select('*, institution:institutions(id,name,country), department:departments!department_id(id,name)')
    .single()
  if (error) return err(error.message)
  return ok(data as Profile)
}

// Replaces:
//   settings/page.tsx — update avatar after upload
//   supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', authUser.id)
export async function updateProfileAvatar(
  supabase: SupabaseClient,
  id: string,
  avatarUrl: string
): Promise<DataResult<null>> {
  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: avatarUrl })
    .eq('id', id)
  if (error) return err(error.message)
  return ok(null)
}
