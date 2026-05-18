'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { StudentMilestone } from '@/types/database'
import { MilestoneRoadmap } from '@/components/supervisor-student/MilestoneRoadmap'
import { MilestoneSubmitModal } from '@/components/supervisor-student/MilestoneSubmitModal'
import { GraduationCap } from 'lucide-react'

export default function StudentMilestonesPage() {
  const [milestones, setMilestones] = useState<StudentMilestone[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState<StudentMilestone | null>(null)
  const supabase = createClient()

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const res = await fetch(`/api/milestones?student_id=${user.id}`)
    if (res.ok) setMilestones(await res.json())
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
      Loading your research roadmap…
    </div>
  )

  return (
    <div className="px-8 py-6 max-w-4xl mx-auto">
      <div className="mb-8 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
          <GraduationCap className="h-5 w-5 text-[#0052CC]" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">My Research Roadmap</h1>
          <p className="text-sm text-slate-500 mt-0.5">Track your milestones and submit work for supervisor review</p>
        </div>
      </div>

      {milestones.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <GraduationCap className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No milestones assigned yet</p>
          <p className="text-xs mt-1">Your supervisor will set up your research roadmap</p>
        </div>
      ) : (
        <MilestoneRoadmap
          milestones={milestones}
          role="student"
          onSubmit={(m) => setSubmitting(m)}
        />
      )}

      {submitting && (
        <MilestoneSubmitModal
          milestone={submitting}
          onClose={() => setSubmitting(null)}
          onSuccess={() => { setSubmitting(null); load() }}
        />
      )}
    </div>
  )
}
