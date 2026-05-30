import { NextRequest, NextResponse } from 'next/server'
import { getAnalyticsBaseUrl } from '@/lib/analyticsService'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/causal/estimate/evalue
 * Compute E-value and sensitivity curve from a completed ATE estimate.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { dagId, estimationId, ate, ciLower, ciUpper, baselineRisk } = body

    if (!dagId || ate === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const analyticsUrl = getAnalyticsBaseUrl()
    const session = await supabase.auth.getSession()
    const accessToken = session.data.session?.access_token
    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Derive project_id from the DAG
    const { data: dag } = await supabase
      .from('causal_dags')
      .select('project_id')
      .eq('id', dagId)
      .single()

    if (!dag) {
      return NextResponse.json({ error: 'DAG not found' }, { status: 404 })
    }

    const res = await fetch(`${analyticsUrl}/analytics/causal/estimate/evalue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        dag_id: dagId,
        project_id: dag.project_id,
        estimation_id: estimationId ?? null,
        ate,
        ci_lower: ciLower ?? null,
        ci_upper: ciUpper ?? null,
        baseline_risk: baselineRisk ?? 0.3,
      }),
    })

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to compute E-value' }, { status: 500 })
    }

    return NextResponse.json(await res.json())
  } catch (error) {
    console.error('[POST /api/causal/estimate/evalue]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
