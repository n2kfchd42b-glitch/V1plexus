import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/thesis/chapters/[chapterId]/history
 *
 * Interleaved chapter history: submissions, document versions, review
 * comments. RLS on each source table enforces visibility — we just stitch.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ chapterId: string }> },
) {
  const { chapterId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: chapter } = await supabase
    .from('thesis_chapters')
    .select('id, project_id, document_id, title')
    .eq('id', chapterId)
    .maybeSingle()

  if (!chapter) return NextResponse.json({ error: 'Chapter not found' }, { status: 404 })

  const [submissionsRes, versionsRes] = await Promise.all([
    supabase
      .from('thesis_chapter_submissions')
      .select(`
        id, round, document_version_number, note, submitted_at,
        decision, feedback, reviewed_at, reviewed_by, review_request_id,
        student:profiles!student_id(full_name),
        reviewer:profiles!reviewed_by(full_name)
      `)
      .eq('chapter_id', chapterId)
      .order('round', { ascending: true }),
    chapter.document_id
      ? supabase
          .from('document_versions')
          .select(`
            id, version_number, change_summary, created_at,
            author:profiles!created_by(full_name)
          `)
          .eq('document_id', chapter.document_id)
          .order('version_number', { ascending: true })
      : Promise.resolve({ data: [] as Array<{ id: string; version_number: number; change_summary: string | null; created_at: string; author: { full_name: string | null } | null }>, error: null }),
  ])

  const submissions = submissionsRes.data ?? []
  const versions = (versionsRes.data ?? []) as Array<{
    id: string
    version_number: number
    change_summary: string | null
    created_at: string
    author: { full_name: string | null } | null
  }>

  // Fetch threaded review comments for every review_request referenced by a submission
  const reviewIds = submissions
    .map(s => s.review_request_id)
    .filter((id): id is string => !!id)

  interface CommentRow {
    id: string
    review_id: string
    content: string
    parent_id: string | null
    created_at: string
    author: { full_name: string | null } | null
  }
  let comments: CommentRow[] = []
  if (reviewIds.length > 0) {
    const { data: commentRows } = await supabase
      .from('review_comments')
      .select(`
        id, review_id, content, parent_id, created_at,
        author:profiles!author_id(full_name)
      `)
      .in('review_id', reviewIds)
      .order('created_at', { ascending: true })
    comments = (commentRows ?? []).map((row: Record<string, unknown>): CommentRow => ({
      id:         row.id as string,
      review_id:  row.review_id as string,
      content:    row.content as string,
      parent_id:  (row.parent_id ?? null) as string | null,
      created_at: row.created_at as string,
      author:     unwrapJoin(row.author as { full_name: string | null } | { full_name: string | null }[] | null),
    }))
  }

  function unwrapJoin<T>(v: T | T[] | null): T | null {
    if (v == null) return null
    return Array.isArray(v) ? (v[0] ?? null) : v
  }

  return NextResponse.json({
    chapter: { id: chapter.id, title: chapter.title, document_id: chapter.document_id },
    submissions,
    versions,
    comments,
  })
}
