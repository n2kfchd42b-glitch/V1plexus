import { NextRequest, NextResponse } from 'next/server'
import { getAnalyticsBaseUrl } from '@/lib/analyticsService'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/causal/estimate/narrative
 * Generate a causal narrative from stored estimation results.
 * Requires doubly_robust result to be complete.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { dagId } = body
    if (!dagId) {
      return NextResponse.json({ error: 'Missing dagId' }, { status: 400 })
    }

    const { data: dag } = await supabase
      .from('causal_dags')
      .select('project_id')
      .eq('id', dagId)
      .single()

    if (!dag) {
      return NextResponse.json({ error: 'DAG not found' }, { status: 404 })
    }

    const analyticsUrl = getAnalyticsBaseUrl()
    const session = await supabase.auth.getSession()
    const accessToken = session.data.session?.access_token
    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const res = await fetch(`${analyticsUrl}/analytics/causal/estimate/narrative`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ dag_id: dagId, project_id: dag.project_id }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return NextResponse.json(
        { error: err.detail || 'Failed to generate narrative' },
        { status: res.status }
      )
    }

    return NextResponse.json(await res.json())
  } catch (error) {
    console.error('[POST /api/causal/estimate/narrative]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/causal/estimate/narrative
 * Push a narrative to the document editor.
 */
export async function PUT(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { narrativeId, documentId, dagId } = body
    if (!narrativeId || !documentId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data: dag } = await supabase
      .from('causal_dags')
      .select('project_id')
      .eq('id', dagId)
      .single()

    const analyticsUrl = getAnalyticsBaseUrl()
    const session = await supabase.auth.getSession()
    const accessToken = session.data.session?.access_token
    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const res = await fetch(`${analyticsUrl}/analytics/causal/estimate/narrative/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        narrative_id: narrativeId,
        document_id: documentId,
        project_id: dag?.project_id,
      }),
    })

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to push narrative' }, { status: 500 })
    }

    return NextResponse.json(await res.json())
  } catch (error) {
    console.error('[PUT /api/causal/estimate/narrative]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
