import { NextRequest, NextResponse } from 'next/server'
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

    const analyticsUrl = process.env.ANALYTICS_API_URL || 'http://localhost:8000'
    const session = await supabase.auth.getSession()
    const token = session.data.session?.access_token
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const res = await fetch(`${analyticsUrl}/analytics/portrait/${datasetId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!res.ok) return NextResponse.json({ portrait: null })
    return NextResponse.json(await res.json())
  } catch (error) {
    console.error('[GET /api/analytics/portrait/[datasetId]]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
