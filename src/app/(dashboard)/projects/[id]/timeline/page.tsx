import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TimelineVerificationBar } from '@/components/timeline/TimelineVerificationBar'
import { TimelineFeed } from '@/components/timeline/TimelineFeed'

export default async function TimelinePage({
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
    .single()
  if (!project) notFound()

  return (
    <div className="page-shell">

      {/* Page header */}
      <div className="px-6 pt-6 pb-4 flex-shrink-0">
        <h1 className="page-title">Timeline</h1>
        <p className="text-xs text-[var(--text-tertiary)] mt-1">
          Tamper-evident record of every action in this project.
        </p>
      </div>

      {/* Verification status bar */}
      <TimelineVerificationBar projectId={id} />

      {/* Feed + context panel */}
      <TimelineFeed projectId={id} />

    </div>
  )
}
