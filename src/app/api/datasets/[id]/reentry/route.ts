import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { hasProjectAccess } from '@/lib/supabase/projectAccess'
import type { ReentrySession } from '@/types/analysisIntegrity'

/**
 * POST /api/datasets/[id]/reentry
 * Create new re-entry validation session
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: datasetId } = await params
    const body = await request.json()
    const {
      original_version_id,
      participant_id_column,
      columns_to_validate,
      assigned_to,
    } = body

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify dataset exists and get project
    const { data: dataset } = await supabase
      .from('datasets')
      .select('project_id')
      .eq('id', datasetId)
      .single()

    if (!dataset) {
      return NextResponse.json({ error: 'Dataset not found' }, { status: 404 })
    }

    // Verify user can access this project
    if (!await hasProjectAccess(supabase, dataset.project_id, user.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Create session
    const { data: session, error: sessionError } = await supabase
      .from('reentry_sessions')
      .insert({
        dataset_id: datasetId,
        project_id: dataset.project_id,
        original_version_id,
        initiated_by: user.id,
        reentry_assigned_to: assigned_to || null,
        status: 'pending',
        columns_to_validate: columns_to_validate || null,
        participant_id_column,
      })
      .select()
      .single()

    if (sessionError) {
      return NextResponse.json(
        { error: 'Failed to create session' },
        { status: 500 }
      )
    }

    // Write audit entry
    await supabase.from('audit_logs').insert({
      actor_id: user.id,
      action: 'dataset.reentry.initiated',
      resource_type: 'dataset',
      resource_id: session.id,
      project_id: dataset.project_id,
      details: {
        summary: `Re-entry validation initiated for dataset`,
        operation: {
          session_id: session.id,
          assigned_to: assigned_to || null,
          columns_count: columns_to_validate?.length || 'all',
          participant_id_column,
        },
      },
    })

    return NextResponse.json(session)
  } catch (error) {
    console.error('[POST /api/datasets/[id]/reentry]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/datasets/[id]/reentry
 * List re-entry sessions for a dataset
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: datasetId } = await params

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify dataset exists
    const { data: dataset } = await supabase
      .from('datasets')
      .select('project_id')
      .eq('id', datasetId)
      .single()

    if (!dataset) {
      return NextResponse.json({ error: 'Dataset not found' }, { status: 404 })
    }

    // Verify user can access project
    if (!await hasProjectAccess(supabase, dataset.project_id, user.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch sessions
    const { data: sessions } = await supabase
      .from('reentry_sessions')
      .select('*')
      .eq('dataset_id', datasetId)
      .order('created_at', { ascending: false })

    return NextResponse.json(sessions || [])
  } catch (error) {
    console.error('[GET /api/datasets/[id]/reentry]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
