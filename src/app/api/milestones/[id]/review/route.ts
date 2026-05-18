import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const ReviewSchema = z.object({
  submission_id: z.string().uuid(),
  decision: z.enum(['approved', 'revision_requested']),
  feedback: z.string().min(1),
})

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

  // Verify supervisor is assigned to this student
  const { data: milestone } = await supabase
    .from('student_milestones')
    .select('id, student_id, status, supervisor_id')
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

  // Write feedback to the submission (immutable after this point)
  const { error: subError } = await supabase
    .from('milestone_submissions')
    .update({
      reviewed_by: user.id,
      reviewed_at: now,
      decision: parsed.data.decision,
      feedback: parsed.data.feedback,
    })
    .eq('id', parsed.data.submission_id)
    .eq('milestone_id', id)

  if (subError) return NextResponse.json({ error: subError.message }, { status: 500 })

  // Update milestone status based on decision
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

  return NextResponse.json({ success: true })
}
