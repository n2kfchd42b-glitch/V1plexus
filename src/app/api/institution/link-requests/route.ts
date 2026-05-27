import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * List link requests visible to the caller's institution.
 *
 * Returns all requests for the caller's institution_id, filtered by status
 * (default: pending). RLS already restricts visibility to admins/coordinators
 * of the target institution, so an unauthorised caller will simply see an
 * empty array.
 *
 * Query params:
 *   status — comma-separated subset of pending,approved,declined,cancelled
 */
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, institution_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.institution_id) {
    return NextResponse.json({ error: 'No institution' }, { status: 404 })
  }
  if (profile.role !== 'admin' && profile.role !== 'coordinator') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url = new URL(request.url)
  const statusParam = url.searchParams.get('status') ?? 'pending'
  const statuses = statusParam
    .split(',')
    .map((s) => s.trim())
    .filter((s) => ['pending', 'approved', 'declined', 'cancelled'].includes(s))

  const { data, error } = await supabase
    .from('institution_link_requests')
    .select('id, user_id, institution_id, status, message, auto_approved, decided_by, decided_at, decline_reason, created_at, user:profiles!institution_link_requests_user_id_fkey(id, full_name, email, avatar_url, title)')
    .eq('institution_id', profile.institution_id)
    .in('status', statuses.length > 0 ? statuses : ['pending'])
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ requests: data ?? [] })
}
