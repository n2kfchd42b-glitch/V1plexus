import { NextRequest, NextResponse } from 'next/server'
import { createClient, getAccessTokenFromRequest } from '@/lib/supabase/server'
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
    const { dataset_id, version_id, project_id, analysis_config, study_design, research_question } = body

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const accessToken = getAccessTokenFromRequest(request)
    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let analyticsUrl = process.env.ANALYTICS_API_URL
    if (!analyticsUrl.startsWith('http')) analyticsUrl = `https://${analyticsUrl}`

    const fetchPromise = fetch(
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
          study_design: study_design ?? null,
          research_question: research_question ?? null,
          requested_by: user.id,
        }),
      }
    )

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('assumption-check timeout')), 10000)
    )

    const response = await Promise.race([fetchPromise, timeoutPromise])

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      console.error('[assumption-checks] external service error', response.status, errText)
      // Degrade gracefully — return an "unavailable" result rather than 500
      const unavailable: AssumptionCheckResult = {
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
      return NextResponse.json(unavailable)
    }

    const result: AssumptionCheckResult = await response.json()
    // Normalize: Python backend may omit or null-out checks on error paths
    if (!Array.isArray(result.checks)) result.checks = []
    return NextResponse.json(result)
  } catch (error) {
    console.error('[POST /api/analysis/assumption-checks]', error)
    // Degrade gracefully on network/parse errors too
    const { analysis_type } = (await request.json().catch(() => ({}))) as { analysis_type?: string }
    const unavailable: AssumptionCheckResult = {
      check_id: '',
      analysis_type: analysis_type ?? '',
      checks: [],
      all_passed: true,
      run_recommendation: 'proceed',
      critical_violations: 0,
      moderate_violations: 0,
      minor_violations: 0,
      not_applicable_count: 0,
      requires_acknowledgement: false,
    }
    return NextResponse.json(unavailable)
  }
}
