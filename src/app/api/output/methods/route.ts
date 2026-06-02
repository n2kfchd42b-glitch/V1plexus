import { NextRequest, NextResponse } from 'next/server'
import { ANALYTICS_ENABLED } from '@/lib/flags'
import { getAnalyticsBaseUrl } from '@/lib/analyticsService'
import { createClient } from '@/lib/supabase/server'
import { hasProjectAccess } from '@/lib/supabase/projectAccess'

/**
 * POST /api/output/methods
 * Authenticated. Proxies to FastAPI POST /analytics/output/methods/generate
 */
export async function POST(request: NextRequest) {
  if (!ANALYTICS_ENABLED) {
    return Response.json({ unavailable: true, error: 'Advanced analytics service is not enabled.' }, { status: 503 })
  }
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { project_id, version_id } = body

    if (!project_id || !version_id) {
      return NextResponse.json(
        { error: 'project_id and version_id are required' },
        { status: 400 }
      )
    }

    if (!await hasProjectAccess(supabase, project_id, user.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const analyticsUrl = getAnalyticsBaseUrl()
    const session = await supabase.auth.getSession()
    const accessToken = session.data.session?.access_token
    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const response = await fetch(`${analyticsUrl}/analytics/output/methods/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ project_id, version_id }),
    })

    if (!response.ok) {
      const err = await response.text()
      return NextResponse.json(
        { error: 'Failed to generate methods statement', detail: err },
        { status: response.status }
      )
    }

    const result = await response.json()
    return NextResponse.json(result)
  } catch (err) {
    console.error('[POST /api/output/methods]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
