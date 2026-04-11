import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/output/package/[packageId]/status
 * Authenticated. Proxies to FastAPI GET /analytics/output/package/{id}/status
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ packageId: string }> }
) {
  const { packageId } = await params

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let analyticsUrl = process.env.ANALYTICS_API_URL || 'http://localhost:8000'
    if (analyticsUrl && !analyticsUrl.startsWith('http')) analyticsUrl = `https://${analyticsUrl}`
    const session = await supabase.auth.getSession()
    const accessToken = session.data.session?.access_token
    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const response = await fetch(
      `${analyticsUrl}/analytics/output/package/${packageId}/status`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    )

    if (!response.ok) {
      const err = await response.text()
      return NextResponse.json(
        { error: 'Failed to get package status', detail: err },
        { status: response.status }
      )
    }

    const result = await response.json()
    return NextResponse.json(result)
  } catch (err) {
    console.error('[GET /api/output/package/[packageId]/status]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
