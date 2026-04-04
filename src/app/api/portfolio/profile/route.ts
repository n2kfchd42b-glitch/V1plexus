/**
 * PATCH /api/portfolio/profile
 * Update authenticated user's profile settings
 * Requires authentication
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { UpdateProfileRequest } from '@/types/portfolio'

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: UpdateProfileRequest = await request.json()

    // Validate username if provided
    if (body.username) {
      const username = body.username.toLowerCase()

      // Validate format: 3-30 chars, alphanumeric and hyphens
      if (!/^[a-z0-9-]{3,30}$/.test(username)) {
        return NextResponse.json(
          { error: 'Username must be 3-30 characters, alphanumeric and hyphens only' },
          { status: 422 }
        )
      }

      // Check if already taken by another user
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .ilike('username', username)
        .neq('id', user.id)
        .single()

      if (existingUser) {
        return NextResponse.json(
          { error: 'Username already taken' },
          { status: 422 }
        )
      }
    }

    // Validate optional fields
    if (body.bio && body.bio.length > 500) {
      return NextResponse.json(
        { error: 'Bio must be 500 characters or less' },
        { status: 422 }
      )
    }

    if (body.portfolio_headline && body.portfolio_headline.length > 120) {
      return NextResponse.json(
        { error: 'Portfolio headline must be 120 characters or less' },
        { status: 422 }
      )
    }

    if (body.orcid_id) {
      // Validate ORCID format: XXXX-XXXX-XXXX-XXXC
      if (
        !/^\d{4}-\d{4}-\d{4}-\d{3}[0-9X]$/.test(body.orcid_id)
      ) {
        return NextResponse.json(
          { error: 'Invalid ORCID format' },
          { status: 422 }
        )
      }
    }

    // Validate research_areas count
    if (body.research_areas && body.research_areas.length > 8) {
      return NextResponse.json(
        { error: 'Maximum 8 research areas allowed' },
        { status: 422 }
      )
    }

    // Build update object
    const updateData: Record<string, any> = {}

    if (body.username !== undefined) {
      updateData.username = body.username.toLowerCase()
    }
    if (body.bio !== undefined) {
      updateData.bio = body.bio || null
    }
    if (body.institution !== undefined) {
      updateData.institution = body.institution || null
    }
    if (body.role !== undefined) {
      updateData.role = body.role || null
    }
    if (body.research_areas !== undefined) {
      updateData.research_areas = body.research_areas || []
    }
    if (body.orcid_id !== undefined) {
      updateData.orcid_id = body.orcid_id || null
    }
    if (body.google_scholar_url !== undefined) {
      updateData.google_scholar_url = body.google_scholar_url || null
    }
    if (body.researchgate_url !== undefined) {
      updateData.researchgate_url = body.researchgate_url || null
    }
    if (body.personal_website !== undefined) {
      updateData.personal_website = body.personal_website || null
    }
    if (body.portfolio_headline !== undefined) {
      updateData.portfolio_headline = body.portfolio_headline || null
    }
    if (body.portfolio_public !== undefined) {
      updateData.portfolio_public = body.portfolio_public
    }

    // Update profile
    const { data: updatedProfile, error: updateError } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', user.id)
      .select('*')
      .single()

    if (updateError) {
      console.error('Update error:', updateError)
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      )
    }

    // Write audit entry — non-blocking, must not fail the save
    try {
      await supabase.from('audit_logs').insert({
        actor_id: user.id,
        action: 'profile.updated',
        resource_type: 'profile',
        resource_id: user.id,
        entry_hash: crypto.randomUUID(),
        details: {
          summary: 'Researcher portfolio profile updated',
          operation: {
            fields_updated: Object.keys(updateData),
          },
        },
      })
    } catch {
      // audit log failure must never block the save
    }

    return NextResponse.json(updatedProfile)
  } catch (error) {
    console.error('Error updating profile:', error)
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    )
  }
}
