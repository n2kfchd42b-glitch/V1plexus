import { NextRequest, NextResponse } from 'next/server'
import { getAnalyticsBaseUrl } from '@/lib/analyticsService'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ datasetId: string }> }
) {
  try {
    const { datasetId } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const analyticsUrl = getAnalyticsBaseUrl()
    const session = await supabase.auth.getSession()
    const token = session.data.session?.access_token
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const res = await fetch(`${analyticsUrl}/analytics/timeline/${datasetId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!res.ok) return NextResponse.json({ entries: [] })
    return NextResponse.json(await res.json())
  } catch (error) {
    console.error('[GET /api/analytics/timeline/[datasetId]]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ datasetId: string }> }
) {
  try {
    await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const analyticsUrl = getAnalyticsBaseUrl()
    const session = await supabase.auth.getSession()
    const token = session.data.session?.access_token
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const res = await fetch(`${analyticsUrl}/analytics/timeline/entry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    })

    if (!res.ok) return NextResponse.json({ error: 'Failed to create entry' }, { status: 500 })
    return NextResponse.json(await res.json())
  } catch (error) {
    console.error('[POST /api/analytics/timeline/[datasetId]]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
