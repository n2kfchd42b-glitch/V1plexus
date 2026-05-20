import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendNotification } from '@/lib/notifications/notificationService'
import { writeAuditEntry } from '@/lib/audit/auditLogger'
import { z } from 'zod'

const SubmitSchema = z.object({
  note:            z.string().optional(),
  document_id:     z.string().uuid().nullable().optional(),
  dataset_id:      z.string().uuid().nullable().optional(),
  analysis_run_id: z.string().uuid().nullable().optional(),
})

// POST /api/milestones/[id]/submit — student submits a milestone
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const body = await req.json()
  const parsed = SubmitSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  // Verify milestone belongs to this student
  const { data: milestone, error: milestoneError } = await supabase
    .from('student_milestones')
    .select('id, student_id, supervisor_id, title, project_id, status')
    .eq('id', id)
    .single()

  if (milestoneError || !milestone) return NextResponse.json({ error: 'Milestone not found' }, { status: 404 })
  if (milestone.student_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (milestone.status === 'approved') return NextResponse.json({ error: 'Milestone already approved' }, { status: 409 })
  if (milestone.status === 'submitted' || milestone.status === 'under_review') {
    return NextResponse.json({ error: 'Milestone already submitted and awaiting review' }, { status: 409 })
  }

  // Get next round number
  const { count } = await supabase
    .from('milestone_submissions')
    .select('*', { count: 'exact', head: true })
    .eq('milestone_id', id)

  const round = (count ?? 0) + 1

  // Insert submission (immutable ledger entry)
  const { data: submission, error: subError } = await supabase
    .from('milestone_submissions')
    .insert({
      milestone_id: id,
      student_id: user.id,
      round,
      note:            parsed.data.note            ?? null,
      document_id:     parsed.data.document_id     ?? null,
      dataset_id:      parsed.data.dataset_id      ?? null,
      analysis_run_id: parsed.data.analysis_run_id ?? null,
    })
    .select()
    .single()

  if (subError) return NextResponse.json({ error: subError.message }, { status: 500 })

  // Update milestone status to submitted
  await supabase
    .from('student_milestones')
    .update({ status: 'submitted' })
    .eq('id', id)

  // Notify the supervisor (non-blocking)
  if (milestone.supervisor_id) {
    const { data: studentProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()
    const studentName = studentProfile?.full_name ?? 'A student'
    const projectPath = milestone.project_id
      ? `/supervisor/projects/${milestone.project_id}`
      : `/supervisor/students/${user.id}`

    await sendNotification(
      milestone.supervisor_id,
      'milestone_submitted',
      `${studentName} submitted a milestone`,
      milestone.title,
      projectPath,
      { resource_type: 'milestone', resource_id: id },
      createServiceClient(),
    )
  }

  void writeAuditEntry({
    actor_id:      user.id,
    action:        'milestone.submitted',
    resource_type: 'milestone',
    resource_id:   id,
    project_id:    milestone.project_id ?? undefined,
    details: {
      milestone_title: milestone.title,
      round,
      summary: `Milestone "${milestone.title}" submitted (round ${round})`,
    },
  })

  return NextResponse.json(submission, { status: 201 })
}
