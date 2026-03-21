import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { TeamManager } from '@/components/project/TeamManager'
import type { Tables } from '@/types/database'

interface TeamPageProps {
  params: Promise<{ id: string }>
}

export default async function ProjectTeamPage({ params }: TeamPageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: project } = await supabase
    .from('projects')
    .select('owner_id')
    .eq('id', id)
    .single()

  if (!project) notFound()

  const typedProject = project as Pick<Tables<'projects'>, 'owner_id'>
  const isOwner = typedProject.owner_id === user.id

  return (
    <div className="max-w-3xl">
      <h2 className="text-sm font-semibold text-[#A0AEC0] uppercase tracking-wide mb-4">Team</h2>
      <TeamManager projectId={id} isOwner={isOwner} currentUserId={user.id} />
    </div>
  )
}
