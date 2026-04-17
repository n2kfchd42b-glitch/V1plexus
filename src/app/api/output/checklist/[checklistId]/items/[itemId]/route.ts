import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { hasProjectAccess } from '@/lib/supabase/projectAccess'

/**
 * PATCH /api/output/checklist/[checklistId]/items/[itemId]
 * Authenticated. Proxies to FastAPI PATCH /analytics/output/checklist/{id}/items/{itemId}
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ checklistId: string; itemId: string }> }
) {
  const { checklistId, itemId } = await params

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user has access to this checklist
    const { data: checklist } = await supabase
      .from('reporting_checklists')
      .select('project_id')
      .eq('id', checklistId)
      .single()

    if (!checklist) {
      return NextResponse.json({ error: 'Checklist not found' }, { status: 404 })
    }

    if (!await hasProjectAccess(supabase, checklist.project_id, user.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()

    let analyticsUrl = process.env.ANALYTICS_API_URL || 'http://localhost:8000'
    if (analyticsUrl && !analyticsUrl.startsWith('http')) analyticsUrl = `https://${analyticsUrl}`
    const session = await supabase.auth.getSession()
    const accessToken = session.data.session?.access_token
    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const response = await fetch(
      `${analyticsUrl}/analytics/output/checklist/${checklistId}/items/${itemId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      }
    )

    if (!response.ok) {
      const err = await response.text()
      return NextResponse.json(
        { error: 'Failed to update checklist item', detail: err },
        { status: response.status }
      )
    }

    const result = await response.json()
    return NextResponse.json(result)
  } catch (err) {
    console.error('[PATCH /api/output/checklist/[checklistId]/items/[itemId]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
