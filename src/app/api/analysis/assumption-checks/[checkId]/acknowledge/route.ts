import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { hasProjectAccess } from '@/lib/supabase/projectAccess'

/**
 * POST /api/analysis/assumption-checks/[checkId]/acknowledge
 * Researcher acknowledges assumption violations
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ checkId: string }> }
) {
  try {
    const { checkId } = await params
    const body = await request.json()
    const { acknowledgement_notes } = body

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch check record to verify access
    const { data: checkRecord } = await supabase
      .from('analysis_assumption_checks')
      .select('*')
      .eq('id', checkId)
      .single()

    if (!checkRecord) {
      return NextResponse.json(
        { error: 'Check record not found' },
        { status: 404 }
      )
    }

    // Verify user can access this project
    if (!await hasProjectAccess(supabase, checkRecord.project_id, user.id) && checkRecord.requested_by !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Call FastAPI endpoint
    let analyticsUrl = process.env.ANALYTICS_API_URL || 'http://localhost:8000'
    if (analyticsUrl && !analyticsUrl.startsWith('http')) analyticsUrl = `https://${analyticsUrl}`
    const session = await supabase.auth.getSession()
    const accessToken = session.data.session?.access_token
    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const response = await fetch(
      `${analyticsUrl}/analytics/integrity/assumption-checks/${checkId}/acknowledge`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          acknowledged_by: user.id,
          acknowledgement_notes,
        }),
      }
    )

    if (!response.ok) {
      const error = await response.json()
      return NextResponse.json(error, { status: response.status })
    }

    const result = await response.json()
    return NextResponse.json(result)
  } catch (error) {
    console.error('[POST /api/analysis/assumption-checks/[checkId]/acknowledge]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
