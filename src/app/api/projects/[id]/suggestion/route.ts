import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [
    { data: project },
    { count: datasetCount },
    { count: runCount },
    { data: recentLogs },
    { data: phases },
  ] = await Promise.all([
    supabase.from('projects').select('title, status, description').eq('id', id).single(),
    supabase.from('datasets').select('id', { count: 'exact', head: true }).eq('project_id', id).is('deleted_at', null),
    supabase.from('analysis_runs').select('id', { count: 'exact', head: true }).eq('project_id', id).eq('status', 'completed'),
    supabase.from('audit_logs').select('action, timestamp').eq('project_id', id).order('timestamp', { ascending: false }).limit(5),
    supabase.from('project_phases').select('phase_key, completed_at').eq('project_id', id),
  ])

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ suggestion: null, unavailable: true })
  }

  const completedPhases = (phases ?? []).filter(p => p.completed_at).map(p => p.phase_key)
  const recentActions  = (recentLogs ?? []).map(l => l.action).join(', ')

  const context = [
    `Project: "${project.title}"`,
    `Status: ${project.status}`,
    project.description ? `Description: ${project.description}` : null,
    `Datasets: ${datasetCount ?? 0}, Completed analyses: ${runCount ?? 0}`,
    completedPhases.length ? `Completed phases: ${completedPhases.join(', ')}` : 'No phases completed yet',
    recentActions ? `Recent activity: ${recentActions}` : null,
  ].filter(Boolean).join('. ')

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      messages: [
        {
          role: 'user',
          content: `You are an AI research assistant for a scientific research management platform. Based on the following project context, suggest one specific, actionable next step the researcher should take. Be concise — one sentence, starting with a verb. Do not include the project name.\n\nContext: ${context}`,
        },
      ],
    })

    const suggestion = message.content[0].type === 'text' ? message.content[0].text.trim() : null
    return NextResponse.json({ suggestion })
  } catch {
    return NextResponse.json({ suggestion: null, unavailable: true })
  }
}
