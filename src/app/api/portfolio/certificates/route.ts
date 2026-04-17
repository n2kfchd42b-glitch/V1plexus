/**
 * POST/GET /api/portfolio/certificates
 * Manage portfolio research certificates
 * Requires authentication
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  verifyDatasetAccessWithName,
  getLatestQualityReport,
  getLatestAuditHash,
  getVerificationToken,
  createVerificationToken,
  createCertificate,
  getUserCertificates,
  insertAuditLog,
} from '@/lib/data'
import type { AddCertificateRequest } from '@/types/portfolio'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: AddCertificateRequest = await request.json()

    // Validate required fields
    if (!body.dataset_id || !body.version_id) {
      return NextResponse.json(
        { error: 'Dataset ID and version ID are required' },
        { status: 422 }
      )
    }

    // Verify user can access dataset
    const datasetResult = await verifyDatasetAccessWithName(supabase, body.dataset_id, user.id)

    if (!datasetResult.data) {
      return NextResponse.json(
        { error: 'Dataset not found or access denied' },
        { status: 403 }
      )
    }

    const dataset = datasetResult.data

    // Fetch quality report for DQI score
    const qualityResult = await getLatestQualityReport(supabase, body.version_id)

    // Check integrity markers — these tables are collaboration tier, query directly
    const { data: approval } = await supabase
      .from('dataset_approval_requests')
      .select('id')
      .eq('dataset_id', body.dataset_id)
      .neq('approved_at', null)
      .limit(1)
      .single()

    const { data: assumptions } = await supabase
      .from('analysis_assumption_checks')
      .select('id')
      .eq('version_id', body.version_id)
      .limit(1)
      .single()

    const { data: reentry } = await supabase
      .from('reentry_sessions')
      .select('id')
      .eq('dataset_id', body.dataset_id)
      .eq('status', 'validated')
      .limit(1)
      .single()

    // Check for chain verification
    const auditHashResult = await getLatestAuditHash(supabase, body.dataset_id)
    const chainVerified = !!auditHashResult.data?.entry_hash

    // Create or get verification token
    let verificationToken = null
    const existingTokenResult = await getVerificationToken(supabase, body.dataset_id, body.version_id)

    if (existingTokenResult.data) {
      verificationToken = existingTokenResult.data.id
    } else {
      const newTokenResult = await createVerificationToken(supabase, {
        dataset_id: body.dataset_id,
        version_id: body.version_id,
        created_by: user.id,
      })
      verificationToken = newTokenResult.data?.id || null
    }

    // Create certificate
    const certResult = await createCertificate(supabase, {
      profile_id: user.id,
      dataset_id: body.dataset_id,
      version_id: body.version_id,
      verification_token_id: verificationToken,
      display_title: body.display_title || null,
      context_note: body.context_note || null,
      dqi_score_snapshot: qualityResult.data?.overall_score || null,
      supervisor_approved: !!approval,
      assumption_checks_conducted: !!assumptions,
      reentry_conducted: !!reentry,
      chain_verified: chainVerified,
      is_public: body.is_public !== false,
    })

    if (certResult.status === 'error') {
      console.error('Insert error:', certResult.error)
      return NextResponse.json(
        { error: 'Failed to add certificate' },
        { status: 500 }
      )
    }

    const certificate = certResult.data!

    // Write audit entry
    await insertAuditLog(supabase, {
      actor_id: user.id,
      action: 'portfolio.certificate.added',
      resource_type: 'portfolio_certificate',
      resource_id: certificate.id,
      details: {
        summary: `Research certificate added to portfolio for dataset "${dataset.name}"`,
        operation: {
          certificate_id: certificate.id,
          dataset_id: body.dataset_id,
          version_id: body.version_id,
        },
      },
    })

    return NextResponse.json(certificate, { status: 201 })
  } catch (error) {
    console.error('Error adding certificate:', error)
    return NextResponse.json(
      { error: 'Failed to add certificate' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all certificates for user
    const certsResult = await getUserCertificates(supabase, user.id)

    if (certsResult.status === 'error') {
      console.error('Fetch error:', certsResult.error)
      return NextResponse.json(
        { error: 'Failed to fetch certificates' },
        { status: 500 }
      )
    }

    return NextResponse.json(certsResult.data)
  } catch (error) {
    console.error('Error fetching certificates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch certificates' },
      { status: 500 }
    )
  }
}
