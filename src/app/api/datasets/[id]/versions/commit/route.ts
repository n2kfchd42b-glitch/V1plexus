/**
 * POST /api/datasets/[id]/versions/commit
 * Create a new dataset version by committing from a source version.
 * Used by the reentry validation flow to promote the reentry version
 * into the main version history.
 *
 * Body:
 *   source_version_id  — version to clone (file_path, schema, row_count etc. are copied)
 *   commit_message     — description of the new version
 *   operations         — array of operation records to attach (optional)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { writeAuditEntry } from '@/lib/audit/auditLogger'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: datasetId } = await params
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { source_version_id, commit_message, operations } = body

    if (!source_version_id || !commit_message) {
      return NextResponse.json(
        { error: 'source_version_id and commit_message are required' },
        { status: 400 }
      )
    }

    // Fetch the source version and dataset project_id in parallel
    const [{ data: sourceVersion, error: sourceError }, { data: dataset }] = await Promise.all([
      supabase.from('dataset_versions').select('*').eq('id', source_version_id).eq('dataset_id', datasetId).single(),
      supabase.from('datasets').select('project_id').eq('id', datasetId).single(),
    ])

    if (sourceError || !sourceVersion) {
      return NextResponse.json({ error: 'Source version not found' }, { status: 404 })
    }

    // Determine next version number for this dataset
    const { data: latestVersion } = await supabase
      .from('dataset_versions')
      .select('version_number')
      .eq('dataset_id', datasetId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextVersionNumber = (latestVersion?.version_number ?? 0) + 1

    // Create the new version record, inheriting data from source
    const { data: newVersion, error: insertError } = await supabase
      .from('dataset_versions')
      .insert({
        dataset_id: datasetId,
        version_number: nextVersionNumber,
        parent_version: source_version_id,
        commit_message,
        file_path: sourceVersion.file_path,
        file_hash: sourceVersion.file_hash,
        file_size: sourceVersion.file_size,
        row_count: sourceVersion.row_count,
        column_count: sourceVersion.column_count,
        schema_info: sourceVersion.schema_info,
        operations: operations ?? [],
        created_by: user.id,
      })
      .select('id, version_number')
      .single()

    if (insertError || !newVersion) {
      console.error('[POST /api/datasets/[id]/versions/commit]', insertError)
      return NextResponse.json({ error: 'Failed to create version' }, { status: 500 })
    }

    // Advance the default branch head to the new version
    await supabase
      .from('dataset_branches')
      .update({ head_version: newVersion.id })
      .eq('dataset_id', datasetId)
      .eq('is_default', true)

    void writeAuditEntry(
      {
        actor_id: user.id,
        action: 'dataset.version.created',
        resource_type: 'dataset_version',
        resource_id: newVersion.id,
        project_id: dataset?.project_id ?? undefined,
        details: {
          summary: `Version ${newVersion.version_number} created: "${commit_message}"`,
          operation: {
            version_id: newVersion.id,
            version_number: newVersion.version_number,
            parent_version_id: source_version_id,
            commit_message,
            row_count: sourceVersion.row_count,
            column_count: sourceVersion.column_count,
          },
        },
      },
      supabase,
    )

    return NextResponse.json({
      id: newVersion.id,
      version_number: newVersion.version_number,
    })
  } catch (err) {
    console.error('[POST /api/datasets/[id]/versions/commit]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
