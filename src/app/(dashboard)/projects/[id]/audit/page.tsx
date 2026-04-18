import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProjectAuditLedger } from '@/components/audit/ProjectAuditLedger'

export default async function ProjectAuditPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { data: project } = await supabase
    .from('projects')
    .select('id, title')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (!project) notFound()

  return (
    <div className="min-h-screen bg-[#f7f9fb] p-8">
      <div className="max-w-5xl mx-auto">
        <ProjectAuditLedger projectId={project.id} projectTitle={project.title} />
      </div>
    </div>
  )
}
