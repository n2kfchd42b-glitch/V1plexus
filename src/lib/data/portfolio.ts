/*
 * PORTFOLIO DATA ACCESS (publications + certificates)
 *
 * Replaces direct supabase.from('portfolio_publications') calls found in:
 *
 *   src/app/api/portfolio/publications/route.ts
 *     - insert publication select * single() (lines 161-173)
 *     - select * by profile_id order by year desc (lines 221-225)
 *
 * Replaces direct supabase.from('portfolio_certificates') calls found in:
 *
 *   src/app/api/portfolio/certificates/route.ts
 *     - insert certificate select * single() (lines 118-135)
 *     - select *, datasets(name, source) by profile_id order by created_at desc (lines 183-192)
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { DataResult, DataListResult, ok, okList, err, errList } from './types'

// ─── Types ────────────────────────────────────────────────────────────────────

// portfolio_publications row (not in database.ts, defined here from actual schema)
export type PortfolioPublication = {
  id: string
  profile_id: string
  title: string
  journal: string | null
  year: number | null
  doi: string | null
  authors: string[]
  abstract: string | null
  study_type: string | null
  study_population: string | null
  sample_size: number | null
  reporting_guideline: string | null
  is_public: boolean
  dataset_id: string | null
  version_id: string | null
  dqi_score: number | null
  supervisor_approved: boolean
  assumption_checks_conducted: boolean
  reentry_conducted: boolean
  created_at: string
  updated_at: string
}

type PublicationInsert = Omit<PortfolioPublication, 'id' | 'created_at' | 'updated_at'>

// portfolio_certificates row (not in database.ts, defined here from actual schema)
export type PortfolioCertificate = {
  id: string
  profile_id: string
  dataset_id: string
  version_id: string
  verification_token_id: string | null
  display_title: string | null
  context_note: string | null
  dqi_score_snapshot: number | null
  supervisor_approved: boolean
  assumption_checks_conducted: boolean
  reentry_conducted: boolean
  chain_verified: boolean
  is_public: boolean
  created_at: string
}

type CertificateInsert = Omit<PortfolioCertificate, 'id' | 'created_at'>

// ─── Publications ─────────────────────────────────────────────────────────────

// Replaces:
//   portfolio/publications/route.ts POST
//   supabase.from('portfolio_publications').insert({ ... }).select('*').single()
export async function createPublication(
  supabase: SupabaseClient,
  input: PublicationInsert
): Promise<DataResult<PortfolioPublication>> {
  const { data, error } = await supabase
    .from('portfolio_publications')
    .insert(input)
    .select('*')
    .single()
  if (error) return err(error.message)
  return ok(data as PortfolioPublication)
}

// Replaces:
//   portfolio/publications/route.ts GET
//   supabase.from('portfolio_publications').select('*').eq('profile_id', userId).order('year', { ascending: false })
export async function getUserPublications(
  supabase: SupabaseClient,
  userId: string
): Promise<DataListResult<PortfolioPublication>> {
  const { data, error } = await supabase
    .from('portfolio_publications')
    .select('*')
    .eq('profile_id', userId)
    .order('year', { ascending: false })
  if (error) return errList(error.message)
  return okList((data ?? []) as PortfolioPublication[])
}

// ─── Certificates ─────────────────────────────────────────────────────────────

// Replaces:
//   portfolio/certificates/route.ts POST
//   supabase.from('portfolio_certificates').insert({ ... }).select('*').single()
export async function createCertificate(
  supabase: SupabaseClient,
  input: CertificateInsert
): Promise<DataResult<PortfolioCertificate>> {
  const { data, error } = await supabase
    .from('portfolio_certificates')
    .insert(input)
    .select('*')
    .single()
  if (error) return err(error.message)
  return ok(data as PortfolioCertificate)
}

// Replaces:
//   portfolio/certificates/route.ts GET
//   supabase.from('portfolio_certificates')
//     .select('*, datasets(name, source)').eq('profile_id', userId).order('created_at', { ascending: false })
export async function getUserCertificates(
  supabase: SupabaseClient,
  userId: string
): Promise<DataListResult<PortfolioCertificate & { datasets: { name: string; source: string } | null }>> {
  const { data, error } = await supabase
    .from('portfolio_certificates')
    .select('*, datasets(name, source)')
    .eq('profile_id', userId)
    .order('created_at', { ascending: false })
  if (error) return errList(error.message)
  return okList((data ?? []) as (PortfolioCertificate & { datasets: { name: string; source: string } | null })[])
}
