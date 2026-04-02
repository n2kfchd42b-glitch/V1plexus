/**
 * GET /api/datasets/[id]/approval/status?version_id=<uuid>
 * Returns approval status for a dataset version.
 */

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { checkVersionApproval } from '@/lib/approvals/checkApproval'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: dataset_id } = await params
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const version_id = request.nextUrl.searchParams.get('version_id')
    if (!version_id) {
      return NextResponse.json({ error: 'version_id is required' }, { status: 400 })
    }

    // Verify version belongs to dataset
    const { data: version } = await supabase
      .from('dataset_versions')
      .select('id, version_number')
      .eq('id', version_id)
      .eq('dataset_id', dataset_id)
      .single()

    if (!version) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 })
    }

    // Get the dataset's project_id
    const { data: dataset } = await supabase
      .from('datasets')
      .select('project_id')
      .eq('id', dataset_id)
      .single()

    if (!dataset) {
      return NextResponse.json({ error: 'Dataset not found' }, { status: 404 })
    }

    const approvalCheck = await checkVersionApproval(version_id, dataset.project_id, supabase)

    // If there's a request, load full detail including supervisor + history
    if (!approvalCheck.request) {
      return NextResponse.json({ has_request: false, ...approvalCheck })
    }

    const { data: fullRequest } = await supabase
      .from('dataset_approval_requests')
      .select(`
        id, status, requested_at, reviewed_at, reviewer_note,
        assigned_supervisor, request_message,
        supervisor:assigned_supervisor(id, full_name)
      `)
      .eq('id', approvalCheck.request.id)
      .single()

    const { data: history } = await supabase
      .from('approval_review_history')
      .select(`
        id, action, note, created_at,
        reviewer:reviewer_id(full_name)
      `)
      .eq('request_id', approvalCheck.request.id)
      .order('created_at', { ascending: true })

    return NextResponse.json({
      has_request: true,
      request: {
        ...fullRequest,
        history: history ?? [],
      },
      can_analyze: approvalCheck.can_analyze,
      status: approvalCheck.status,
      reason: approvalCheck.reason ?? null,
    })
  } catch (error) {
    console.error('Approval status error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
