import { NextRequest, NextResponse } from 'next/server'
import { getAnalyticsBaseUrl } from '@/lib/analyticsService'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/causal/estimate/run
 * Validates DAG is confirmed, forwards to FastAPI which fires all three
 * estimation background tasks. Returns immediately.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { dagId, datasetId, versionId } = body

    if (!dagId || !datasetId || !versionId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Verify access via dataset (mirrors Phase A fix)
    const { data: dataset } = await supabase
      .from('datasets')
      .select('project_id')
      .eq('id', datasetId)
      .single()

    if (!dataset) {
      return NextResponse.json({ error: 'Dataset not found' }, { status: 404 })
    }

    const analyticsUrl = getAnalyticsBaseUrl()
    const session = await supabase.auth.getSession()
    const accessToken = session.data.session?.access_token
    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const res = await fetch(`${analyticsUrl}/analytics/causal/estimate/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        dag_id: dagId,
        dataset_id: datasetId,
        version_id: versionId,
        project_id: dataset.project_id,
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return NextResponse.json(
        { error: err.detail || 'Failed to start estimation' },
        { status: res.status }
      )
    }

    return NextResponse.json(await res.json())
  } catch (error) {
    console.error('[POST /api/causal/estimate/run]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
