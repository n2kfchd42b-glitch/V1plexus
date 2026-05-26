import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { writeAuditEntry } from '@/lib/audit/auditLogger'
import { sendNotification } from '@/lib/notifications/notificationService'

const DecideSchema = z.object({
  decision: z.enum(['approved', 'revision_requested']),
  feedback: z.string().max(8000).optional(),
})

/**
 * POST /api/thesis/chapters/[chapterId]/decide
 *
 * Supervisor-side action. Closes the open submission with a decision,
 * updates the chapter status accordingly, and notifies the student.
 *
 * Append-only: the freeze trigger on thesis_chapter_submissions rejects
 * any re-decision attempt at the DB level.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ chapterId: string }> },
) {
  const { chapterId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const parsed = DecideSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const { decision, feedback } = parsed.data

  const { data: chapter } = await supabase
    .from('thesis_chapters')
    .select('id, project_id, title, status, current_review_id, revision_round')
    .eq('id', chapterId)
    .maybeSingle()

  if (!chapter) return NextResponse.json({ error: 'Chapter not found' }, { status: 404 })
  if (chapter.status !== 'submitted_for_review') {
    return NextResponse.json({ error: 'Chapter is not currently under review' }, { status: 409 })
  }

  // Find the open submission for this round
  const { data: submission } = await supabase
    .from('thesis_chapter_submissions')
    .select('id, student_id, round, decision')
    .eq('chapter_id', chapterId)
    .eq('round', chapter.revision_round)
    .maybeSingle()

  if (!submission) return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
  if (submission.decision) {
    return NextResponse.json({ error: 'Submission is already closed' }, { status: 409 })
  }

  // Authorisation: caller must be an active supervisor of this student
  const { data: assignment } = await supabase
    .from('supervisor_assignments')
    .select('id, role')
    .eq('supervisor_id', user.id)
    .eq('student_id', submission.student_id)
    .eq('status', 'active')
    .maybeSingle()

  if (!assignment) {
    return NextResponse.json(
      { error: 'Only an active supervisor can review chapters' },
      { status: 403 },
    )
  }

  const reviewedAt = new Date().toISOString()

  // Close the submission (trigger ensures append-only)
  const { error: updateError } = await supabase
    .from('thesis_chapter_submissions')
    .update({
      decision,
      feedback:    feedback ?? null,
      reviewed_by: user.id,
      reviewed_at: reviewedAt,
    })
    .eq('id', submission.id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Update the chapter
  const nextChapterStatus = decision === 'approved' ? 'approved' : 'revision_requested'
  await supabase
    .from('thesis_chapters')
    .update({
      status: nextChapterStatus,
      ...(decision === 'approved'
        ? { approved_at: reviewedAt, approved_by: user.id, current_review_id: null }
        : {}),
    })
    .eq('id', chapterId)

  // Close the underlying review_request if there was one
  if (chapter.current_review_id) {
    await supabase
      .from('review_requests')
      .update({
        status: decision === 'approved' ? 'approved' : 'feedback_given',
        completed_at: reviewedAt,
        feedback_text: feedback ?? null,
      })
      .eq('id', chapter.current_review_id)
  }

  // Notify student
  const serviceClient = createServiceClient()
  const [{ data: studentProfile }, { data: supervisorProfile }] = await Promise.all([
    serviceClient.from('profiles').select('full_name, email').eq('id', submission.student_id).single(),
    serviceClient.from('profiles').select('full_name').eq('id', user.id).single(),
  ])
  const supervisorName = supervisorProfile?.full_name ?? 'Your supervisor'

  await sendNotification(
    submission.student_id,
    decision === 'approved' ? 'chapter_approved' : 'chapter_revision_requested',
    decision === 'approved'
      ? `${supervisorName} approved "${chapter.title}"`
      : `${supervisorName} requested revisions on "${chapter.title}"`,
    decision === 'approved'
      ? 'Chapter approved — great work.'
      : 'Open the chapter to read the feedback and resubmit when ready.',
    `/student/milestones`,
    {
      resource_type: 'thesis_chapter_submission',
      resource_id:   submission.id,
      chapter_id:    chapterId,
      round:         submission.round,
      decision,
    },
    serviceClient,
    studentProfile?.email ?? undefined,
  )

  void writeAuditEntry({
    actor_id: user.id,
    action: 'thesis.chapter.decided',
    resource_type: 'thesis_chapter_submission',
    resource_id: submission.id,
    project_id: chapter.project_id,
    details: {
      summary: `Chapter "${chapter.title}" round ${submission.round}: ${decision}`,
      operation: {
        chapter_id: chapterId,
        round:      submission.round,
        decision,
        has_feedback: !!feedback,
      },
    },
  })

  return NextResponse.json({ success: true, decision, chapter_status: nextChapterStatus })
}
