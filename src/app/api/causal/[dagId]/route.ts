import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/causal/[dagId]
 * Fetch the current state of a DAG record.
 * Polling fallback if Supabase Realtime is unavailable.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ dagId: string }> }
) {
  try {
    const { dagId } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('causal_dags')
      .select('*')
      .eq('id', dagId)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'DAG not found' }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('[GET /api/causal/[dagId]]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
