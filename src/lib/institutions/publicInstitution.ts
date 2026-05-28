/**
 * Public institution page data loader.
 *
 * Shared by:
 *   - GET /api/institutions/[slug]          (external clients)
 *   - /institutions/[slug]   server page    (server component, directly)
 *
 * The server page used to fetch its own API via headers()+fetch, which is a
 * server→server hop through the public network on every render. Loading
 * directly avoids that hop and keeps the data shape identical between the
 * two call sites.
 *
 * Returns `null` when the institution is missing, inactive, or never
 * provisioned — those are all 404 from the public's perspective.
 */

import { createServiceClient } from '@/lib/supabase/service'

const MEMBER_LIMIT = 60
const OUTPUTS_LIMIT = 12

export interface PublicInstitution {
  id: string
  name: string
  short_name: string | null
  slug: string
  type: string | null
  country: string | null
  city: string | null
  website: string | null
  logo_url: string | null
  brand_color: string | null
  motto: string | null
  public_bio: string | null
  verification_tier: 'SELF_ATTESTED' | 'DOMAIN_VERIFIED' | 'OFFICIALLY_REGISTERED' | null
  active: boolean | null
  created_at: string
}

export interface PublicMember {
  id: string
  full_name: string | null
  avatar_url: string | null
  title: string | null
  city: string | null
  country: string | null
}

export interface PublicOutput {
  project_id: string
  title: string | null
  lifecycle_state: string
  issued_at: string | null
  root_hash: string | null
}

export interface PublicInstitutionPayload {
  institution: PublicInstitution
  departments: Array<{ id: string; name: string; description: string | null }>
  members: PublicMember[]
  member_total: number
  outputs: PublicOutput[]
}

export async function loadPublicInstitution(rawSlug: string): Promise<PublicInstitutionPayload | null> {
  const slug = rawSlug.trim().toLowerCase()
  if (!slug) return null

  const svc = createServiceClient()

  const { data: institution } = await svc
    .from('institutions')
    .select(`
      id, name, short_name, slug, type, country, city, website, logo_url,
      brand_color, motto, public_bio, verification_tier,
      active, provisioned_at, created_at
    `)
    .eq('slug', slug)
    .maybeSingle()

  if (!institution || institution.active === false || !institution.provisioned_at) {
    return null
  }

  const [{ data: departments }, membersRes, { data: theses }] = await Promise.all([
    svc
      .from('departments')
      .select('id, name, description')
      .eq('institution_id', institution.id)
      .order('name', { ascending: true }),
    svc
      .from('profiles')
      .select('id, full_name, avatar_url, title, city, country, role', { count: 'exact' })
      .eq('institution_id', institution.id)
      .eq('public_affiliation_visible', true)
      .not('full_name', 'is', null)
      .order('full_name', { ascending: true })
      .limit(MEMBER_LIMIT),
    svc
      .from('thesis_metadata')
      .select('project_id, thesis_title, lifecycle_state, updated_at')
      .eq('institution_id_at_submission', institution.id)
      .in('lifecycle_state', ['submitted', 'approved', 'archived'])
      .order('updated_at', { ascending: false })
      .limit(OUTPUTS_LIMIT),
  ])

  const members: PublicMember[] = (membersRes.data ?? []).map((m) => ({
    id: m.id as string,
    full_name: m.full_name as string | null,
    avatar_url: m.avatar_url as string | null,
    title: m.title as string | null,
    city: m.city as string | null,
    country: m.country as string | null,
  }))

  let outputs: PublicOutput[] = []
  if (theses && theses.length > 0) {
    const projectIds = theses.map((t) => t.project_id as string)
    const { data: certRows } = await svc
      .from('verification_certificates')
      .select('project_id, root_hash, issued_at')
      .in('project_id', projectIds)
      .order('issued_at', { ascending: false })

    const latestCert = new Map<string, { root_hash: string; issued_at: string }>()
    for (const row of certRows ?? []) {
      const pid = row.project_id as string
      if (!latestCert.has(pid)) {
        latestCert.set(pid, {
          root_hash: row.root_hash as string,
          issued_at: row.issued_at as string,
        })
      }
    }

    outputs = theses.map((t) => {
      const cert = latestCert.get(t.project_id as string)
      return {
        project_id: t.project_id as string,
        title: (t.thesis_title as string | null) ?? null,
        lifecycle_state: t.lifecycle_state as string,
        issued_at: cert?.issued_at ?? null,
        root_hash: cert?.root_hash ?? null,
      }
    })
  }

  // Strip provisioned_at from the institution payload — it's used as a 404
  // gate above but not exposed to the public renderer.
  const { provisioned_at: _provAt, ...publicInstitution } = institution
  void _provAt

  return {
    institution: publicInstitution as PublicInstitution,
    departments: departments ?? [],
    members,
    member_total: membersRes.count ?? members.length,
    outputs,
  }
}
