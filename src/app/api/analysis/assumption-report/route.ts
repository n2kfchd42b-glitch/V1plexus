import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!process.env.ANALYTICS_API_URL) {
      return NextResponse.json({ unavailable: true })
    }

    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user || !session.access_token) {
      // Fall back gracefully — client uses deterministic path
      return NextResponse.json({ unavailable: true })
    }

    let analyticsUrl = process.env.ANALYTICS_API_URL
    if (!analyticsUrl.startsWith('http')) analyticsUrl = `https://${analyticsUrl}`

    const fetchPromise = fetch(`${analyticsUrl}/analytics/integrity/assumption-report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ ...body, requested_by: session.user.id }),
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
