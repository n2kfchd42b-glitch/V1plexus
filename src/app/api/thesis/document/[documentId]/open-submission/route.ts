import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/thesis/document/[documentId]/open-submission
 *
 * Lightweight lookup used by the supervisor's document viewer: given a
 * document, is there a chapter pointing at it with a submission that's
 * still awaiting a decision? Returns the submission + chapter title, or
 * `null` when nothing is open.
 *
 * RLS handles authorisation — anyone who can see the chapter submissions
 * can read this. Callers without access get an empty result.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: chapter } = await supabase
    .from('thesis_chapters')
    .select('id, title')
    .eq('document_id', documentId)
    .maybeSingle()

  if (!chapter) return NextResponse.json(null)

  const { data: submission } = await supabase
    .from('thesis_chapter_submissions')
    .select('id, round, submitted_at, decision')
    .eq('chapter_id', chapter.id)
    .is('decision', null)
    .order('round', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!submission) return NextResponse.json(null)

  return NextResponse.json({
    chapter_id:    chapter.id,
    chapter_title: chapter.title,
    round:         submission.round,
    submitted_at:  submission.submitted_at,
  })
}
