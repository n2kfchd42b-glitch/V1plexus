import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { logAudit } from '@/lib/audit'

/**
 * GET /api/documents/[documentId]/versions
 * List all versions for a document
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
    const { searchParams } = new URL(req.url)
    const includeAutoSave =
      searchParams.get('includeAutoSave') === 'true'

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

    // Check project membership
    const { data: member } = await supabase
      .from('project_members')
      .select('user_id')
      .eq('project_id', doc.project_id)
      .eq('user_id', user.id)
      .single()

    const { data: owner } = await supabase
      .from('projects')
      .select('owner_id')
      .eq('id', doc.project_id)
      .eq('owner_id', user.id)
      .single()

    if (!member && !owner) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // Fetch versions
    let query = supabase
      .from('document_versions')
      .select(
        `
        id,
        version_number,
        label,
        change_summary,
        is_auto_save,
        created_at,
        word_count,
        created_by:profiles(id, full_name)
      `
      )
      .eq('document_id', documentId)
      .order('version_number', { ascending: false })

    if (!includeAutoSave) {
      query = query.eq('is_auto_save', false)
    }

    const { data: versions, error: versionsError } = await query

    if (versionsError) {
      console.error('Error fetching versions:', versionsError)
      return NextResponse.json(
        { error: 'Failed to fetch versions' },
        { status: 500 }
      )
    }

    return NextResponse.json({ versions: versions || [] })
  } catch (error) {
    console.error(
      'GET /api/documents/[documentId]/versions error:',
      error
    )
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/documents/[documentId]/versions
 * Create a new named version snapshot
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
      content,
      label,
      change_summary,
    } = body

    if (!content) {
      return NextResponse.json(
        { error: 'content is required' },
        { status: 400 }
      )
    }

    // Verify document access
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('project_id, current_version')
      .eq('id', documentId)
      .single()

    if (docError || !doc) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }

    // Check authorization (only project members/owner)
    const { data: member } = await supabase
      .from('project_members')
      .select('user_id')
      .eq('project_id', doc.project_id)
      .eq('user_id', user.id)
      .single()

    const { data: owner } = await supabase
      .from('projects')
      .select('owner_id')
      .eq('id', doc.project_id)
      .eq('owner_id', user.id)
      .single()

    if (!member && !owner) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // Calculate word count
    const wordCount = JSON.stringify(content)
      .split(/\s+/)
      .filter(Boolean).length

    // Create new version
    const nextVersion = (doc.current_version || 0) + 1

    const { data: newVersion, error: insertError } = await supabase
      .from('document_versions')
      .insert({
        document_id: documentId,
        version_number: nextVersion,
        content,
        label: label || null,
        change_summary: change_summary || null,
        word_count: wordCount,
        created_by: user.id,
        is_auto_save: false,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creating version:', insertError)
      return NextResponse.json(
        { error: 'Failed to create version' },
        { status: 500 }
      )
    }

    // Update document's current_version
    await supabase
      .from('documents')
      .update({ current_version: nextVersion })
      .eq('id', documentId)

    // Audit log
    await logAudit(
      'document.version_saved',
      'document',
      documentId,
      {
        version_number: nextVersion,
        label,
        change_summary,
      },
      doc.project_id
    )

    return NextResponse.json({ version: newVersion }, { status: 201 })
  } catch (error) {
    console.error(
      'POST /api/documents/[documentId]/versions error:',
      error
    )
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
