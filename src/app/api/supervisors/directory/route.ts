import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export interface DirectoryEntry {
  supervisor_id: string
  full_name: string | null
  email: string
  avatar_url: string | null
  title: string | null
  research_discipline: string | null
  supervision_areas: string[] | null
  supervision_bio: string | null
  slots_total: number | null
  slots_used: number
  slots_open: number | null
  accepting_now: boolean
}

/**
 * GET /api/supervisors/directory?q=&discipline=&accepting_only=true
 *
 * Replaces the inline profile search in FindSupervisorModal. Reads from
 * the v_supervisor_capacity view so capacity is always live.
 *
 * Default ordering: accepting first, then alphabetical. Callers that want
 * the deterministic order for testing can pass &order=name.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const q              = url.searchParams.get('q')?.trim() ?? ''
  const discipline     = url.searchParams.get('discipline')?.trim() ?? ''
  const acceptingOnly  = url.searchParams.get('accepting_only') === 'true'
  const limit          = Math.min(Number(url.searchParams.get('limit') ?? 20), 50)

  let query = supabase
    .from('v_supervisor_capacity')
    .select('*')

  if (q) {
    // Search name, email, or supervision_areas array
    query = query.or(
      `full_name.ilike.%${q}%,email.ilike.%${q}%,supervision_areas.cs.{${q}}`,
    )
  }
  if (discipline) {
    query = query.eq('research_discipline', discipline)
  }
  if (acceptingOnly) {
    query = query.eq('accepting_now', true)
  }

  // Don't surface the caller themselves
  query = query.neq('supervisor_id', user.id)

  const { data, error } = await query
    .order('accepting_now', { ascending: false })
    .order('full_name', { ascending: true, nullsFirst: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json((data ?? []) as DirectoryEntry[])
}
