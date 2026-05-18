import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SupervisorDocumentViewer } from '@/components/supervisor-student/SupervisorDocumentViewer'

export default async function SupervisorDocumentPage({
  params,
}: {
  params: Promise<{ id: string; docId: string }>
}) {
  const { id: projectId, docId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Verify supervisor has viewer access to this project
  const { data: member } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member) notFound()

  // Fetch document + project owner (student) in parallel
  const [{ data: doc }, { data: project }] = await Promise.all([
    supabase
      .from('documents')
      .select('id, title, content, project_id')
      .eq('id', docId)
      .eq('project_id', projectId)
      .single(),
    supabase
      .from('projects')
      .select('owner_id')
      .eq('id', projectId)
      .single(),
  ])

  if (!doc || !project) notFound()

  return (
    <SupervisorDocumentViewer
      projectId={projectId}
      docId={docId}
      title={doc.title ?? ''}
      content={doc.content as Record<string, unknown> | null}
      studentId={project.owner_id}
    />
  )
}
