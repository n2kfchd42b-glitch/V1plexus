import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getInstitutionAdminContext } from '@/lib/admin/institutionAdmin'
import { escapeLikePattern } from '@/lib/utils'

/**
 * GET /api/institution/overview
 * Dashboard counters + recent activity for the caller's institution.
 * Restricted to institution admins. Uses the service client to count rows
 * (inquiries, audit, all profiles) that the caller's RLS would otherwise hide.
 */
export async function GET() {
  const supabase = await createClient()
  const ctx = await getInstitutionAdminContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const svc = createServiceClient()

  const { data: institution } = await svc
    .from('institutions')
    .select('id, name, short_name, type, country, email_domain, auto_link_domains, verification_tier, provisioned_at')
    .eq('id', ctx.institutionId)
    .maybeSingle()

  const inquiryName = institution?.name?.trim() ?? null

  const [
    workspaceRes,
    pendingLinkRes,
    memberCountRes,
    departmentCountRes,
    inquiryCountRes,
    recentAuditRes,
    programmeCountRes,
    rosterUnclaimedRes,
    rosterClaimedRes,
    enrollmentActiveRes,
  ] = await Promise.all([
    svc
      .from('workspaces')
      .select('id, name')
      .eq('institution_id', ctx.institutionId)
      .eq('type', 'institutional')
      .maybeSingle(),
    svc
      .from('institution_link_requests')
      .select('id', { count: 'exact', head: true })
      .eq('institution_id', ctx.institutionId)
      .eq('status', 'pending'),
    svc
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('institution_id', ctx.institutionId),
    svc
      .from('departments')
      .select('id', { count: 'exact', head: true })
      .eq('institution_id', ctx.institutionId),
    inquiryName
      ? svc
          .from('institution_inquiries')
          .select('id', { count: 'exact', head: true })
          .ilike('institution_name', escapeLikePattern(inquiryName))
      : Promise.resolve({ count: 0 }),
    svc
      .from('audit_logs')
      .select('id, action, resource_type, timestamp, actor:profiles(id, full_name, email, avatar_url)')
      .eq('institution_id', ctx.institutionId)
      .order('timestamp', { ascending: false })
      .limit(8),
    svc
      .from('institution_programmes')
      .select('id', { count: 'exact', head: true })
      .eq('institution_id', ctx.institutionId)
      .eq('active', true),
    svc
      .from('institution_roster_entries')
      .select('id', { count: 'exact', head: true })
      .eq('institution_id', ctx.institutionId)
      .eq('status', 'unclaimed'),
    svc
      .from('institution_roster_entries')
      .select('id', { count: 'exact', head: true })
      .eq('institution_id', ctx.institutionId)
      .eq('status', 'claimed'),
    svc
      .from('institution_enrollments')
      .select('id', { count: 'exact', head: true })
      .eq('institution_id', ctx.institutionId)
      .eq('status', 'active'),
  ])

  return NextResponse.json(
    {
      institution: institution ?? null,
      institutional_workspace: workspaceRes.data ?? null,
      counts: {
        members: memberCountRes.count ?? 0,
        departments: departmentCountRes.count ?? 0,
        pending_link_requests: pendingLinkRes.count ?? 0,
        inquiries: inquiryCountRes.count ?? 0,
        programmes: programmeCountRes.count ?? 0,
        roster_unclaimed: rosterUnclaimedRes.count ?? 0,
        roster_claimed: rosterClaimedRes.count ?? 0,
        enrollments_active: enrollmentActiveRes.count ?? 0,
      },
      recent_audit: recentAuditRes.data ?? [],
    },
    {
      // Private — this is per-admin data. Short max-age absorbs the
      // focus-refetch storm that the dashboard triggers when an admin
      // alt-tabs back into the tab; stale-while-revalidate keeps subsequent
      // loads instant while a background refresh runs.
      headers: {
        'Cache-Control': 'private, max-age=15, stale-while-revalidate=60',
      },
    },
  )
}
