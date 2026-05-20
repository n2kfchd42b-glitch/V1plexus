import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextRequest, NextResponse } from 'next/server'
import { sendNotification } from '@/lib/notifications/notificationService'

const PHASE_LABELS: Record<string, string> = {
  concept: 'Concept', protocol: 'Protocol', ethics: 'Ethics',
  data_collection: 'Data Collection', analysis: 'Analysis',
  writing: 'Writing', publication: 'Publication',
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify caller owns this project or is a project member
  const { data: project } = await supabase
    .from('projects')
    .select('owner_id')
    .eq('id', id)
    .single()

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (project.owner_id !== user.id) {
    const { data: member } = await supabase
      .from('project_members')
      .select('role')
      .eq('project_id', id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Use service client so RLS doesn't block non-owner members (e.g. supervisors)
  const service = createServiceClient()
  const { data, error } = await service
    .from('project_phases')
    .select('phase_key, name, color, start_date, end_date, completed_at, disabled, sort_order')
    .eq('project_id', id)
    .order('sort_order', { ascending: true })

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
  const { phase_key, name, color, start_date, end_date, completed_at, disabled, sort_order } = body

  if (!phase_key) {
    return NextResponse.json({ error: 'phase_key required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('project_phases')
    .upsert(
      {
        project_id: id,
        phase_key,
        name:         name         ?? null,
        color:        color        ?? null,
        start_date:   start_date   ?? null,
        end_date:     end_date     ?? null,
        completed_at: completed_at ?? null,
        disabled:     disabled     ?? false,
        sort_order:   sort_order   ?? 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'project_id,phase_key' }
    )
    .select('phase_key, name, color, start_date, end_date, completed_at, disabled, sort_order')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notify assigned supervisors when a phase is marked complete
  if (completed_at) {
    try {
      const { data: project } = await supabase
        .from('projects')
        .select('title, owner_id')
        .eq('id', id)
        .single()

      if (project) {
        const { data: assignments } = await supabase
          .from('supervisor_assignments')
          .select('supervisor_id')
          .eq('student_id', project.owner_id)
          .eq('status', 'active')

        const { data: studentProfile } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', project.owner_id)
          .single()

        const studentName = studentProfile?.full_name ?? studentProfile?.email ?? 'Your student'
        const phaseName = PHASE_LABELS[phase_key] ?? phase_key

        await Promise.all(
          (assignments ?? []).map(a =>
            sendNotification(
              a.supervisor_id,
              'gate_approved',
              `${studentName} completed ${phaseName}`,
              `${studentName} has completed the ${phaseName} phase on "${project.title}"`,
              `/supervisor/projects/${id}`,
              { resource_type: 'project', resource_id: id, phase_key },
              supabase
            )
          )
        )
      }
    } catch {
      // Non-blocking — notification failure should not break the response
    }
  }

  return NextResponse.json({ phase: data })
}
