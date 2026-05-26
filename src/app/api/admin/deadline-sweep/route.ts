import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { runDeadlineSweep } from '@/lib/thesis/deadlineSweep'

/**
 * POST /api/admin/deadline-sweep
 *
 * Manual sweep trigger for admins/coordinators. Useful for QA, dev, and
 * recovering from a missed cron run. Runs under service-role internally
 * (same as the cron route) so it can write reminders, but requires the
 * caller to be an admin or coordinator at the API boundary.
 */
export async function POST(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'admin' && profile?.role !== 'coordinator') {
    return NextResponse.json(
      { error: 'Only admins or coordinators can trigger the sweep' },
      { status: 403 },
    )
  }

  const service = createServiceClient()
  const startedAt = Date.now()
  const result = await runDeadlineSweep(service)
  const durationMs = Date.now() - startedAt

  return NextResponse.json({
    ...result,
    duration_ms: durationMs,
    triggered_by: user.id,
  })
}
