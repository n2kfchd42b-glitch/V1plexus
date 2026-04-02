/**
 * GET /api/portfolio/[username]
 * Fetch public portfolio data for a researcher
 * No authentication required
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchPortfolioData } from '@/lib/portfolio/portfolioService'

export const revalidate = 3600 // ISR: revalidate every hour

export async function GET(
  request: NextRequest,
  { params }: { params: { username: string } }
) {
  try {
    const username = params.username.toLowerCase()

    const supabase = await createClient()

    // Get current user if authenticated
    const { data: { user } } = await supabase.auth.getUser()

    // Fetch portfolio data
    const portfolioData = await fetchPortfolioData(
      username,
      user?.id ?? null,
      supabase
    )

    if (!portfolioData) {
      return NextResponse.json(
        { error: 'Portfolio not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(portfolioData)
  } catch (error) {
    console.error('Error fetching portfolio:', error)
    return NextResponse.json(
      { error: 'Failed to fetch portfolio' },
      { status: 500 }
    )
  }
}
