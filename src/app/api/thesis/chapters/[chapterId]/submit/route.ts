import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { writeAuditEntry } from '@/lib/audit/auditLogger'
import { sendNotification } from '@/lib/notifications/notificationService'

const SubmitSchema = z.object({
  note: z.string().max(4000).optional(),
})

/**
 * POST /api/thesis/chapters/[chapterId]/submit
 *
 * Student-side action. Creates a new submission row (round = previous + 1),
 * opens a review_request pointed at the current document version, flips the
 * chapter to submitted_for_review, and notifies the primary supervisor.
 *
 * Idempotency: the (chapter_id, round) unique constraint prevents double
 * submits of the same round, but two clicks in quick succession could each
 * try to insert the same next round. We catch unique-violations and return
 * 409 so the UI can ignore.
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
  const parsed = SubmitSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // Load chapter + document context
  const { data: chapter } = await supabase
    .from('thesis_chapters')
    .select(`
      id, project_id, document_id, status, revision_round, title,
      project:projects!project_id(owner_id)
    `)
    .eq('id', chapterId)
    .maybeSingle()

  if (!chapter) return NextResponse.json({ error: 'Chapter not found' }, { status: 404 })

  const projectJoin = chapter.project as unknown as { owner_id: string } | { owner_id: string }[] | null
  const ownerId = Array.isArray(projectJoin) ? projectJoin[0]?.owner_id : projectJoin?.owner_id
  if (ownerId !== user.id) {
    return NextResponse.json({ error: 'Only the thesis owner can submit chapters' }, { status: 403 })
  }
  if (chapter.status === 'approved' || chapter.status === 'locked') {
    return NextResponse.json({ error: 'Chapter is already approved' }, { status: 409 })
  }
  if (chapter.status === 'submitted_for_review') {
    return NextResponse.json({ error: 'Chapter is already under review' }, { status: 409 })
  }
  if (!chapter.document_id) {
    return NextResponse.json({ error: 'Start writing before submitting for review' }, { status: 400 })
  }

  // Locate the active primary supervisor to assign the review to
  const { data: assignment } = await supabase
    .from('supervisor_assignments')
    .select('supervisor_id')
    .eq('student_id', user.id)
    .eq('role', 'primary')
    .eq('status', 'active')
    .maybeSingle()

  if (!assignment?.supervisor_id) {
    return NextResponse.json(
      { error: 'You need a primary supervisor before you can submit chapters for review' },
      { status: 400 },
    )
  }

  const { data: doc } = await supabase
    .from('documents')
    .select('current_version')
    .eq('id', chapter.document_id)
    .maybeSingle()

  const versionNumber = doc?.current_version ?? 1
  const nextRound = chapter.revision_round + 1

  // Create the review_request first so the submission row can point at it
  const { data: review, error: reviewError } = await supabase
    .from('review_requests')
    .insert({
      document_id: chapter.document_id,
      document_version: versionNumber,
      requested_by: user.id,
      assigned_to: assignment.supervisor_id,
      priority: 'normal',
      status: 'pending',
    })
    .select('id')
    .single()

  if (reviewError || !review) {
    return NextResponse.json({ error: reviewError?.message ?? 'Could not open review' }, { status: 500 })
  }

  // Insert the submission. Unique (chapter_id, round) is the idempotency guard.
  const { data: submission, error: submissionError } = await supabase
    .from('thesis_chapter_submissions')
    .insert({
      chapter_id:              chapterId,
      project_id:              chapter.project_id,
      student_id:              user.id,
      round:                   nextRound,
      document_id:             chapter.document_id,
      document_version_number: versionNumber,
      note:                    parsed.data.note ?? null,
      review_request_id:       review.id,
    })
    .select('*')
    .single()

  if (submissionError) {
    if (submissionError.code === '23505') {
      return NextResponse.json({ error: 'Submission for this round already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: submissionError.message }, { status: 500 })
  }

  // Update the chapter
  const nowIso = new Date().toISOString()
  await supabase
    .from('thesis_chapters')
    .update({
      status:             'submitted_for_review',
      submitted_at:       nowIso,
      revision_round:     nextRound,
      current_review_id:  review.id,
    })
    .eq('id', chapterId)

  // Notify supervisor (non-blocking)
  const serviceClient = createServiceClient()
  const [{ data: supervisorProfile }, { data: studentProfile }] = await Promise.all([
    serviceClient.from('profiles').select('full_name, email').eq('id', assignment.supervisor_id).single(),
    serviceClient.from('profiles').select('full_name').eq('id', user.id).single(),
  ])
  await sendNotification(
    assignment.supervisor_id,
    'chapter_submitted',
    `New chapter submission: ${chapter.title}`,
    `${studentProfile?.full_name ?? 'A student'} submitted chapter "${chapter.title}" (round ${nextRound}) for your review.`,
    `/supervisor/projects/${chapter.project_id}/documents/${chapter.document_id}`,
    {
      resource_type: 'thesis_chapter_submission',
      resource_id:   submission.id,
      chapter_id:    chapterId,
      round:         nextRound,
    },
    serviceClient,
    supervisorProfile?.email ?? undefined,
  )

  void writeAuditEntry({
    actor_id: user.id,
    action: 'thesis.chapter.submitted',
    resource_type: 'thesis_chapter_submission',
    resource_id: submission.id,
    project_id: chapter.project_id,
    details: {
      summary: `Chapter "${chapter.title}" submitted (round ${nextRound})`,
      operation: {
        chapter_id: chapterId,
        round:      nextRound,
        document_version: versionNumber,
        review_request_id: review.id,
      },
    },
  })

  return NextResponse.json({ success: true, submission, review_id: review.id, round: nextRound })
}
