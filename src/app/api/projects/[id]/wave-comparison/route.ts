import { NextRequest, NextResponse } from 'next/server'
import { ANALYTICS_ENABLED } from '@/lib/flags'
import { getAnalyticsBaseUrl } from '@/lib/analyticsService'
import { createClient } from '@/lib/supabase/server'
import { hasProjectAccess } from '@/lib/supabase/projectAccess'
import type { WaveConsistencyReport } from '@/types/qualityIntelligence'

/**
 * POST /api/projects/[id]/wave-comparison
 * Initiate cross-wave consistency analysis
 * Body: { wave_a_version_id: string, wave_b_version_id: string, participant_id_column?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!ANALYTICS_ENABLED) {
    return Response.json({ unavailable: true, error: 'Advanced analytics service is not enabled.' }, { status: 503 })
  }
  try {
    const { id: projectId } = await params
    const body = await request.json()
    const { wave_a_version_id, wave_b_version_id, participant_id_column } = body

    if (!wave_a_version_id || !wave_b_version_id) {
      return NextResponse.json(
        { error: 'wave_a_version_id and wave_b_version_id are required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user can access this project
    if (!await hasProjectAccess(supabase, projectId, user.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Verify both versions exist and belong to this project
    const { data: versionA } = await supabase
      .from('dataset_versions')
      .select('dataset_id, data')
      .eq('id', wave_a_version_id)
      .single()

    const { data: versionB } = await supabase
      .from('dataset_versions')
      .select('dataset_id, data')
      .eq('id', wave_b_version_id)
      .single()

    if (!versionA || !versionB) {
      return NextResponse.json(
        { error: 'One or both dataset versions not found' },
        { status: 404 }
      )
    }

    // Verify both datasets belong to this project
    const { data: datasetA } = await supabase
      .from('datasets')
      .select('project_id')
      .eq('id', versionA.dataset_id)
      .single()

    const { data: datasetB } = await supabase
      .from('datasets')
      .select('project_id')
      .eq('id', versionB.dataset_id)
      .single()

    if (!datasetA || !datasetB || datasetA.project_id !== projectId || datasetB.project_id !== projectId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Call FastAPI backend to compute wave consistency
    const analyticsUrl = getAnalyticsBaseUrl()
    
    const session = await supabase.auth.getSession()
    const accessToken = session.data.session?.access_token
    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const response = await fetch(
      `${analyticsUrl}/analytics/quality/wave-comparison`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          project_id: projectId,
          wave_a_version_id,
          wave_b_version_id,
          participant_id_column: participant_id_column || 'participant_id',
        }),
      }
    )

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to compute wave comparison' },
        { status: response.status }
      )
    }

    const report: WaveConsistencyReport = await response.json()
    return NextResponse.json(report)
  } catch (error) {
    console.error('[POST /api/projects/[id]/wave-comparison]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
