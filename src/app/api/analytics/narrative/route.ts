import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const analyticsUrl = process.env.ANALYTICS_API_URL || 'http://localhost:8000'
    const session = await supabase.auth.getSession()
    const token = session.data.session?.access_token
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const res = await fetch(`${analyticsUrl}/analytics/intelligence/narrative`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[POST /api/analytics/narrative]', err)
      return NextResponse.json({ error: 'Failed to generate narrative' }, { status: 500 })
    }

    return NextResponse.json(await res.json())
  } catch (error) {
    console.error('[POST /api/analytics/narrative]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
