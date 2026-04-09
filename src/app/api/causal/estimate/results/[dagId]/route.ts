import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/causal/estimate/results/[dagId]
 * Fetch all estimation results for a DAG (polling fallback).
 * RLS ensures the user can only see results for their projects.
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
      .from('causal_estimation_results')
      .select('*')
      .eq('dag_id', dagId)

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch results' }, { status: 500 })
    }

    return NextResponse.json({ dagId, results: data ?? [] })
  } catch (error) {
    console.error('[GET /api/causal/estimate/results/[dagId]]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
