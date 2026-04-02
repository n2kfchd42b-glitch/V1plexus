import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { VerificationResponse, VerificationData } from '@/types/researchOutput'

/**
 * GET /api/verify/[token]
 * Public — no authentication required.
 * Validates a PLX-VRF token and returns verified research record data.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  // Use service-role client so unauthenticated requests can read verification_tokens
  const supabase = await createClient()

  try {
    // 1. Look up the token
    const { data: tokenRecord, error } = await supabase
      .from('verification_tokens')
      .select('*')
      .eq('token', token)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (error || !tokenRecord) {
      return NextResponse.json<VerificationResponse>({
        valid: false,
        reason: 'Token not found, expired, or revoked',
      })
    }

    // 2. Increment view_count and update last_viewed_at
    await supabase
      .from('verification_tokens')
      .update({
        view_count: (tokenRecord.view_count ?? 0) + 1,
        last_viewed_at: new Date().toISOString(),
      })
      .eq('id', tokenRecord.id)

    // 3. Fetch resource data based on resource_type
    let data: VerificationData = {}

    if (tokenRecord.resource_type === 'dataset_lineage') {
      // Fetch version
      const { data: version } = await supabase
        .from('dataset_versions')
        .select('*, datasets(name)')
        .eq('id', tokenRecord.resource_id)
        .single()

      if (version) {
        const dataset = version.datasets as { name: string } | null

        // Fetch quality report
        const { data: qualityReports } = await supabase
          .from('data_quality_reports')
          .select('overall_score, dqi_score, readiness_status')
          .eq('version_id', tokenRecord.resource_id)
          .order('created_at', { ascending: false })
          .limit(1)

        const qualityReport = qualityReports?.[0]

        // Fetch audit count
        const { count: opCount } = await supabase
          .from('audit_logs')
          .select('id', { count: 'exact', head: true })
          .eq('resource_id', version.dataset_id)

        // Fetch approval
        const { data: approvals } = await supabase
          .from('approval_gates')
          .select('status')
          .eq('project_id', tokenRecord.project_id)
          .eq('status', 'approved')
          .limit(1)

        const dqiScore = qualityReport?.overall_score ?? qualityReport?.dqi_score
        const dqiDisplay =
          typeof dqiScore === 'number'
            ? dqiScore <= 1
              ? `${Math.round(dqiScore * 100)}%`
              : `${Math.round(dqiScore)}%`
            : undefined

        data = {
          dataset_name: dataset?.name,
          version: `v${version.version_number}`,
          import_date: version.created_at?.slice(0, 10),
          final_n: version.row_count ?? undefined,
          operation_count: opCount ?? undefined,
          chain_verified: true,
          dqi_score: dqiDisplay,
          approved: (approvals?.length ?? 0) > 0,
          certificate_hash_prefix: version.file_hash
            ? version.file_hash.slice(0, 16) + '...'
            : undefined,
        }
      }
    } else if (tokenRecord.resource_type === 'analysis_run') {
      const { data: run } = await supabase
        .from('analysis_runs')
        .select('id, title, analysis_type, created_at, status')
        .eq('id', tokenRecord.resource_id)
        .single()

      if (run) {
        data = {
          dataset_name: run.title,
          import_date: run.created_at?.slice(0, 10),
          chain_verified: true,
        }
      }
    } else if (tokenRecord.resource_type === 'output_package') {
      const { data: pkg } = await supabase
        .from('output_packages')
        .select('id, status, package_hash, generated_at')
        .eq('id', tokenRecord.resource_id)
        .single()

      if (pkg) {
        data = {
          certificate_hash_prefix: pkg.package_hash
            ? pkg.package_hash.slice(0, 16) + '...'
            : undefined,
          import_date: pkg.generated_at?.slice(0, 10),
          chain_verified: pkg.status === 'ready',
        }
      }
    } else if (tokenRecord.resource_type === 'approval') {
      const { data: approval } = await supabase
        .from('approval_gates')
        .select('id, status, approved_at')
        .eq('id', tokenRecord.resource_id)
        .single()

      if (approval) {
        data = {
          approved: approval.status === 'approved',
          import_date: approval.approved_at?.slice(0, 10),
          chain_verified: true,
        }
      }
    }

    return NextResponse.json<VerificationResponse>({
      valid: true,
      token: tokenRecord.token,
      resource_type: tokenRecord.resource_type,
      access_level: tokenRecord.access_level,
      expires_at: tokenRecord.expires_at,
      view_count: (tokenRecord.view_count ?? 0) + 1,
      data,
    })
  } catch (err) {
    console.error('[GET /api/verify/[token]]', err)
    return NextResponse.json<VerificationResponse>({
      valid: false,
      reason: 'An error occurred during verification',
    })
  }
}
