import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * GET /api/institutions/[slug]
 *
 * Public, unauthenticated. Returns the data behind /institutions/<slug>:
 *   - branding (logo, colour, motto, public_bio, verification_tier)
 *   - member preview (researchers who opted in)
 *   - departments
 *   - certified outputs (verified thesis-bound packages whose institution
 *     branding snapshot matches this institution)
 *
 * Uses the service-role client and selects only public-safe fields, so
 * privacy on member rows is enforced here rather than via RLS. `active=false`
 * institutions return 404 — they should not appear in the public directory.
 */

const MEMBER_LIMIT = 60
const OUTPUTS_LIMIT = 12

interface MemberPreview {
  id: string
  full_name: string | null
  avatar_url: string | null
  title: string | null
  city: string | null
  country: string | null
  username: string | null
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug: rawSlug } = await params
  const slug = rawSlug.trim().toLowerCase()
  if (!slug) {
    return NextResponse.json({ error: 'Missing slug' }, { status: 400 })
  }

  const svc = createServiceClient()

  // 1. Institution record (gates everything else)
  const { data: institution, error: instErr } = await svc
    .from('institutions')
    .select(`
      id, name, short_name, slug, type, country, city, website, logo_url,
      brand_color, motto, public_bio, verification_tier, members_public_default,
      active, created_at
    `)
    .eq('slug', slug)
    .maybeSingle()

  if (instErr) {
    return NextResponse.json({ error: instErr.message }, { status: 500 })
  }
  if (!institution || institution.active === false) {
    return NextResponse.json({ error: 'Institution not found' }, { status: 404 })
  }

  // 2. Departments (no RLS gating needed; just list them)
  const { data: departments } = await svc
    .from('departments')
    .select('id, name, description')
    .eq('institution_id', institution.id)
    .order('name', { ascending: true })

  // 3. Members — only those who haven't opted out. Cap to keep page lean.
  const { data: rawMembers, count: memberTotal } = await svc
    .from('profiles')
    .select('id, full_name, avatar_url, title, city, country, role', { count: 'exact' })
    .eq('institution_id', institution.id)
    .eq('public_affiliation_visible', true)
    .not('full_name', 'is', null)
    .order('full_name', { ascending: true })
    .limit(MEMBER_LIMIT)

  const members: MemberPreview[] = (rawMembers ?? []).map((m) => ({
    id: m.id as string,
    full_name: m.full_name as string | null,
    avatar_url: m.avatar_url as string | null,
    title: m.title as string | null,
    city: m.city as string | null,
    country: m.country as string | null,
    username: null,
  }))

  // 4. Certified outputs — verified thesis packages stamped with this
  //    institution at submission time. We hop:
  //      verification_certificates → projects (owner_id, title)
  //      thesis_metadata.project_id matches and snapshot points here.
  const { data: theses } = await svc
    .from('thesis_metadata')
    .select('project_id, thesis_title, lifecycle_state, updated_at, institution_branding_snapshot')
    .eq('institution_id_at_submission', institution.id)
    .in('lifecycle_state', ['submitted', 'approved', 'archived'])
    .order('updated_at', { ascending: false })
    .limit(OUTPUTS_LIMIT)

  let outputs: Array<{
    project_id: string
    title: string | null
    lifecycle_state: string
    issued_at: string | null
    root_hash: string | null
  }> = []

  if (theses && theses.length > 0) {
    const projectIds = theses.map((t) => t.project_id as string)
    const { data: certRows } = await svc
      .from('verification_certificates')
      .select('project_id, root_hash, issued_at, trust_level')
      .in('project_id', projectIds)
      .order('issued_at', { ascending: false })

    // Index latest certificate per project
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

  return NextResponse.json({
    institution,
    departments: departments ?? [],
    members,
    member_total: memberTotal ?? members.length,
    outputs,
  })
}
