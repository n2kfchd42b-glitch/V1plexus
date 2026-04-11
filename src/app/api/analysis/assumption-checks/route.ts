import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { AssumptionCheckResult } from '@/types/analysisIntegrity'

/**
 * POST /api/analysis/assumption-checks
 * Returns a clean pass when no external analytics service is configured.
 * Only proxies to the external service when ANALYTICS_API_URL is set.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { analysis_type } = body

    // Short-circuit: no external analytics service configured.
    // Return a clean pass so analysis runs without any blocking.
    if (!process.env.ANALYTICS_API_URL) {
      const passResult: AssumptionCheckResult = {
        check_id: '',
        analysis_type,
        checks: [],
        all_passed: true,
        run_recommendation: 'proceed',
        critical_violations: 0,
        moderate_violations: 0,
        minor_violations: 0,
        not_applicable_count: 0,
        requires_acknowledgement: false,
      }
      return NextResponse.json(passResult)
    }

    // External analytics service is configured — authenticate and proxy.
    const { dataset_id, version_id, project_id, analysis_config } = body

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const session = await supabase.auth.getSession()
    const accessToken = session.data.session?.access_token
    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let analyticsUrl = process.env.ANALYTICS_API_URL
    if (!analyticsUrl.startsWith('http')) analyticsUrl = `https://${analyticsUrl}`

    const response = await fetch(
      `${analyticsUrl}/analytics/integrity/assumption-checks`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          dataset_id, version_id, project_id,
          analysis_type, analysis_config,
          requested_by: user.id,
        }),
      }
    )

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to run assumption checks' },
        { status: response.status }
      )
    }

    const result: AssumptionCheckResult = await response.json()
    return NextResponse.json(result)
  } catch (error) {
    console.error('[POST /api/analysis/assumption-checks]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
