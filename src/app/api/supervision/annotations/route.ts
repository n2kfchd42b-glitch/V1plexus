import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendNotification } from '@/lib/notifications/notificationService'
import { z } from 'zod'

const CreateSchema = z.object({
  student_id:    z.string().uuid(),
  project_id:    z.string().uuid(),
  artifact_type: z.enum(['dataset', 'analysis', 'document']),
  artifact_id:   z.string().uuid(),
  anchor:        z.string().min(1),
  anchor_label:  z.string().optional(),
  content:       z.string().min(1),
})

// GET /api/supervision/annotations
//   ?artifactId=X&artifactType=Y   → annotations for a specific artifact
//   ?studentId=X                   → all annotations for a student (across all artifacts)
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const artifactId   = searchParams.get('artifactId')
  const artifactType = searchParams.get('artifactType')
  const studentId    = searchParams.get('studentId')

  if (!studentId && (!artifactId || !artifactType)) {
    return NextResponse.json(
      { error: 'Provide either studentId, or both artifactId and artifactType' },
      { status: 400 }
    )
  }

  let query = supabase
    .from('supervision_annotations')
    .select(`*, supervisor:profiles!supervisor_id(id, full_name, avatar_url)`)
    .order('created_at', { ascending: true })

  if (studentId) {
    query = query.eq('student_id', studentId)
  } else {
    query = query.eq('artifact_id', artifactId!).eq('artifact_type', artifactType!)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/supervision/annotations
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  // Verify the caller is the supervisor assigned to this student
  const { data: assignment } = await supabase
    .from('supervisor_assignments')
    .select('id')
    .eq('supervisor_id', user.id)
    .eq('student_id', parsed.data.student_id)
    .eq('status', 'active')
    .maybeSingle()

  if (!assignment) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('supervision_annotations')
    .insert({
      supervisor_id: user.id,
      student_id:    parsed.data.student_id,
      project_id:    parsed.data.project_id,
      artifact_type: parsed.data.artifact_type,
      artifact_id:   parsed.data.artifact_id,
      anchor:        parsed.data.anchor,
      anchor_label:  parsed.data.anchor_label ?? null,
      content:       parsed.data.content,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notify the student (non-blocking)
  const artifactLinks: Record<string, string> = {
    dataset:  `/projects/${parsed.data.project_id}/data/${parsed.data.artifact_id}`,
    analysis: `/projects/${parsed.data.project_id}/analysis/${parsed.data.artifact_id}`,
    document: `/projects/${parsed.data.project_id}/documents/${parsed.data.artifact_id}`,
  }
  const artifactLabels: Record<string, string> = {
    dataset:  'your dataset',
    analysis: 'an analysis run',
    document: 'a document',
  }
  const { data: supervisor } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()
  const supervisorName = supervisor?.full_name ?? 'Your supervisor'
  const anchorLabel = parsed.data.anchor_label ?? parsed.data.anchor

  // Use service client so the insert can write to another user's notifications (bypasses RLS)
  await sendNotification(
    parsed.data.student_id,
    'supervisor_note',
    `${supervisorName} left a note`,
    `On ${artifactLabels[parsed.data.artifact_type] ?? 'an artifact'} · ${anchorLabel}`,
    artifactLinks[parsed.data.artifact_type] ?? `/projects/${parsed.data.project_id}`,
    { resource_type: parsed.data.artifact_type, resource_id: parsed.data.artifact_id },
    createServiceClient(),
  )

  return NextResponse.json(data, { status: 201 })
}

// PATCH /api/supervision/annotations — student marks an annotation resolved
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, is_resolved } = await req.json()
  if (!id || typeof is_resolved !== 'boolean') {
    return NextResponse.json({ error: 'id and is_resolved required' }, { status: 400 })
  }

  // Allow update if the caller is the student (recipient) or the supervisor
  const { data: annotation } = await supabase
    .from('supervision_annotations')
    .select('student_id, supervisor_id')
    .eq('id', id)
    .single()

  if (!annotation) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (annotation.student_id !== user.id && annotation.supervisor_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('supervision_annotations')
    .update({ is_resolved })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
