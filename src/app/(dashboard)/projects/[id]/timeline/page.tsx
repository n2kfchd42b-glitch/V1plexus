import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TimelineVerificationBar } from '@/components/timeline/TimelineVerificationBar'
import { TimelineFeed } from '@/components/timeline/TimelineFeed'
import { TimelinePageHeader } from '@/components/timeline/TimelinePageHeader'

export default async function TimelinePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: project } = await supabase
    .from('projects')
    .select('id, title')
    .eq('id', id)
    .single()
  if (!project) notFound()

  return (
    <div className="page-shell">

      <TimelinePageHeader />

      {/* Verification status bar */}
      <TimelineVerificationBar projectId={id} />

      {/* Feed + context panel */}
      <TimelineFeed projectId={id} />

    </div>
  )
}
