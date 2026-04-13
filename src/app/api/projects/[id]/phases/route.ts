import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('project_phases')
    .select('phase_key, start_date, end_date, completed_at')
    .eq('project_id', id)
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ phases: data ?? [] })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { phase_key, start_date, end_date, completed_at } = body

  if (!phase_key) {
    return NextResponse.json({ error: 'phase_key required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('project_phases')
    .upsert(
      {
        project_id: id,
        phase_key,
        start_date: start_date ?? null,
        end_date: end_date ?? null,
        completed_at: completed_at ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'project_id,phase_key' }
    )
    .select('phase_key, start_date, end_date, completed_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ phase: data })
}
