import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getInstitutionAdminContext } from '@/lib/admin/institutionAdmin'
import { escapeLikePattern, postgrestQuote } from '@/lib/utils'

/**
 * GET /api/institution/members
 * Roster for the caller's institution: every profile linked via institution_id,
 * joined to their role on the institutional workspace.
 *
 * Service client because RLS doesn't let admins read all peer profiles in one
 * query — we already authorised the caller via getInstitutionAdminContext.
 *
 * Query params:
 *   limit  — page size (default 500, max 1000)
 *   offset — page offset
 *   search — name / email / title substring; runs server-side so large
 *            institutions don't see "no matches" for members outside the
 *            loaded page.
 */
const DEFAULT_LIMIT = 500
const MAX_LIMIT = 1000

export async function GET(request: Request) {
  const supabase = await createClient()
  const ctx = await getInstitutionAdminContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const url = new URL(request.url)
  const rawLimit = Number(url.searchParams.get('limit'))
  const rawOffset = Number(url.searchParams.get('offset'))
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, MAX_LIMIT) : DEFAULT_LIMIT
  const offset = Number.isFinite(rawOffset) && rawOffset > 0 ? rawOffset : 0
  const search = url.searchParams.get('search')?.trim() ?? ''

  const svc = createServiceClient()

  const { data: workspace } = await svc
    .from('workspaces')
    .select('id, name')
    .eq('institution_id', ctx.institutionId)
    .eq('type', 'institutional')
    .maybeSingle()

  if (!workspace) {
    return NextResponse.json({ workspace: null, members: [], total: 0, limit, offset })
  }

  // !inner on the embed makes the join required, so the search filter on the
  // embedded profile drops parent rows whose user doesn't match. Disambiguate
  // the FK explicitly (workspace_memberships has 3 FKs into profiles).
  let q = svc
    .from('workspace_memberships')
    .select(`
      id, role, status, joined_at, department_id,
      user:profiles!workspace_memberships_user_id_fkey!inner(id, full_name, email, avatar_url, title, role, last_seen_at, institution_id),
      department:departments(id, name)
    `, { count: 'exact' })
    .eq('workspace_id', workspace.id)
    .order('joined_at', { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1)

  if (search) {
    const pattern = postgrestQuote(`%${escapeLikePattern(search)}%`)
    q = q.or(
      `full_name.ilike.${pattern},` +
      `email.ilike.${pattern},` +
      `title.ilike.${pattern}`,
      { foreignTable: 'user' },
    )
  }

  const { data: memberships, count, error } = await q

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    workspace,
    members: memberships ?? [],
    total: count ?? 0,
    limit,
    offset,
  })
}
