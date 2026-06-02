import { NextRequest, NextResponse } from 'next/server'
import { ANALYTICS_ENABLED } from '@/lib/flags'
import { getAnalyticsBaseUrl } from '@/lib/analyticsService'
import { createClient } from '@/lib/supabase/server'
import { writeAuditEntry } from '@/lib/audit/auditLogger'

/**
 * POST /api/causal/confirm
 * Confirms a researcher-edited DAG, then computes the adjustment set.
 * Returns combined confirmation + adjustment set result.
 */
export async function POST(req: NextRequest) {
  if (!ANALYTICS_ENABLED) {
    return Response.json({ unavailable: true, error: 'Advanced analytics service is not enabled.' }, { status: 503 })
  }
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { dagId, confirmedEdges, edgeDecisions, exposure, outcome } = body

    if (!dagId || !confirmedEdges || !exposure || !outcome) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const analyticsUrl = getAnalyticsBaseUrl()
    const session = await supabase.auth.getSession()
    const accessToken = session.data.session?.access_token
    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    }

    // Step 1: Confirm the DAG
    const confirmRes = await fetch(`${analyticsUrl}/analytics/causal/confirm`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        dag_id: dagId,
        confirmed_edges: confirmedEdges,
        edge_decisions: edgeDecisions ?? [],
      }),
    })

    if (!confirmRes.ok) {
      return NextResponse.json({ error: 'Failed to confirm DAG' }, { status: 500 })
    }

    // Step 2: Compute adjustment set
    const adjRes = await fetch(`${analyticsUrl}/analytics/causal/adjustment-set`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        dag_id: dagId,
        confirmed_edges: confirmedEdges,
        exposure,
        outcome,
      }),
    })

    if (!adjRes.ok) {
      return NextResponse.json({ error: 'Failed to compute adjustment set' }, { status: 500 })
    }

    const adjustmentResult = await adjRes.json()

    // Fetch project_id for the project chain — best-effort, non-blocking
    const { data: dag } = await supabase
      .from('causal_dags')
      .select('project_id')
      .eq('id', dagId)
      .single()

    void writeAuditEntry({
      actor_id: user.id,
      action: 'causal.dag.confirmed',
      resource_type: 'causal_dag',
      resource_id: dagId,
      project_id: dag?.project_id ?? undefined,
      details: {
        summary: `Causal DAG confirmed (${exposure} → ${outcome})`,
        operation: { dag_id: dagId, edges_confirmed: confirmedEdges?.length ?? 0 },
      },
    }, supabase)

    return NextResponse.json({ dagId, status: 'confirmed', ...adjustmentResult })
  } catch (error) {
    console.error('[POST /api/causal/confirm]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
