import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { PhaseIndicator } from '@/components/project/PhaseIndicator'
import { MilestoneTracker } from '@/components/project/MilestoneTracker'
import { Separator } from '@/components/ui/separator'
import { formatDate } from '@/lib/utils'
import type { Tables } from '@/types/database'

interface OverviewPageProps {
  params: Promise<{ id: string }>
}

export default async function ProjectOverviewPage({ params }: OverviewPageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single()

  if (!project) notFound()

  const typedProject = project as Tables<'projects'>
  const isOwner = typedProject.owner_id === user.id

  return (
    <div className="max-w-3xl space-y-8">
      {typedProject.description && (
        <div>
          <h2 className="text-sm font-semibold text-[#A0AEC0] uppercase tracking-wide mb-2">Description</h2>
          <p className="text-[#1A202C] leading-relaxed">{typedProject.description}</p>
        </div>
      )}

      {(typedProject.start_date || typedProject.target_end_date) && (
        <>
          <Separator />
          <div>
            <h2 className="text-sm font-semibold text-[#A0AEC0] uppercase tracking-wide mb-3">Timeline</h2>
            <div className="flex gap-8">
              {typedProject.start_date && (
                <div>
                  <p className="text-xs text-[#718096]">Start date</p>
                  <p className="text-sm font-medium text-[#1A202C]">{formatDate(typedProject.start_date)}</p>
                </div>
              )}
              {typedProject.target_end_date && (
                <div>
                  <p className="text-xs text-[#718096]">Target end date</p>
                  <p className="text-sm font-medium text-[#1A202C]">{formatDate(typedProject.target_end_date)}</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <Separator />

      <div>
        <h2 className="text-sm font-semibold text-[#A0AEC0] uppercase tracking-wide mb-4">Research phase</h2>
        <PhaseIndicator currentPhase={typedProject.phase} />
      </div>

      <Separator />

      <div>
        <h2 className="text-sm font-semibold text-[#A0AEC0] uppercase tracking-wide mb-4">Milestones</h2>
        <MilestoneTracker projectId={id} isOwner={isOwner} />
      </div>
    </div>
  )
}
