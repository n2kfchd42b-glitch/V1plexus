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

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const version_id = request.nextUrl.searchParams.get('version_id')
    if (!version_id) {
      return NextResponse.json({ error: 'version_id is required' }, { status: 400 })
    }

    // Single query: verify version belongs to dataset and get project_id via join
    const { data: version } = await supabase
      .from('dataset_versions')
      .select('id, version_number, datasets(project_id)')
      .eq('id', version_id)
      .eq('dataset_id', dataset_id)
      .single()

    if (!version) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 })
    }

    const datasetRow = Array.isArray(version.datasets) ? version.datasets[0] : version.datasets
    if (!datasetRow?.project_id) {
      return NextResponse.json({ error: 'Dataset not found' }, { status: 404 })
    }

    const approvalCheck = await checkVersionApproval(version_id, datasetRow.project_id, supabase)

    // If there's a request, load full detail including supervisor + history in parallel
    if (!approvalCheck.request) {
      return NextResponse.json({ has_request: false, ...approvalCheck })
    }

    const [{ data: fullRequest }, { data: history }] = await Promise.all([
      supabase
        .from('dataset_approval_requests')
        .select(`
          id, status, requested_at, reviewed_at, reviewer_note,
          assigned_supervisor, request_message,
          supervisor:assigned_supervisor(id, full_name)
        `)
        .eq('id', approvalCheck.request.id)
        .single(),
      supabase
        .from('approval_review_history')
        .select(`
          id, action, note, created_at,
          reviewer:reviewer_id(full_name)
        `)
        .eq('request_id', approvalCheck.request.id)
        .order('created_at', { ascending: true }),
    ])

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
