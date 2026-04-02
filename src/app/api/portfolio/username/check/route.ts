/**
 * GET /api/portfolio/username/check
 * Check if a username is available
 * No authentication required
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { UsernameCheckResponse } from '@/types/portfolio'

export async function GET(request: NextRequest) {
  try {
    const username = request.nextUrl.searchParams.get('username')

    if (!username) {
      return NextResponse.json(
        { error: 'Username parameter required' },
        { status: 422 }
      )
    }

    // Validate format
    if (!/^[a-z0-9-]{3,30}$/.test(username.toLowerCase())) {
      return NextResponse.json(
        { error: 'Invalid username format' },
        { status: 422 }
      )
    }

    const supabase = await createClient()

    // Check if username exists (case-insensitive)
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .ilike('username', username)
      .limit(1)
      .single()

    const response: UsernameCheckResponse = {
      available: !existingUser,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error checking username:', error)
    return NextResponse.json(
      { error: 'Failed to check username' },
      { status: 500 }
    )
  }
}
