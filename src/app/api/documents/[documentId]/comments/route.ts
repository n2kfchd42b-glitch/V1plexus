import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendNotification } from '@/lib/notifications/notificationService'
import { z } from 'zod'

const CreateSchema = z.object({
  content:     z.string().min(1),
  anchor_text: z.string().optional().nullable(),
  parent_id:   z.string().uuid().optional().nullable(),
})

// POST /api/documents/[documentId]/comments
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { documentId } = await params

  const body = await req.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  // Fetch document to get owner + project
  const { data: doc } = await supabase
    .from('documents')
    .select('id, title, project_id, created_by')
    .eq('id', documentId)
    .single()

  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('document_comments')
    .insert({
      document_id: documentId,
      author_id:   user.id,
      content:     parsed.data.content,
      anchor_text: parsed.data.anchor_text ?? null,
      parent_id:   parsed.data.parent_id ?? null,
    })
    .select(`*, author:profiles!author_id(id, full_name, avatar_url)`)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notify document owner if the commenter is someone else
  if (doc.created_by !== user.id) {
    const { data: commenter } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()

    const commenterName = commenter?.full_name ?? 'Someone'
    const anchorSuffix = parsed.data.anchor_text
      ? ` · "${parsed.data.anchor_text.slice(0, 60)}${parsed.data.anchor_text.length > 60 ? '…' : ''}"`
      : ''

    await sendNotification(
      doc.created_by,
      'document_comment',
      `${commenterName} commented on "${doc.title}"`,
      parsed.data.content.slice(0, 100) + (parsed.data.content.length > 100 ? '…' : '') + anchorSuffix,
      `/projects/${doc.project_id}/documents/${documentId}`,
      { resource_type: 'document', resource_id: documentId },
      createServiceClient(),
    )
  }

  return NextResponse.json(data, { status: 201 })
}
