import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { hasProjectAccess } from '@/lib/supabase/projectAccess'

/**
 * GET /api/datasets/[id]/reentry/[sessionId]/discrepancies
 * Fetch discrepancies from a re-entry comparison
 * Supports filters: column_name, status, participant_id
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  try {
    const { id: datasetId, sessionId } = await params
    const url = new URL(request.url)

    const columnName = url.searchParams.get('column_name')
    const status = url.searchParams.get('status')
    const participantId = url.searchParams.get('participant_id')

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

    // Verify access
    const isInvolved =
      session.initiated_by === user.id || session.reentry_assigned_to === user.id
    
    if (!isInvolved) {
      if (!await hasProjectAccess(supabase, session.project_id, user.id)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // Build query
    let query = supabase
      .from('reentry_discrepancies')
      .select('*')
      .eq('session_id', sessionId)

    if (columnName) {
      query = query.eq('column_name', columnName)
    }
    if (status) {
      query = query.eq('status', status)
    }
    if (participantId) {
      query = query.eq('participant_id', participantId)
    }

    const { data: discrepancies } = await query.order('created_at', {
      ascending: false,
    })

    return NextResponse.json(discrepancies || [])
  } catch (error) {
    console.error(
      '[GET /api/datasets/[id]/reentry/[sessionId]/discrepancies]',
      error
    )
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
