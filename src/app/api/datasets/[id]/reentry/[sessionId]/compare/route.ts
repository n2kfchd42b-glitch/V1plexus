import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/datasets/[id]/reentry/[sessionId]/compare
 * Trigger comparison between original and re-entered data
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  try {
    const { id: datasetId, sessionId } = await params
    const body = await request.json()
    const { reentry_version_id } = body

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch session and verify access
    const { data: session } = await supabase
      .from('reentry_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('dataset_id', datasetId)
      .single()

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Verify user is initiator or assigned
    if (session.initiated_by !== user.id && session.reentry_assigned_to !== user.id) {
      // Check project membership
      const { data: projectMember } = await supabase
        .from('project_members')
        .select('id')
        .eq('project_id', session.project_id)
        .eq('user_id', user.id)
        .single()

      if (!projectMember) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // Call FastAPI endpoint
    let analyticsUrl = process.env.ANALYTICS_API_URL || 'http://localhost:8000'
    if (analyticsUrl && !analyticsUrl.startsWith('http')) analyticsUrl = `https://${analyticsUrl}`
    const sess = await supabase.auth.getSession()
    const accessToken = sess.data.session?.access_token
    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const response = await fetch(
      `${analyticsUrl}/analytics/integrity/reentry/compare`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          session_id: sessionId,
          original_version_id: session.original_version_id,
          reentry_version_id,
          participant_id_column: session.participant_id_column,
          columns_to_validate: session.columns_to_validate,
          requested_by: user.id,
        }),
      }
    )

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Comparison failed' },
        { status: response.status }
      )
    }

    const result = await response.json()
    return NextResponse.json(result)
  } catch (error) {
    console.error('[POST /api/datasets/[id]/reentry/[sessionId]/compare]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
