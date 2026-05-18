import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MinimalEditor } from '@/components/document/MinimalEditor'
import { AnnotationDocumentPanel } from '@/components/supervisor-student/AnnotationDocumentPanel'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

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
    <div className="min-h-screen flex flex-col bg-[var(--bg-canvas)]">
      {/* Top bar */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-10 flex-shrink-0">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center gap-3">
          <Link
            href={`/supervisor/projects/${projectId}`}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to project
          </Link>
          <span className="text-slate-200 select-none">·</span>
          <span className="text-sm font-semibold text-slate-800 truncate">{doc.title || 'Untitled document'}</span>
          <span className="ml-auto text-xs font-medium text-indigo-500 bg-indigo-50 px-2 py-1 rounded-full">
            View only
          </span>
        </div>
      </div>

      {/* Editor — read-only with inline comment capability */}
      <div className="flex-1">
        <MinimalEditor
          documentId={docId}
          projectId={projectId}
          initialTitle={doc.title ?? ''}
          initialContent={doc.content as Record<string, unknown> | null}
          readOnly={true}
          canComment={true}
        />
      </div>

      {/* Annotation panel — supervisor leaves notes that notify the student */}
      <AnnotationDocumentPanel
        documentId={docId}
        projectId={projectId}
        studentId={project.owner_id}
      />
    </div>
  )
}
