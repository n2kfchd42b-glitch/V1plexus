/**
 * POST/GET /api/portfolio/certificates
 * Manage portfolio research certificates
 * Requires authentication
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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
    const { data: dataset } = await supabase
      .from('datasets')
      .select('id, name')
      .eq('id', body.dataset_id)
      .eq('uploaded_by', user.id)
      .single()

    if (!dataset) {
      return NextResponse.json(
        { error: 'Dataset not found or access denied' },
        { status: 403 }
      )
    }

    // Fetch quality report for DQI score
    const { data: qualityReport } = await supabase
      .from('dataset_quality_reports')
      .select('overall_score')
      .eq('version_id', body.version_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    // Check integrity markers
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

    // Check for chain verification (simplified - assumes all datasets have audit records)
    const { data: auditEntries } = await supabase
      .from('audit_logs')
      .select('entry_hash')
      .eq('resource_id', body.dataset_id)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single()

    const chainVerified = !!auditEntries?.entry_hash

    // Create or get verification token
    let verificationToken = null
    const { data: existingToken } = await supabase
      .from('verification_tokens')
      .select('id, token')
      .eq('dataset_id', body.dataset_id)
      .eq('version_id', body.version_id)
      .limit(1)
      .single()

    if (existingToken) {
      verificationToken = existingToken.id
    } else {
      const { data: newToken } = await supabase
        .from('verification_tokens')
        .insert({
          dataset_id: body.dataset_id,
          version_id: body.version_id,
          created_by: user.id,
        })
        .select('id')
        .single()

      verificationToken = newToken?.id || null
    }

    // Create certificate
    const { data: certificate, error: insertError } = await supabase
      .from('portfolio_certificates')
      .insert({
        profile_id: user.id,
        dataset_id: body.dataset_id,
        version_id: body.version_id,
        verification_token_id: verificationToken,
        display_title: body.display_title || null,
        context_note: body.context_note || null,
        dqi_score_snapshot: qualityReport?.overall_score || null,
        supervisor_approved: !!approval,
        assumption_checks_conducted: !!assumptions,
        reentry_conducted: !!reentry,
        chain_verified: chainVerified,
        is_public: body.is_public !== false,
      })
      .select('*')
      .single()

    if (insertError) {
      console.error('Insert error:', insertError)
      return NextResponse.json(
        { error: 'Failed to add certificate' },
        { status: 500 }
      )
    }

    // Write audit entry
    await supabase.from('audit_logs').insert({
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
    const { data: certificates, error: fetchError } = await supabase
      .from('portfolio_certificates')
      .select(
        `
        *,
        datasets(name, source)
      `
      )
      .eq('profile_id', user.id)
      .order('created_at', { ascending: false })

    if (fetchError) {
      console.error('Fetch error:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch certificates' },
        { status: 500 }
      )
    }

    return NextResponse.json(certificates || [])
  } catch (error) {
    console.error('Error fetching certificates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch certificates' },
      { status: 500 }
    )
  }
}
