/**
 * POST /api/approvals/[requestId]/resubmit
 * Researcher resubmits after revision was requested.
 */

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { writeAuditEntry } from '@/lib/audit/auditLogger'
import { sendNotification, notifyWorkspaceSupervisors } from '@/lib/notifications/notificationService'

const bodySchema = z.object({
  resubmission_note: z.string().min(1).max(500),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const { requestId } = await params
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = bodySchema.safeParse(await request.json())
    if (!body.success) {
      return NextResponse.json({ error: 'resubmission_note is required' }, { status: 400 })
    }
    const { resubmission_note } = body.data

    // Fetch the request
    const { data: approvalReq } = await supabase
      .from('dataset_approval_requests')
      .select(`
        id, status, requested_by, assigned_supervisor, version_id, project_id,
        dataset:dataset_id(name),
        version:version_id(version_number)
      `)
      .eq('id', requestId)
      .single()

    if (!approvalReq) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    // Only the original requester can resubmit
    if (approvalReq.requested_by !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (approvalReq.status !== 'revision_requested') {
      return NextResponse.json(
        { error: `Cannot resubmit a request with status "${approvalReq.status}"` },
        { status: 409 }
      )
    }

    // Update back to pending
    await supabase
      .from('dataset_approval_requests')
      .update({
        status: 'pending',
        reviewer_note: null,
        requested_at: new Date().toISOString(),
      })
      .eq('id', requestId)

    // Insert history
    await supabase.from('approval_review_history').insert({
      request_id: requestId,
      reviewer_id: user.id,
      action: 'resubmitted',
      note: resubmission_note,
    })

    // Write audit entry
    const dataset = approvalReq.dataset as unknown as { name: string } | null
    const version = approvalReq.version as unknown as { version_number: number } | null

    await writeAuditEntry(
      {
        actor_id: user.id,
        action: 'dataset.approval.requested',
        resource_type: 'dataset_version',
        resource_id: approvalReq.version_id,
        project_id: approvalReq.project_id,
        details: {
          summary: `Dataset version v${version?.version_number} resubmitted for approval after revisions`,
          operation: { request_id: requestId, resubmission_note },
        },
      },
      supabase
    )

    // Notify supervisor
    const { data: researcher } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()

    const notifTitle = 'Dataset resubmitted'
    const notifBody = `${researcher?.full_name ?? 'Researcher'} has resubmitted "${dataset?.name ?? 'dataset'} v${version?.version_number}" after revisions.`
    const notifLink = `/approvals/${requestId}`

    if (approvalReq.assigned_supervisor) {
      await sendNotification(
        approvalReq.assigned_supervisor,
        'approval_resubmitted',
        notifTitle,
        notifBody,
        notifLink,
        { resource_type: 'dataset_approval_request', resource_id: requestId },
        supabase
      )
    } else {
      const { data: proj } = await supabase
        .from('projects')
        .select('workspace_id')
        .eq('id', approvalReq.project_id)
        .single()

      if (proj?.workspace_id) {
        await notifyWorkspaceSupervisors(
          proj.workspace_id,
          'approval_resubmitted',
          notifTitle,
          notifBody,
          notifLink,
          { resource_type: 'dataset_approval_request', resource_id: requestId },
          supabase
        )
      }
    }

    return NextResponse.json({ request_id: requestId, status: 'pending' })
  } catch (error) {
    console.error('Resubmit error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
