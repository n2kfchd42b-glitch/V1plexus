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
 */
export async function GET() {
  const supabase = await createClient()
  const ctx = await getInstitutionAdminContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const svc = createServiceClient()

  const { data: workspace } = await svc
    .from('workspaces')
    .select('id, name')
    .eq('institution_id', ctx.institutionId)
    .eq('type', 'institutional')
    .maybeSingle()

  if (!workspace) {
    return NextResponse.json({ workspace: null, members: [] })
  }

  const { data: memberships } = await svc
    .from('workspace_memberships')
    .select(`
      id, role, status, joined_at, department_id,
      user:profiles(id, full_name, email, avatar_url, title, role, last_seen_at, institution_id),
      department:departments(id, name)
    `)
    .eq('workspace_id', workspace.id)
    .order('joined_at', { ascending: false })

  return NextResponse.json({
    workspace,
    members: memberships ?? [],
  })
}
