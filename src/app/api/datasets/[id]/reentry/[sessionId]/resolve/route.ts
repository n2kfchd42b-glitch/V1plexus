import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { insertAuditLog } from '@/lib/data'

/**
 * POST /api/datasets/[id]/reentry/[sessionId]/resolve
 * Bulk resolve discrepancies
 * Body: { resolutions: [{ discrepancy_id, status, resolved_value, resolution_note }] }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  try {
    const { id: datasetId, sessionId } = await params
    const body = await request.json()
    const { resolutions } = body

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch session and verify access
    const { data: session } = await supabase
      .from('reentry_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('dataset_id', datasetId)
      .single()

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Only initiator and assigned can resolve
    if (session.initiated_by !== user.id && session.reentry_assigned_to !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Update each discrepancy
    const updates = resolutions.map((res: any) => ({
      id: res.discrepancy_id,
      status: res.status,
      resolved_value: res.resolved_value,
      resolution_note: res.resolution_note || null,
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
    }))

    for (const update of updates) {
      await supabase
        .from('reentry_discrepancies')
        .update({
          status: update.status,
          resolved_value: update.resolved_value,
          resolution_note: update.resolution_note,
          resolved_by: update.resolved_by,
          resolved_at: update.resolved_at,
        })
        .eq('id', update.id)
    }

    // Write audit entry
    await insertAuditLog(supabase, {
      actor_id: user.id,
      action: 'dataset.reentry.discrepancy.resolved',
      resource_type: 'dataset',
      resource_id: sessionId,
      project_id: session.project_id,
      details: {
        summary: `${resolutions.length} discrepancies resolved`,
        operation: {
          session_id: sessionId,
          resolutions_count: resolutions.length,
          by_type: {
            original: resolutions.filter(
              (r: any) => r.status === 'resolved_original'
            ).length,
            reentry: resolutions.filter(
              (r: any) => r.status === 'resolved_reentry'
            ).length,
            manual: resolutions.filter(
              (r: any) => r.status === 'resolved_manual'
            ).length,
          },
        },
      },
    })

    // Check if all discrepancies are now resolved
    const { data: pending } = await supabase
      .from('reentry_discrepancies')
      .select('id', { count: 'exact' })
      .eq('session_id', sessionId)
      .eq('status', 'pending')

    if (pending && pending.length === 0) {
      // Update session status to 'resolved'
      await supabase
        .from('reentry_sessions')
        .update({ status: 'resolved' })
        .eq('id', sessionId)
    }

    return NextResponse.json({
      success: true,
      resolutions_saved: resolutions.length,
    })
  } catch (error) {
    console.error('[POST /api/datasets/[id]/reentry/[sessionId]/resolve]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
