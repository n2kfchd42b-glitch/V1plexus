import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/documents/[documentId]/authors/[authorId]/confirm
 * Author self-confirms their contribution
 */
export async function POST(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      documentId: string
      authorId: string
    }>
  }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { documentId, authorId } = await params

    // Fetch the author record
    const { data: author, error: fetchError } = await supabase
      .from('document_author_roles')
      .select('user_id, confirmed_at')
      .eq('id', authorId)
      .eq('document_id', documentId)
      .single()

    if (fetchError || !author) {
      return NextResponse.json(
        { error: 'Author not found' },
        { status: 404 }
      )
    }

    // Only the author themselves can confirm (if user_id matches)
    if (author.user_id !== user.id) {
      return NextResponse.json(
        {
          error: 'You can only confirm your own authorship',
        },
        { status: 403 }
      )
    }

    if (author.confirmed_at) {
      return NextResponse.json(
        { error: 'Already confirmed' },
        { status: 400 }
      )
    }

    // Update confirmation
    const { data: updated, error: updateError } = await supabase
      .from('document_author_roles')
      .update({
        confirmed_at: new Date().toISOString(),
      })
      .eq('id', authorId)
      .select()
      .single()

    if (updateError) {
      console.error('Error confirming authorship:', updateError)
      return NextResponse.json(
        { error: 'Failed to confirm authorship' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      author: updated,
    })
  } catch (error) {
    console.error(
      'POST /api/documents/[documentId]/authors/[authorId]/confirm error:',
      error
    )
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
