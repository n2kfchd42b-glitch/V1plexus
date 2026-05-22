import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendNotification } from '@/lib/notifications/notificationService'
import { writeAuditEntry } from '@/lib/audit/auditLogger'
import { z } from 'zod'

const ReviewSchema = z.object({
  submission_id: z.string().uuid(),
  decision: z.enum(['approved', 'revision_requested']),
  feedback: z.string().min(1),
})

// PhaseBar uses 'data'; project_phases Gantt uses 'data_collection'
const MILESTONE_PHASE_TO_GANTT_KEY: Record<string, string> = {
  data: 'data_collection',
}
function toGanttKey(phase: string): string {
  return MILESTONE_PHASE_TO_GANTT_KEY[phase] ?? phase
}

// POST /api/milestones/[id]/review — supervisor reviews the latest submission
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const body = await req.json()
  const parsed = ReviewSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  // Fetch milestone with phase + project_id
  const { data: milestone } = await supabase
    .from('student_milestones')
    .select('id, student_id, status, supervisor_id, phase, project_id')
    .eq('id', id)
    .single()

  if (!milestone) return NextResponse.json({ error: 'Milestone not found' }, { status: 404 })
  if (milestone.status === 'approved') return NextResponse.json({ error: 'Already approved' }, { status: 409 })

  const { count } = await supabase
    .from('supervisor_assignments')
    .select('*', { count: 'exact', head: true })
    .eq('supervisor_id', user.id)
    .eq('student_id', milestone.student_id)
    .eq('status', 'active')

  if (!count || count === 0) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const now = new Date().toISOString()

  // Write feedback to the submission
  const { error: subError } = await supabase
    .from('milestone_submissions')
    .update({
      reviewed_by: user.id,
      reviewed_at: now,
      decision:    parsed.data.decision,
      feedback:    parsed.data.feedback,
    })
    .eq('id', parsed.data.submission_id)
    .eq('milestone_id', id)

  if (subError) return NextResponse.json({ error: subError.message }, { status: 500 })

  // Update milestone status
  const newStatus = parsed.data.decision === 'approved' ? 'approved' : 'revision_requested'
  const milestoneUpdate: Record<string, unknown> = { status: newStatus }
  if (parsed.data.decision === 'approved') {
    milestoneUpdate.approved_by = user.id
    milestoneUpdate.approved_at = now
  }

  await supabase
    .from('student_milestones')
    .update(milestoneUpdate)
    .eq('id', id)

  // ── Phase auto-advance ────────────────────────────────────────────────────
  // When an approval happens and the milestone belongs to a phase+project,
  // check if ALL milestones in that phase are now approved. If yes, mark the
  // project_phases row as complete — this is what drives the Gantt bar forward.
  if (parsed.data.decision === 'approved' && milestone.phase && milestone.project_id) {
    const { data: siblings } = await supabase
      .from('student_milestones')
      .select('id, status')
      .eq('student_id', milestone.student_id)
      .eq('project_id', milestone.project_id)
      .eq('phase', milestone.phase)

    const allApproved = siblings?.every(m =>
      m.id === id ? true : m.status === 'approved'
    ) ?? false

    if (allApproved) {
      const ganttKey = toGanttKey(milestone.phase)
      await supabase
        .from('project_phases')
        .upsert(
          {
            project_id:   milestone.project_id,
            phase_key:    ganttKey,
            completed_at: now,
            updated_at:   now,
          },
          { onConflict: 'project_id,phase_key' }
        )
    }
  }

  // Notify the student of the decision (non-blocking)
  const [{ data: supervisorProfile }, { data: studentProfileForEmail }] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', user.id).single(),
    createServiceClient().from('profiles').select('email').eq('id', milestone.student_id).single(),
  ])
  const supervisorName = supervisorProfile?.full_name ?? 'Your supervisor'

  const notifTitle = parsed.data.decision === 'approved'
    ? `${supervisorName} approved your milestone`
    : `${supervisorName} requested revisions`
  const notifBody = milestone.phase
    ? `${milestone.phase.charAt(0).toUpperCase() + milestone.phase.slice(1)} phase · ${parsed.data.feedback.slice(0, 80)}${parsed.data.feedback.length > 80 ? '…' : ''}`
    : parsed.data.feedback.slice(0, 120)
  const notifLink = milestone.project_id
    ? `/projects/${milestone.project_id}`
    : '/student/milestones'

  await sendNotification(
    milestone.student_id,
    parsed.data.decision === 'approved' ? 'milestone_approved' : 'milestone_revision',
    notifTitle,
    notifBody,
    notifLink,
    { resource_type: 'milestone', resource_id: id },
    createServiceClient(),
    studentProfileForEmail?.email ?? undefined,
  )

  void writeAuditEntry({
    actor_id:      user.id,
    action:        parsed.data.decision === 'approved' ? 'milestone.approved' : 'milestone.revision_requested',
    resource_type: 'milestone',
    resource_id:   id,
    project_id:    milestone.project_id ?? undefined,
    details: {
      decision:       parsed.data.decision,
      feedback:       parsed.data.feedback.slice(0, 200),
      submission_id:  parsed.data.submission_id,
      summary:        `Milestone ${parsed.data.decision === 'approved' ? 'approved' : 'sent for revision'}`,
    },
  })

  return NextResponse.json({ success: true, phaseAdvanced: parsed.data.decision === 'approved' })
}
