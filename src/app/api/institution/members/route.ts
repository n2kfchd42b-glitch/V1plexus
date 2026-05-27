import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getInstitutionAdminContext } from '@/lib/admin/institutionAdmin'

/**
 * GET /api/institution/members
 * Roster for the caller's institution: every profile linked via institution_id,
 * joined to their role on the institutional workspace.
 *
 * Service client because RLS doesn't let admins read all peer profiles in one
 * query — we already authorised the caller via getInstitutionAdminContext.
 *
 * Pagination: caller can pass ?limit=N (default 500, max 1000) and ?offset=M.
 * The response always includes the exact `total` so the UI can render a
 * "Showing X of Y" hint when the roster is larger than the page.
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

  // workspace_memberships has 3 FKs to profiles (user_id, invited_by,
  // supervisor_id), so the embed alias MUST disambiguate via the FK name
  // — otherwise PostgREST returns PGRST201 and the page renders empty.
  const { data: memberships, count, error } = await svc
    .from('workspace_memberships')
    .select(`
      id, role, status, joined_at, department_id,
      user:profiles!workspace_memberships_user_id_fkey(id, full_name, email, avatar_url, title, role, last_seen_at, institution_id),
      department:departments(id, name)
    `, { count: 'exact' })
    .eq('workspace_id', workspace.id)
    .order('joined_at', { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1)

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
