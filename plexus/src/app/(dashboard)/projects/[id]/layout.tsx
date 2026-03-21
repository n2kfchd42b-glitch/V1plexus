import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { ProjectSidebar } from '@/components/project/ProjectSidebar'
import { ProjectTabBar } from '@/components/project/ProjectTabBar'
import type { Tables } from '@/types/database'

interface ProjectLayoutProps {
  children: React.ReactNode
  params: Promise<{ id: string }>
}

export default async function ProjectLayout({ children, params }: ProjectLayoutProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (!project) notFound()

  const typedProject = project as Tables<'projects'>

  const { count } = await supabase
    .from('project_members')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', id)

  return (
    <div className="-m-6 flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Project title bar */}
      <div className="px-6 py-4 border-b border-[#E2E8F0] bg-white shrink-0">
        <h1 className="text-lg font-semibold text-[#1A202C] truncate">{typedProject.title}</h1>
      </div>

      {/* Tab bar */}
      <ProjectTabBar projectId={id} />

      {/* Body: sidebar + content */}
      <div className="flex flex-1 overflow-hidden">
        <div className="hidden xl:flex">
          <ProjectSidebar project={typedProject} memberCount={count ?? 0} />
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </div>
    </div>
  )
}
