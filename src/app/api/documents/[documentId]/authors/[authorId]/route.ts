import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * PUT /api/documents/[documentId]/authors/[authorId]
 * Update an author's roles and details
 */
export async function PUT(
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
    const body = await req.json()

    // Verify document exists and user has access
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('project_id, created_by')
      .eq('id', documentId)
      .single()

    if (docError || !doc) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }

    // Check authorization
    const { data: owner } = await supabase
      .from('projects')
      .select('owner_id')
      .eq('id', doc.project_id)
      .eq('owner_id', user.id)
      .single()

    if (
      doc.created_by !== user.id &&
      !owner &&
      body.user_id !== user.id
    ) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Update author
    const {
      display_name,
      email,
      orcid,
      institution,
      credit_roles,
      is_corresponding,
      contribution_order,
    } = body

    const { data: updated, error: updateError } = await supabase
      .from('document_author_roles')
      .update({
        ...(display_name && { display_name }),
        ...(email && { email }),
        ...(orcid && { orcid }),
        ...(institution && { institution }),
        ...(credit_roles && { credit_roles }),
        ...(typeof is_corresponding === 'boolean' && {
          is_corresponding,
        }),
        ...(typeof contribution_order === 'number' && {
          contribution_order,
        }),
      })
      .eq('id', authorId)
      .eq('document_id', documentId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating author:', updateError)
      return NextResponse.json(
        { error: 'Failed to update author' },
        { status: 500 }
      )
    }

    return NextResponse.json({ author: updated })
  } catch (error) {
    console.error(
      'PUT /api/documents/[documentId]/authors/[authorId] error:',
      error
    )
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/documents/[documentId]/authors/[authorId]
 * Remove an author from a document
 */
export async function DELETE(
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

    // Verify document access
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('project_id, created_by')
      .eq('id', documentId)
      .single()

    if (docError || !doc) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }

    // Check authorization
    const { data: owner } = await supabase
      .from('projects')
      .select('owner_id')
      .eq('id', doc.project_id)
      .eq('owner_id', user.id)
      .single()

    if (doc.created_by !== user.id && !owner) {
      return NextResponse.json(
        { error: 'Only document owner can remove authors' },
        { status: 403 }
      )
    }

    // Delete author
    const { error: deleteError } = await supabase
      .from('document_author_roles')
      .delete()
      .eq('id', authorId)
      .eq('document_id', documentId)

    if (deleteError) {
      console.error('Error deleting author:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete author' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error(
      'DELETE /api/documents/[documentId]/authors/[authorId] error:',
      error
    )
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
