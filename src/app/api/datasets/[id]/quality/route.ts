import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { QualityReport } from '@/types/qualityIntelligence'

/**
 * GET /api/datasets/[id]/quality
 * Fetch the quality report for a dataset version
 * Query params: version_id (optional, defaults to latest)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: datasetId } = await params
    const url = new URL(request.url)
    const versionId = url.searchParams.get('version_id')

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user can access this dataset (via project membership)
    const { data: dataset, error: datasetError } = await supabase
      .from('datasets')
      .select('project_id')
      .eq('id', datasetId)
      .single()

    if (datasetError || !dataset) {
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

    // Call FastAPI backend for quality report
    const analyticsUrl = process.env.ANALYTICS_API_URL || 'http://localhost:8000'
    const params_str = versionId ? `?version_id=${versionId}` : ''
    
    const session = await supabase.auth.getSession()
    const response = await fetch(
      `${analyticsUrl}/analytics/quality/report?dataset_id=${datasetId}${params_str ? '&' + params_str.slice(1) : ''}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.data.session?.access_token || ''}`,
        },
      }
    )

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch quality report' },
        { status: response.status }
      )
    }

    const report: QualityReport = await response.json()
    return NextResponse.json(report)
  } catch (error) {
    console.error('[GET /api/datasets/[id]/quality]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/datasets/[id]/quality/recompute
 * Manual trigger to recompute quality report for a dataset version
 * Body: { version_id?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: datasetId } = await params
    const body = await request.json()
    const { version_id } = body

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user can access this dataset
    const { data: dataset, error: datasetError } = await supabase
      .from('datasets')
      .select('project_id')
      .eq('id', datasetId)
      .single()

    if (datasetError || !dataset) {
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

    // Call FastAPI backend to trigger recompute
    const analyticsUrl = process.env.ANALYTICS_API_URL || 'http://localhost:8000'
    
    const session = await supabase.auth.getSession()
    const response = await fetch(
      `${analyticsUrl}/analytics/quality/compute`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.data.session?.access_token || ''}`,
        },
        body: JSON.stringify({
          dataset_id: datasetId,
          version_id: version_id || undefined,
        }),
      }
    )

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to trigger recompute' },
        { status: response.status }
      )
    }

    const result = await response.json()
    return NextResponse.json(result)
  } catch (error) {
    console.error('[POST /api/datasets/[id]/quality]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
