import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { runDeadlineSweep } from '@/lib/thesis/deadlineSweep'

/**
 * GET /api/cron/deadline-sweep
 *
 * Daily entry point hit by Vercel cron. Authenticated by shared secret
 * passed in the Authorization header — Vercel cron sets this automatically
 * from CRON_SECRET when configured.
 *
 * Runs under service-role since it needs to read every open deadline
 * across all institutions and write reminders/audit entries. There is no
 * user identity for this work.
 */

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }

  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const startedAt = Date.now()
  const result = await runDeadlineSweep(supabase)
  const durationMs = Date.now() - startedAt

  return NextResponse.json({
    ...result,
    duration_ms: durationMs,
  })
}
