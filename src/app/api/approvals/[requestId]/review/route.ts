/**
 * POST /api/approvals/[requestId]/review
 * Supervisor approves, rejects, or requests revisions.
 */

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { writeAuditEntry } from '@/lib/audit/auditLogger'
import type { AuditAction } from '@/types/audit'
import { sendNotification } from '@/lib/notifications/notificationService'

const bodySchema = z.object({
  action: z.enum(['approve', 'reject', 'request_revision']),
  note: z.string().max(1000).optional(),
}).refine(
  (d) => d.action === 'approve' || (d.note && d.note.trim().length >= 10),
  { message: 'A note is required for rejection and revision requests (min 10 chars)', path: ['note'] }
)

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
      return NextResponse.json({ error: body.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
    }
    const { action, note } = body.data

    // 1. Fetch the approval request
    const { data: approvalReq, error: fetchError } = await supabase
      .from('dataset_approval_requests')
      .select(`
        id, status, dataset_id, version_id, project_id,
        requested_by, assigned_supervisor,
        dataset:dataset_id(name, project_id),
        version:version_id(version_number)
      `)
      .eq('id', requestId)
      .single()

    if (fetchError || !approvalReq) {
      return NextResponse.json({ error: 'Approval request not found' }, { status: 404 })
    }

    // 2. Authorization — must be the assigned supervisor or a workspace supervisor
    const isAssigned = approvalReq.assigned_supervisor === user.id

    let isWorkspaceSupervisor = false
    if (!isAssigned) {
      const { data: proj } = await supabase
        .from('projects')
        .select('workspace_id')
        .eq('id', approvalReq.project_id)
        .single()

      if (proj?.workspace_id) {
        const { data: mem } = await supabase
          .from('workspace_memberships')
          .select('id')
          .eq('workspace_id', proj.workspace_id)
          .eq('user_id', user.id)
          .eq('role', 'supervisor')
          .maybeSingle()
        isWorkspaceSupervisor = !!mem
      }
    }

    if (!isAssigned && !isWorkspaceSupervisor) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 3. Must be in a reviewable state
    if (!['pending', 'in_review'].includes(approvalReq.status)) {
      return NextResponse.json(
        { error: `Cannot review a request with status "${approvalReq.status}"` },
        { status: 409 }
      )
    }

    const now = new Date().toISOString()
    const dataset = approvalReq.dataset as unknown as { name: string } | null
    const version = approvalReq.version as unknown as { version_number: number } | null

    let newStatus: string
    let auditAction: AuditAction
    let auditSummary: string

    if (action === 'approve') {
      // Get latest audit hash to cryptographically lock approval
      const { data: lastAudit } = await supabase
        .from('audit_logs')
        .select('entry_hash')
        .eq('resource_id', approvalReq.version_id)
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle()

      const approvedHash = lastAudit?.entry_hash ?? null

      await supabase
        .from('dataset_approval_requests')
        .update({
          status: 'approved',
          reviewed_at: now,
          reviewed_by: user.id,
          reviewer_note: note ?? null,
          approved_version_hash: approvedHash,
        })
        .eq('id', requestId)

      newStatus = 'approved'
      auditAction = 'dataset.approved'
      auditSummary = `Dataset version v${version?.version_number} approved for analysis`
    } else if (action === 'reject') {
      await supabase
        .from('dataset_approval_requests')
        .update({ status: 'rejected', reviewed_at: now, reviewed_by: user.id, reviewer_note: note ?? null })
        .eq('id', requestId)

      newStatus = 'rejected'
      auditAction = 'dataset.approval.rejected'
      auditSummary = `Dataset version v${version?.version_number} rejected by supervisor`
    } else {
      await supabase
        .from('dataset_approval_requests')
        .update({ status: 'revision_requested', reviewed_at: now, reviewed_by: user.id, reviewer_note: note ?? null })
        .eq('id', requestId)

      newStatus = 'revision_requested'
      auditAction = 'dataset.approval.revision_requested'
      auditSummary = `Revisions requested for dataset version v${version?.version_number}`
    }

    // 4. Write audit entry
    const auditResult = await writeAuditEntry(
      {
        actor_id: user.id,
        action: auditAction,
        resource_type: 'dataset_version',
        resource_id: approvalReq.version_id,
        project_id: approvalReq.project_id,
        details: {
          summary: auditSummary,
          justification: note,
          justification_category: 'other',
          operation: { request_id: requestId },
        },
      },
      supabase
    )

    // 5. Insert review history
    const historyAction =
      action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'revision_requested'

    await supabase.from('approval_review_history').insert({
      request_id: requestId,
      reviewer_id: user.id,
      action: historyAction,
      note: note ?? null,
      audit_entry_id: auditResult.entry_id ?? null,
    })

    // 6. Notify researcher
    const { data: supervisor } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()

    const supervisorName = supervisor?.full_name ?? 'Your supervisor'
    const datasetName = dataset?.name ?? 'your dataset'
    const versionLabel = `v${version?.version_number ?? ''}`
    const projectId = approvalReq.project_id

    const notifMap = {
      approved: {
        type: 'approval_granted',
        title: 'Dataset approved',
        body: `${supervisorName} approved "${datasetName} ${versionLabel}". You can now run analyses.`,
        link: `/projects/${projectId}/data`,
      },
      rejected: {
        type: 'approval_rejected',
        title: 'Dataset approval declined',
        body: `${supervisorName} declined "${datasetName} ${versionLabel}". Review their feedback.`,
        link: `/projects/${projectId}/data`,
      },
      revision_requested: {
        type: 'revision_requested',
        title: 'Revisions requested',
        body: `${supervisorName} has requested changes to "${datasetName} ${versionLabel}" before approval.`,
        link: `/projects/${projectId}/data`,
      },
    }

    const notif = notifMap[historyAction as keyof typeof notifMap]
    if (notif) {
      await sendNotification(
        approvalReq.requested_by,
        notif.type,
        notif.title,
        notif.body,
        notif.link,
        { resource_type: 'dataset_approval_request', resource_id: requestId },
        supabase
      )
    }

    return NextResponse.json({ request_id: requestId, status: newStatus })
  } catch (error) {
    console.error('Review action error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
