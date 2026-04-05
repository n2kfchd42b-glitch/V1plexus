import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('document_analysis_embeds')
    .select('*, analysis_runs(id, title, analysis_type, results, chart_config, interpretation, updated_at)')
    .eq('document_id', documentId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ embeds: data ?? [] })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { analysis_run_id, show_summary = true, show_key_stats = true } = body

  if (!analysis_run_id) return NextResponse.json({ error: 'analysis_run_id required' }, { status: 400 })

  const { data, error } = await supabase
    .from('document_analysis_embeds')
    .insert({
      document_id: documentId,
      analysis_run_id,
      show_summary,
      show_key_stats,
      added_by: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ embed: data })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const embedId = searchParams.get('embedId')
  if (!embedId) return NextResponse.json({ error: 'embedId required' }, { status: 400 })

  const { error } = await supabase
    .from('document_analysis_embeds')
    .delete()
    .eq('id', embedId)
    .eq('document_id', documentId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
