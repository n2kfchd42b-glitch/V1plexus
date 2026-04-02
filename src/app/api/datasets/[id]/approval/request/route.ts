/**
 * POST /api/datasets/[id]/approval/request
 * Researcher submits a dataset version for supervisor approval.
 */

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { writeAuditEntry } from '@/lib/audit/auditLogger'
import { sendNotification, notifyWorkspaceSupervisors } from '@/lib/notifications/notificationService'

const bodySchema = z.object({
  version_id: z.string().uuid(),
  project_id: z.string().uuid(),
  request_message: z.string().max(500).optional(),
  assigned_supervisor: z.string().uuid().optional(),
})

export async function POST(
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

    const body = bodySchema.safeParse(await request.json())
    if (!body.success) {
      return NextResponse.json({ error: 'Invalid request', issues: body.error.issues }, { status: 400 })
    }
    const { version_id, project_id, request_message, assigned_supervisor } = body.data

    // 1. Verify the dataset belongs to this user (or is in their project)
    const { data: dataset, error: datasetError } = await supabase
      .from('datasets')
      .select('id, name, project_id')
      .eq('id', dataset_id)
      .single()

    if (datasetError || !dataset) {
      return NextResponse.json({ error: 'Dataset not found' }, { status: 404 })
    }

    // 2. Verify version belongs to dataset
    const { data: version, error: versionError } = await supabase
      .from('dataset_versions')
      .select('id, version_number')
      .eq('id', version_id)
      .eq('dataset_id', dataset_id)
      .single()

    if (versionError || !version) {
      return NextResponse.json({ error: 'Version not found for this dataset' }, { status: 404 })
    }

    // 3. Check for existing active request on this version
    const { data: existing } = await supabase
      .from('dataset_approval_requests')
      .select('id, status')
      .eq('version_id', version_id)
      .maybeSingle()

    if (existing && (existing.status === 'pending' || existing.status === 'in_review')) {
      return NextResponse.json(
        { error: 'An approval request is already pending for this version.' },
        { status: 409 }
      )
    }

    // 4. If assigned_supervisor provided, verify they are a supervisor on this workspace
    if (assigned_supervisor) {
      const { data: proj } = await supabase
        .from('projects')
        .select('workspace_id')
        .eq('id', project_id)
        .single()

      if (proj?.workspace_id) {
        const { data: isSupervisor } = await supabase
          .from('workspace_memberships')
          .select('id')
          .eq('workspace_id', proj.workspace_id)
          .eq('user_id', assigned_supervisor)
          .eq('role', 'supervisor')
          .maybeSingle()

        if (!isSupervisor) {
          return NextResponse.json(
            { error: 'Assigned user is not a supervisor on this project.' },
            { status: 400 }
          )
        }
      }
    }

    // 5. Insert approval request
    const { data: newRequest, error: insertError } = await supabase
      .from('dataset_approval_requests')
      .insert({
        dataset_id,
        version_id,
        project_id,
        requested_by: user.id,
        assigned_supervisor: assigned_supervisor ?? null,
        status: 'pending',
        request_message: request_message ?? null,
        requested_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (insertError || !newRequest) {
      console.error('Insert error:', insertError)
      return NextResponse.json({ error: 'Failed to create approval request' }, { status: 500 })
    }

    // 6. Insert review history — submitted
    await supabase.from('approval_review_history').insert({
      request_id: newRequest.id,
      reviewer_id: user.id,
      action: 'submitted',
      note: request_message ?? null,
    })

    // 7. Write audit entry
    const auditResult = await writeAuditEntry(
      {
        actor_id: user.id,
        action: 'dataset.approval.requested',
        resource_type: 'dataset_version',
        resource_id: version_id,
        project_id,
        details: {
          summary: `Dataset version v${version.version_number} submitted for supervisor approval`,
          operation: {
            request_id: newRequest.id,
            assigned_supervisor: assigned_supervisor ?? null,
            message: request_message ?? null,
          },
        },
      },
      supabase
    )

    // 8. Notify supervisor(s)
    const { data: requester } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()

    const notifTitle = 'Dataset ready for review'
    const notifBody = `${requester?.full_name ?? 'A researcher'} has submitted "${dataset.name} v${version.version_number}" for your approval.`
    const notifLink = `/approvals/${newRequest.id}`

    if (assigned_supervisor) {
      await sendNotification(
        assigned_supervisor,
        'approval_requested',
        notifTitle,
        notifBody,
        notifLink,
        { resource_type: 'dataset_approval_request', resource_id: newRequest.id },
        supabase
      )
    } else {
      const { data: proj } = await supabase
        .from('projects')
        .select('workspace_id')
        .eq('id', project_id)
        .single()

      if (proj?.workspace_id) {
        await notifyWorkspaceSupervisors(
          proj.workspace_id,
          'approval_requested',
          notifTitle,
          notifBody,
          notifLink,
          { resource_type: 'dataset_approval_request', resource_id: newRequest.id },
          supabase
        )
      }
    }

    return NextResponse.json({
      request_id: newRequest.id,
      status: 'pending',
      assigned_to: assigned_supervisor ?? null,
      audit_entry_id: auditResult.entry_id ?? null,
    })
  } catch (error) {
    console.error('Approval request error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
