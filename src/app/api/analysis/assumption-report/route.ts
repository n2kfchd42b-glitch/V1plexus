import { NextRequest, NextResponse } from 'next/server'
import { createClient, getAccessTokenFromRequest } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!process.env.ANALYTICS_API_URL) {
      return NextResponse.json({ unavailable: true })
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const accessToken = getAccessTokenFromRequest(request)
    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let analyticsUrl = process.env.ANALYTICS_API_URL
    if (!analyticsUrl.startsWith('http')) analyticsUrl = `https://${analyticsUrl}`

    const fetchPromise = fetch(`${analyticsUrl}/analytics/integrity/assumption-report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ ...body, requested_by: user.id }),
    })

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('assumption-report timeout')), 20000)
    )

    const response = await Promise.race([fetchPromise, timeoutPromise])

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      console.error('[assumption-report] external service error', response.status, errText)
      return NextResponse.json({ unavailable: true })
    }

    const result = await response.json()
    return NextResponse.json(result)
  } catch (error) {
    console.error('[POST /api/analysis/assumption-report]', error)
    return NextResponse.json({ unavailable: true })
  }
}
