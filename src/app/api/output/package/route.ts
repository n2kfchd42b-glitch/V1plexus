import { NextRequest, NextResponse } from 'next/server'
import { getAnalyticsBaseUrl } from '@/lib/analyticsService'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { hasProjectAccess } from '@/lib/supabase/projectAccess'

/**
 * GET /api/output/package?version_id=...
 * List existing packages for a version (service client bypasses RLS for owners).
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const versionId = request.nextUrl.searchParams.get('version_id')
    if (!versionId) return NextResponse.json({ error: 'version_id required' }, { status: 400 })

    const service = createServiceClient()
    const { data, error } = await service
      .from('output_packages')
      .select('*')
      .eq('version_id', versionId)
      .order('created_at', { ascending: false })
      .limit(5)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // All packages share the same project; verify access once then return all or none.
    const packages = data ?? []
    if (packages.length > 0) {
      const allowed = await hasProjectAccess(supabase, packages[0].project_id, user.id)
      if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.json(packages)
  } catch (err) {
    console.error('[GET /api/output/package]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

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

    // Verify project access (owner or member)
    const { data: project } = await supabase
      .from('projects')
      .select('owner_id')
      .eq('id', project_id)
      .single()

    if (project?.owner_id !== user.id) {
      const { data: member } = await supabase
        .from('project_members')
        .select('id')
        .eq('project_id', project_id)
        .eq('user_id', user.id)
        .single()
      if (!member) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const analyticsUrl = getAnalyticsBaseUrl()
    const session = await supabase.auth.getSession()
    const accessToken = session.data.session?.access_token
    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const response = await fetch(`${analyticsUrl}/analytics/output/package/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
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
