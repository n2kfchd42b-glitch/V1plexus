import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { writeAuditEntry } from '@/lib/audit/auditLogger'

/**
 * POST /api/datasets/[id]/reentry/[sessionId]/validate
 * Finalize re-entry validation and create verified version
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  try {
    const { id: datasetId, sessionId } = await params

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch session
    const { data: session } = await supabase
      .from('reentry_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('dataset_id', datasetId)
      .single()

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Only initiator can finalize
    if (session.initiated_by !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check all discrepancies are resolved
    const { data: pending } = await supabase
      .from('reentry_discrepancies')
      .select('id', { count: 'exact' })
      .eq('session_id', sessionId)
      .eq('status', 'pending')

    if (pending && pending.length > 0) {
      return NextResponse.json(
        { error: 'Not all discrepancies are resolved' },
        { status: 422 }
      )
    }

    // Get the comparison result from session
    const comparison = session.comparison_result
    const overallAgreement = session.overall_agreement_pct

    // Call dataset version commit API to create final verified version
    const verifyUrl = `/api/datasets/${datasetId}/versions/commit`
    
    const verifyResponse = await fetch(new URL(verifyUrl, request.url).href, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: request.headers.get('cookie') || '',
      },
      body: JSON.stringify({
        commit_message: (
          `Re-entry validation complete — ${overallAgreement}% agreement. ` +
          `${comparison.total_discrepancies} discrepancies resolved.`
        ),
        source_version_id: session.reentry_version_id,
        operations: [
          {
            type: 'reentry_validation',
            session_id: sessionId,
            overall_agreement_pct: overallAgreement,
            total_discrepancies: comparison.total_discrepancies,
            matched_participants: comparison.matched_participants,
          },
        ],
      }),
    })

    if (!verifyResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to create verified version' },
        { status: verifyResponse.status }
      )
    }

    const verifiedVersion = await verifyResponse.json()

    // Update session
    await supabase
      .from('reentry_sessions')
      .update({
        status: 'validated',
        verified_version_id: verifiedVersion.id,
      })
      .eq('id', sessionId)

    // Write final audit entry with hash chain
    await writeAuditEntry(
      {
        actor_id: user.id,
        action: 'dataset.reentry.validated',
        resource_type: 'dataset',
        resource_id: datasetId,
        project_id: session.project_id ?? undefined,
        details: {
          summary:
            `Re-entry validation complete. ${overallAgreement}% agreement. ` +
            `Verified version created.`,
          operation: {
            session_id: sessionId,
            overall_agreement_pct: overallAgreement,
            verified_version_id: verifiedVersion.id,
            total_discrepancies: comparison.total_discrepancies,
            total_resolved: comparison.total_discrepancies,
          },
        },
      },
      supabase
    )

    return NextResponse.json({
      success: true,
      verified_version_id: verifiedVersion.id,
      overall_agreement_pct: overallAgreement,
    })
  } catch (error) {
    console.error(
      '[POST /api/datasets/[id]/reentry/[sessionId]/validate]',
      error
    )
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
