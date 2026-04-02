/**
 * GET /api/approvals/queue
 * Returns the approval queue for the current supervisor.
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { SupervisorQueueItem } from '@/types/approvals'

export async function GET() {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all workspaces where this user is a supervisor
    const { data: supervisorMemberships } = await supabase
      .from('workspace_memberships')
      .select('workspace_id')
      .eq('user_id', user.id)
      .eq('role', 'supervisor')
      .eq('status', 'active')

    const workspaceIds = supervisorMemberships?.map((m) => m.workspace_id) ?? []

    // Get project IDs in those workspaces
    const projectIds: string[] = []
    if (workspaceIds.length > 0) {
      const { data: projects } = await supabase
        .from('projects')
        .select('id')
        .in('workspace_id', workspaceIds)

      projects?.forEach((p) => projectIds.push(p.id))
    }

    if (projectIds.length === 0 && !workspaceIds.length) {
      return NextResponse.json({ queue: [], total: 0, pending: 0, in_review: 0 })
    }

    // Fetch requests: assigned to this user OR unassigned in their projects
    const { data: requests, error: queueError } = await supabase
      .from('dataset_approval_requests')
      .select(`
        id, status, requested_at, request_message,
        dataset:dataset_id(name),
        version:version_id(version_number, row_count, column_count, operations),
        project:project_id(name),
        researcher:requested_by(full_name)
      `)
      .or(
        [
          `assigned_supervisor.eq.${user.id}`,
          projectIds.length > 0
            ? `and(assigned_supervisor.is.null,project_id.in.(${projectIds.join(',')}))`
            : null,
        ]
          .filter(Boolean)
          .join(',')
      )
      .in('status', ['pending', 'in_review', 'revision_requested'])
      .order('requested_at', { ascending: true })

    if (queueError) {
      console.error('Queue fetch error:', queueError)
      return NextResponse.json({ error: 'Failed to fetch queue' }, { status: 500 })
    }

    const now = Date.now()

    const queue: SupervisorQueueItem[] = (requests ?? []).map((r) => {
      const dataset = r.dataset as unknown as { name: string } | null
      const version = r.version as unknown as {
        version_number: number
        row_count: number
        column_count: number
        operations: unknown[]
      } | null
      const project = r.project as unknown as { name: string } | null
      const researcher = r.researcher as unknown as { full_name: string | null } | null
      const ops = (version?.operations ?? []) as Array<{ type?: string }>

      const researcherName = researcher?.full_name ?? 'Unknown'
      const nameParts = researcherName.trim().split(' ')
      const initials = nameParts.map((p) => p[0] ?? '').join('').toUpperCase().slice(0, 2)
      const hoursElapsed = (now - new Date(r.requested_at).getTime()) / 3_600_000

      return {
        request_id: r.id,
        dataset_name: dataset?.name ?? 'Unknown',
        version_number: version?.version_number ?? 1,
        project_name: project?.name ?? 'Unknown',
        researcher_name: researcherName,
        researcher_initials: initials,
        requested_at: r.requested_at,
        request_message: r.request_message,
        status: r.status,
        row_count: version?.row_count ?? 0,
        column_count: version?.column_count ?? 0,
        operations_count: ops.length,
        has_imputation: ops.some((op) => op.type?.includes('impute') || op.type?.includes('mice')),
        has_duplicate_resolution: ops.some((op) => op.type?.includes('duplicate') || op.type?.includes('dedup')),
        audit_entry_count: 0, // enriched below if needed
        hours_since_submission: Math.round(hoursElapsed * 10) / 10,
      }
    })

    const pending = queue.filter((q) => q.status === 'pending').length
    const in_review = queue.filter((q) => q.status === 'in_review').length

    return NextResponse.json({ queue, total: queue.length, pending, in_review })
  } catch (error) {
    console.error('Queue error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
