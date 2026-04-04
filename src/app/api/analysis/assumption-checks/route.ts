import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { AssumptionCheckResult } from '@/types/analysisIntegrity'

/**
 * POST /api/analysis/assumption-checks
 * Trigger assumption checks before analysis runs
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      dataset_id,
      version_id,
      project_id,
      analysis_type,
      analysis_config,
    } = body

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user can access this dataset
    const { data: dataset } = await supabase
      .from('datasets')
      .select('project_id')
      .eq('id', dataset_id)
      .single()

    if (!dataset) {
      return NextResponse.json({ error: 'Dataset not found' }, { status: 404 })
    }

    const { data: projectMember } = await supabase
      .from('project_members')
      .select('id')
      .eq('project_id', dataset.project_id)
      .eq('user_id', user.id)
      .single()

    if (!projectMember) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Call FastAPI endpoint
    const analyticsUrl = process.env.ANALYTICS_API_URL || 'http://localhost:8000'
    const session = await supabase.auth.getSession()
    const accessToken = session.data.session?.access_token
    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const response = await fetch(
      `${analyticsUrl}/analytics/integrity/assumption-checks`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          dataset_id,
          version_id,
          project_id,
          analysis_type,
          analysis_config,
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
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
