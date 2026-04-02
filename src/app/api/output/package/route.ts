import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/output/package
 * Authenticated. Proxies to FastAPI POST /analytics/output/package/generate
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { project_id, dataset_id, version_id, include_components, guideline } = body

    if (!project_id || !dataset_id || !version_id || !include_components || !guideline) {
      return NextResponse.json(
        { error: 'project_id, dataset_id, version_id, include_components, and guideline are required' },
        { status: 400 }
      )
    }

    // Verify project membership
    const { data: member } = await supabase
      .from('project_members')
      .select('id')
      .eq('project_id', project_id)
      .eq('user_id', user.id)
      .single()

    if (!member) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const analyticsUrl = process.env.ANALYTICS_API_URL || 'http://localhost:8000'
    const session = await supabase.auth.getSession()

    const response = await fetch(`${analyticsUrl}/analytics/output/package/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.data.session?.access_token || ''}`,
      },
      body: JSON.stringify({ project_id, dataset_id, version_id, include_components, guideline }),
    })

    if (!response.ok) {
      const err = await response.text()
      return NextResponse.json(
        { error: 'Failed to start package generation', detail: err },
        { status: response.status }
      )
    }

    const result = await response.json()
    return NextResponse.json(result)
  } catch (err) {
    console.error('[POST /api/output/package]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
