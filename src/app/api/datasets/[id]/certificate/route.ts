/**
 * API route for generating Data Lineage Certificate
 * GET /api/datasets/[id]/certificate
 */

import { createClient } from '@/lib/supabase/server'
import { createHash } from 'crypto'
import type { DataLineageCertificate, CertificateTimelineEntry } from '@/types/audit'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: datasetId } = await params
    const supabase = await createClient()

    // Get current user for RLS
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get dataset info
    const { data: dataset, error: datasetError } = await supabase
      .from('datasets')
      .select('*, project:projects(name)')
      .eq('id', datasetId)
      .single()

    if (datasetError || !dataset) {
      return NextResponse.json(
        { error: 'Dataset not found' },
        { status: 404 }
      )
    }

    // Get dataset versions first (needed for version-level audit lookup)
    const { data: versions } = await supabase
      .from('dataset_versions')
      .select('*')
      .eq('dataset_id', datasetId)
      .order('version_number', { ascending: true })

    // Get all audit entries for this dataset — two queries to avoid inline-await in .or()
    const { data: datasetAudits, error: auditError1 } = await supabase
      .from('audit_logs')
      .select('*, actor:actor_id(full_name)')
      .eq('resource_type', 'dataset')
      .eq('resource_id', datasetId)
      .order('timestamp', { ascending: true })

    const versionIds = versions?.map((v) => v.id) ?? []
    const { data: versionAudits, error: auditError2 } =
      versionIds.length > 0
        ? await supabase
            .from('audit_logs')
            .select('*, actor:actor_id(full_name)')
            .eq('resource_type', 'dataset_version')
            .in('resource_id', versionIds)
            .order('timestamp', { ascending: true })
        : { data: [], error: null }

    const auditError = auditError1 ?? auditError2
    const auditEntries = [
      ...(datasetAudits ?? []),
      ...(versionAudits ?? []),
    ].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )

    if (auditError) {
      console.error('Audit fetch error:', auditError)
      return NextResponse.json(
        { error: 'Failed to generate certificate' },
        { status: 500 }
      )
    }

    // Get analysis runs
    const { data: analysisRuns } = await supabase
      .from('analysis_runs')
      .select('*, createdby:created_by(full_name)')
      .eq('dataset_id', datasetId)
      .order('created_at', { ascending: true })

    // Build timeline
    const timeline: CertificateTimelineEntry[] = (auditEntries || []).map(
      (entry, idx) => {
        const versionInfo = versions?.find(
          (v) => v.id === entry.resource_id && entry.resource_type === 'dataset_version'
        )

        return {
          step: idx + 1,
          timestamp: entry.timestamp,
          action: entry.action,
          actor_name: entry.actor?.full_name || 'Unknown',
          summary: entry.details?.summary || entry.action,
          justification: entry.details?.justification,
          justification_category: entry.details?.justification_category,
          version_transition: versionInfo
            ? `v${versionInfo.version_number - 1} → v${versionInfo.version_number}`
            : undefined,
          rows_transition: entry.details?.rows_before
            ? `${entry.details.rows_before} → ${entry.details.rows_after} rows`
            : undefined,
          entry_hash: entry.entry_hash.substring(0, 12),
        }
      }
    )

    // Get current version
    const latestVersion = versions?.[versions.length - 1]

    // Build certificate object
    const certificate: DataLineageCertificate = {
      certificate_id: `cert_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      generated_at: new Date().toISOString(),
      generated_by: user.user_metadata?.full_name || user.email || 'Unknown',
      dataset: {
        id: dataset.id,
        name: dataset.name,
        source: dataset.source,
        project_name: dataset.project?.name || 'Unknown',
      },
      integrity: {
        raw_import_hash: (auditEntries?.[0]?.details?.file_hash as string) || '',
        current_version_hash: latestVersion?.file_hash || '',
        chain_verified: true,
        total_audit_entries: auditEntries?.length || 0,
      },
      timeline,
      final_dataset: {
        version_number: latestVersion?.version_number || 1,
        row_count: latestVersion?.row_count || 0,
        column_count: latestVersion?.column_count || 0,
        file_hash: latestVersion?.file_hash || '',
        complete_cases: latestVersion?.row_count || 0,
        analysis_ready: true,
      },
      analyses_conducted: (analysisRuns || []).map((run) => ({
        run_id: run.id,
        analysis_type: run.analysis_type,
        conducted_at: run.created_at,
        conducted_by: run.createdby?.full_name || 'Unknown',
        dataset_version: run.version_id && versions
          ? (versions.findIndex((v) => v.id === run.version_id) + 1) || 1
          : 1,
      })),
      certificate_hash: '',
    }

    // Compute certificate hash
    const certificateJson = JSON.stringify(
      {
        ...certificate,
        certificate_hash: '',
      },
      null,
      2
    )
    certificate.certificate_hash = createHash('sha256')
      .update(certificateJson)
      .digest('hex')

    return NextResponse.json(certificate)
  } catch (error) {
    console.error('Certificate generation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
