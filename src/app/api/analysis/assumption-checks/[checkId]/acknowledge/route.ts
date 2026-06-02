import { NextRequest, NextResponse } from 'next/server'
import { ANALYTICS_ENABLED } from '@/lib/flags'
import { getAnalyticsBaseUrl } from '@/lib/analyticsService'
import { createClient, getAccessTokenFromRequest } from '@/lib/supabase/server'
import { hasProjectAccess } from '@/lib/supabase/projectAccess'
import { writeAuditEntry } from '@/lib/audit/auditLogger'

/**
 * POST /api/analysis/assumption-checks/[checkId]/acknowledge
 * Researcher acknowledges assumption violations
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ checkId: string }> }
) {
  if (!ANALYTICS_ENABLED) {
    return Response.json({ unavailable: true, error: 'Advanced analytics service is not enabled.' }, { status: 503 })
  }
  try {
    const { checkId } = await params
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const acknowledgement_notes = body.acknowledgement_notes

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch check record to verify access
    const { data: checkRecord } = await supabase
      .from('analysis_assumption_checks')
      .select('*')
      .eq('id', checkId)
      .single()

    if (!checkRecord) {
      return NextResponse.json(
        { error: 'Check record not found' },
        { status: 404 }
      )
    }

    // Verify user can access this project
    if (!await hasProjectAccess(supabase, checkRecord.project_id, user.id) && checkRecord.requested_by !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Call FastAPI endpoint
    const analyticsUrl = getAnalyticsBaseUrl()
    const accessToken = getAccessTokenFromRequest(request)
    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const response = await fetch(
      `${analyticsUrl}/analytics/integrity/assumption-checks/${checkId}/acknowledge`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          acknowledged_by: user.id,
          acknowledgement_notes,
        }),
      }
    )

    if (!response.ok) {
      const error = await response.json()
      return NextResponse.json(error, { status: response.status })
    }

    const result = await response.json()

    // Write audit entry and store its ID back on the check record
    const auditResult = await writeAuditEntry(
      {
        actor_id: user.id,
        action: 'analysis.assumption.acknowledged',
        resource_type: 'analysis_run',
        resource_id: checkRecord.analysis_run_id ?? checkId,
        project_id: checkRecord.project_id,
        details: {
          summary: `Researcher acknowledged assumption violations for ${checkRecord.analysis_type} analysis`,
          operation: {
            check_id: checkId,
            analysis_type: checkRecord.analysis_type,
            all_passed: checkRecord.all_passed,
            acknowledgement_notes: acknowledgement_notes ?? null,
          },
        },
      },
      supabase,
    )

    if (auditResult.success && auditResult.entry_id) {
      await supabase
        .from('analysis_assumption_checks')
        .update({ acknowledgement_audit_id: auditResult.entry_id })
        .eq('id', checkId)
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('[POST /api/analysis/assumption-checks/[checkId]/acknowledge]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
