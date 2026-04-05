import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { logAudit } from '@/lib/audit'

/**
 * POST /api/documents/[documentId]/versions/[versionId]/restore
 * Restore document to a specific version (creates new version)
 */
export async function POST(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      documentId: string
      versionId: string
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

    const { documentId, versionId } = await params

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

    // Check authorization
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

    // Fetch target version
    const { data: targetVersion, error: fetchError } = await supabase
      .from('document_versions')
      .select('version_number, content')
      .eq('id', versionId)
      .eq('document_id', documentId)
      .single()

    if (fetchError || !targetVersion) {
      return NextResponse.json(
        { error: 'Version not found' },
        { status: 404 }
      )
    }

    // Create new version with restored content
    const nextVersion = (doc.current_version || 0) + 1
    const wordCount = JSON.stringify(targetVersion.content)
      .split(/\s+/)
      .filter(Boolean).length

    const { data: newVersion, error: createError } = await supabase
      .from('document_versions')
      .insert({
        document_id: documentId,
        version_number: nextVersion,
        content: targetVersion.content,
        change_summary: `Restored from v${targetVersion.version_number}`,
        word_count: wordCount,
        created_by: user.id,
        is_auto_save: false,
      })
      .select()
      .single()

    if (createError) {
      console.error('Error creating restore version:', createError)
      return NextResponse.json(
        { error: 'Failed to restore version' },
        { status: 500 }
      )
    }

    // Update document
    await supabase
      .from('documents')
      .update({
        current_version: nextVersion,
        content: targetVersion.content,
      })
      .eq('id', documentId)

    // Audit log
    await logAudit(
      'document.version_restored',
      'document',
      documentId,
      {
        from_version: doc.current_version,
        to_version: nextVersion,
        original_version: targetVersion.version_number,
      },
      doc.project_id
    )

    return NextResponse.json(
      { version: newVersion },
      { status: 201 }
    )
  } catch (error) {
    console.error(
      'POST /api/documents/[documentId]/versions/[versionId]/restore error:',
      error
    )
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
