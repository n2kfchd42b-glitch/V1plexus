/**
 * Badge SVG Route
 * Serves embeddable researcher integrity badges
 * GET /profile/[username]/badge/[variant]
 */

import { NextResponse } from 'next/server'
import { generateBadgeSVG, generateHorizontalBadgeSVG } from '@/lib/portfolio/badgeSvg'
import { createServiceClient } from '@/lib/supabase/service'
import type { BadgeLevel } from '@/types/portfolio'

export const runtime = 'nodejs'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ username: string; variant: string }> }
) {
  try {
    const { username, variant } = await params

    // Validate variant
    if (!['compact', 'horizontal'].includes(variant)) {
      return NextResponse.json(
        { error: 'Invalid badge variant' },
        { status: 400 }
      )
    }

    // Badge is a public endpoint — use service client to bypass RLS
    const supabase = createServiceClient()

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, portfolio_public, avatar_color')
      .ilike('username', username)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Check if portfolio is public
    if (!profile.portfolio_public) {
      return NextResponse.json(
        { error: 'Portfolio is private' },
        { status: 404 }
      )
    }

    // Fetch profile stats to compute integrity level
    const { data: datasets } = await supabase
      .from('datasets')
      .select('id')
      .eq('uploaded_by', profile.id)

    const { data: publications } = await supabase
      .from('portfolio_publications')
      .select('id')
      .eq('profile_id', profile.id)
      .eq('is_public', true)

    const { data: certificates } = await supabase
      .from('portfolio_certificates')
      .select('id, supervisor_approved, assumption_checks_conducted, reentry_conducted, chain_verified')
      .eq('profile_id', profile.id)
      .eq('is_public', true)

    // Compute stats for integrity level determination
    const datasetCount = datasets?.length || 0
    const publicationCount = publications?.length || 0
    const certCount = certificates?.length || 0

    // Simplified integrity level based on publications and activity
    let level: BadgeLevel = 'plexus_emerging'
    if (publicationCount >= 3 || (publicationCount >= 1 && datasetCount >= 5)) {
      level = 'plexus_verified'
    } else if (publicationCount >= 1 || datasetCount >= 2) {
      level = 'plexus_established'
    }

    // Generate appropriate SVG
    const svg =
      variant === 'horizontal'
        ? generateHorizontalBadgeSVG(level, username)
        : generateBadgeSVG(level, username)

    // Return SVG with proper headers
    return new NextResponse(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error('Badge generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate badge' },
      { status: 500 }
    )
  }
}
