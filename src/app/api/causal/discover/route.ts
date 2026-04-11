import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * POST /api/causal/discover
 * Creates a causal_dags record in Supabase, then forwards to FastAPI to
 * enqueue the PC algorithm as a background task.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { projectId, datasetId, versionId, exposure, outcome, variableColumns, alpha } = body

    if (!projectId || !datasetId || !versionId || !exposure || !outcome || !variableColumns?.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Verify access via the dataset (mirrors pattern used by existing analysis routes)
    const { data: dataset } = await supabase
      .from('datasets')
      .select('project_id')
      .eq('id', datasetId)
      .single()

    if (!dataset) {
      return NextResponse.json({ error: 'Dataset not found' }, { status: 404 })
    }

    // Create DAG record — use service client to bypass RLS on insert
    // (access already verified above via the datasets query)
    const serviceSupabase = createServiceClient()
    const { data: dag, error: dagError } = await serviceSupabase
      .from('causal_dags')
      .insert({
        project_id: dataset.project_id,
        dataset_id: datasetId,
        exposure_variable: exposure,
        outcome_variable: outcome,
        status: 'pending',
        created_by: user.id,
      })
      .select('id')
      .single()

    if (dagError || !dag) {
      console.error('[POST /api/causal/discover] DAG insert error:', dagError)
      return NextResponse.json({ error: 'Failed to create DAG record' }, { status: 500 })
    }

    // Forward to FastAPI
    let analyticsUrl = process.env.ANALYTICS_API_URL || 'http://localhost:8000'
    if (analyticsUrl && !analyticsUrl.startsWith('http')) analyticsUrl = `https://${analyticsUrl}`
    const session = await supabase.auth.getSession()
    const accessToken = session.data.session?.access_token
    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const fastapiRes = await fetch(`${analyticsUrl}/analytics/causal/discover`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        dag_id: dag.id,
        dataset_id: datasetId,
        version_id: versionId,
        exposure,
        outcome,
        variable_columns: variableColumns,
        alpha: alpha ?? 0.05,
      }),
    })

    if (!fastapiRes.ok) {
      console.error('[POST /api/causal/discover] FastAPI error:', fastapiRes.status)
      return NextResponse.json({ error: 'Failed to start causal discovery' }, { status: 500 })
    }

    return NextResponse.json({ dagId: dag.id, status: 'pending' })
  } catch (error) {
    console.error('[POST /api/causal/discover]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
