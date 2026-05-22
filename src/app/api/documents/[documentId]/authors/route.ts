import { createClient } from '@/lib/supabase/server'
import { hasProjectAccess } from '@/lib/supabase/projectAccess'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/documents/[documentId]/authors
 * List all authors for a document with their roles
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { documentId } = await params

    // Verify document access
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('project_id')
      .eq('id', documentId)
      .single()

    if (docError || !doc) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }

    if (!await hasProjectAccess(supabase, doc.project_id, user.id)) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // Fetch authors
    const { data: authors, error: authorsError } = await supabase
      .from('document_author_roles')
      .select(
        `
        id,
        user_id,
        display_name,
        email,
        orcid,
        institution,
        credit_roles,
        contribution_order,
        is_corresponding,
        confirmed_at,
        created_at
      `
      )
      .eq('document_id', documentId)
      .order('contribution_order', { ascending: true })

    if (authorsError) {
      console.error('Error fetching authors:', authorsError)
      return NextResponse.json(
        { error: 'Failed to fetch authors' },
        { status: 500 }
      )
    }

    return NextResponse.json({ authors: authors || [] })
  } catch (error) {
    console.error('GET /api/documents/[documentId]/authors error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/documents/[documentId]/authors
 * Add a new author to a document
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { documentId } = await params
    const body = await req.json()

    const {
      user_id = null,
      display_name,
      email,
      orcid,
      institution,
      credit_roles = [],
      is_corresponding = false,
    } = body

    if (!display_name) {
      return NextResponse.json(
        { error: 'display_name is required' },
        { status: 400 }
      )
    }

    // Verify document ownership/membership
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

    // Only document creator or project owner can add authors
    const { data: owner } = await supabase
      .from('projects')
      .select('owner_id')
      .eq('id', doc.project_id)
      .eq('owner_id', user.id)
      .single()

    if (doc.created_by !== user.id && !owner) {
      return NextResponse.json(
        { error: 'Only document owner can add authors' },
        { status: 403 }
      )
    }

    // Get max contribution order
    const { data: maxOrder } = await supabase
      .from('document_author_roles')
      .select('contribution_order')
      .eq('document_id', documentId)
      .order('contribution_order', { ascending: false })
      .limit(1)
      .single()

    const nextOrder = (maxOrder?.contribution_order ?? -1) + 1

    // Insert new author
    const { data: newAuthor, error: insertError } = await supabase
      .from('document_author_roles')
      .insert({
        document_id: documentId,
        user_id: user_id || null,
        display_name,
        email,
        orcid,
        institution,
        credit_roles,
        is_corresponding,
        contribution_order: nextOrder,
        added_by: user.id,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error inserting author:', insertError)
      return NextResponse.json(
        { error: 'Failed to add author' },
        { status: 500 }
      )
    }

    return NextResponse.json({ author: newAuthor }, { status: 201 })
  } catch (error) {
    console.error('POST /api/documents/[documentId]/authors error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
