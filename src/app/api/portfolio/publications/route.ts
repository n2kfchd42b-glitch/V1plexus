/**
 * POST/GET /api/portfolio/publications
 * Manage portfolio publications
 * Requires authentication for POST
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { AddPublicationRequest, CrossRefWork } from '@/types/portfolio'

async function fetchCrossRefMetadata(doi: string): Promise<Partial<AddPublicationRequest> | null> {
  try {
    const response = await fetch(
      `https://api.crossref.org/works/${encodeURIComponent(doi)}`,
      { headers: { 'User-Agent': 'PLEXUS Research Platform' } }
    )

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    const work: CrossRefWork = data.message

    return {
      title: work.title?.[0] || undefined,
      journal: work.container_title,
      year: work.published_online?.date_parts?.[0]?.[0] ||
           work.published_print?.date_parts?.[0]?.[0] ||
           undefined,
      authors: work.author
        ?.map((a) => `${a.given || ''} ${a.family}`.trim())
        .filter(Boolean) || undefined,
      abstract: work.abstract,
      doi: work.doi || undefined,
    }
  } catch (error) {
    console.error('CrossRef API error:', error)
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: AddPublicationRequest = await request.json()

    // Validate required fields
    if (!body.title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 422 }
      )
    }

    // Try to fetch CrossRef metadata if DOI provided
    let crossRefData: Partial<AddPublicationRequest> | null = null
    if (body.doi) {
      crossRefData = await fetchCrossRefMetadata(body.doi)
    }

    // Merge with provided data (provided data takes precedence)
    const publicationData = {
      title: body.title,
      journal: body.journal || crossRefData?.journal || null,
      year: body.year || crossRefData?.year || null,
      doi: body.doi || null,
      authors: body.authors || crossRefData?.authors || [],
      abstract: body.abstract || crossRefData?.abstract || null,
      study_type: body.study_type || null,
      study_population: body.study_population || null,
      sample_size: body.sample_size || null,
      reporting_guideline: body.reporting_guideline || null,
      is_public: body.is_public !== false,
      profile_id: user.id,
    }

    // If dataset provided, fetch DQI and integrity markers
    let dqiScore = null
    let supervised = false
    let assumptionChecks = false
    let reentryValidated = false

    if (body.dataset_id && body.version_id) {
      // Verify user can access dataset
      const { data: dataset } = await supabase
        .from('datasets')
        .select('id')
        .eq('id', body.dataset_id)
        .eq('uploaded_by', user.id)
        .single()

      if (!dataset) {
        return NextResponse.json(
          { error: 'Dataset not found or access denied' },
          { status: 403 }
        )
      }

      // Fetch DQI score
      const { data: qualityReport } = await supabase
        .from('dataset_quality_reports')
        .select('overall_score')
        .eq('version_id', body.version_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (qualityReport) {
        dqiScore = qualityReport.overall_score
      }

      // Check for supervisor approval
      const { data: approval } = await supabase
        .from('dataset_approval_requests')
        .select('approved_at')
        .eq('dataset_id', body.dataset_id)
        .not('approved_at', 'is', null)
        .limit(1)
        .single()

      if (approval) {
        supervised = true
      }

      // Check for assumption checks
      const { data: assumptions } = await supabase
        .from('analysis_assumption_checks')
        .select('id')
        .eq('version_id', body.version_id)
        .limit(1)
        .single()

      if (assumptions) {
        assumptionChecks = true
      }

      // Check for re-entry sessions
      const { data: reentry } = await supabase
        .from('reentry_sessions')
        .select('id')
        .eq('dataset_id', body.dataset_id)
        .eq('status', 'validated')
        .limit(1)
        .single()

      if (reentry) {
        reentryValidated = true
      }
    }

    // Create publication record
    const { data: publication, error: insertError } = await supabase
      .from('portfolio_publications')
      .insert({
        ...publicationData,
        dataset_id: body.dataset_id || null,
        version_id: body.version_id || null,
        dqi_score: dqiScore,
        supervisor_approved: supervised,
        assumption_checks_conducted: assumptionChecks,
        reentry_conducted: reentryValidated,
      })
      .select('*')
      .single()

    if (insertError) {
      console.error('Insert error:', insertError)
      return NextResponse.json(
        { error: 'Failed to add publication' },
        { status: 500 }
      )
    }

    // Write audit entry
    await supabase.from('audit_logs').insert({
      actor_id: user.id,
      action: 'portfolio.publication.added',
      resource_type: 'portfolio_publication',
      resource_id: publication.id,
      details: {
        summary: `Publication added to portfolio: "${publication.title}"`,
        operation: {
          publication_id: publication.id,
          title: publication.title,
          doi: publication.doi,
        },
      },
    })

    return NextResponse.json(publication, { status: 201 })
  } catch (error) {
    console.error('Error adding publication:', error)
    return NextResponse.json(
      { error: 'Failed to add publication' },
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

    // Fetch all publications for user
    const { data: publications, error: fetchError } = await supabase
      .from('portfolio_publications')
      .select('*')
      .eq('profile_id', user.id)
      .order('year', { ascending: false })

    if (fetchError) {
      console.error('Fetch error:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch publications' },
        { status: 500 }
      )
    }

    return NextResponse.json(publications)
  } catch (error) {
    console.error('Error fetching publications:', error)
    return NextResponse.json(
      { error: 'Failed to fetch publications' },
      { status: 500 }
    )
  }
}
