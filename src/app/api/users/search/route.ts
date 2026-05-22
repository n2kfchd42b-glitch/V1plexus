import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/users/search?q={query}&exclude={comma-separated-user-ids}
 * Search platform users by name or email for co-author selection.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') ?? '').trim()
  const excludeParam = searchParams.get('exclude') ?? ''
  const excludeIds = excludeParam ? excludeParam.split(',').filter(Boolean) : []

  if (q.length < 2) {
    return NextResponse.json({ users: [] })
  }

  let query = supabase
    .from('profiles')
    .select('id, full_name, email, avatar_url, title, institution_id')
    .or(`full_name.ilike.%${q}%,email.ilike.%${q}%`)
    .neq('id', user.id)
    .limit(10)

  if (excludeIds.length > 0) {
    query = query.not('id', 'in', `(${excludeIds.join(',')})`)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ users: data ?? [] })
}
