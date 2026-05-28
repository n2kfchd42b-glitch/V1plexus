import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/institution/thesis-policy/overrides
 * Lists every programme-level override row for the caller's institution,
 * with the programme name embedded for the editor UI. The institution
 * default (programme_id IS NULL) is intentionally not included here —
 * it's fetched on its own via GET /api/institution/thesis-policy.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('institution_id')
    .eq('id', user.id)
    .maybeSingle()
  if (!profile?.institution_id) {
    return NextResponse.json({ error: 'No institution' }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('institution_thesis_policy')
    .select(`
      id, institution_id, programme_id, policy_version,
      require_ethics_gate, allow_co_supervisors, max_co_supervisors,
      require_oral_defense, require_proposal_defense, min_chapters,
      default_chapter_titles, reminder_offsets_days, escalation_delay_hours,
      created_at, updated_at,
      programme:institution_programmes(id, name, short_code, degree_level)
    `)
    .eq('institution_id', profile.institution_id)
    .not('programme_id', 'is', null)
    .order('updated_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ overrides: data ?? [] })
}
