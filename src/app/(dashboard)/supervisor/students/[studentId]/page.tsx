'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { StudentMilestone } from '@/types/database'
import { MilestoneRoadmap } from '@/components/supervisor-student/MilestoneRoadmap'
import { MilestoneReviewModal } from '@/components/supervisor-student/MilestoneReviewModal'
import { AddMilestoneModal } from '@/components/supervisor-student/AddMilestoneModal'
import {
  ArrowLeft, Plus, FolderOpen,
  ChevronRight, Clock, CheckCircle2, AlertCircle,
} from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { cn, formatRelative } from '@/lib/utils'

interface ResearchProject {
  id: string
  title: string
  status: string
  updated_at: string
  datasets: { id: string; name: string; updated_at: string }[]
  analysis_runs: { id: string; analysis_type: string; status: string; created_at: string }[]
  documents: { id: string; title: string; updated_at: string }[]
}

const RUN_STATUS: Record<string, { label: string; color: string }> = {
  completed: { label: 'Done',       color: 'text-emerald-600' },
  running:   { label: 'Running',    color: 'text-blue-600' },
  failed:    { label: 'Failed',     color: 'text-red-500' },
  pending:   { label: 'Pending',    color: 'text-amber-600' },
}

function SectionCard({
  title, icon: Icon, count, href, children, emptyText,
}: {
  title: string
  icon: React.ElementType
  count: number
  href?: string
  children: React.ReactNode
  emptyText: string
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-50">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-slate-400" />
          <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">{title}</span>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">{count}</span>
        </div>
        {href && count > 0 && (
          <Link href={href} className="text-[10px] font-semibold text-indigo-500 hover:text-indigo-700 flex items-center gap-0.5">
            Open all <ChevronRight className="h-3 w-3" />
          </Link>
        )}
      </div>
      {count === 0
        ? <p className="text-xs text-slate-400 italic px-4 py-3">{emptyText}</p>
        : <div className="divide-y divide-slate-50">{children}</div>
      }
    </div>
  )
}

function ResearchPanel({ studentId, projects }: { studentId: string; projects: ResearchProject[] }) {
  if (projects.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 text-center">
        <FolderOpen className="h-8 w-8 text-slate-200 mx-auto mb-2" />
        <p className="text-sm text-slate-400">No shared projects</p>
        <p className="text-xs text-slate-300 mt-0.5 max-w-xs mx-auto">
          The student must share a project with you from their project overview before it appears here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {projects.map(project => (
        <Link key={project.id} href={`/supervisor/projects/${project.id}`}>
          <div className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-slate-100 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all group">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
              <FolderOpen className="h-4 w-4 text-indigo-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-800 truncate group-hover:text-indigo-700 transition-colors">
                {project.title}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">Updated {formatRelative(project.updated_at)}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-400 flex-shrink-0 transition-colors" />
          </div>
        </Link>
      ))}
    </div>
  )
}

export default function StudentDetailPage() {
  const { studentId } = useParams<{ studentId: string }>()
  const [milestones, setMilestones] = useState<StudentMilestone[]>([])
  const [projects, setProjects] = useState<ResearchProject[]>([])
  const [studentProfile, setStudentProfile] = useState<{ full_name: string | null; email: string; title: string | null } | null>(null)
  const [reviewing, setReviewing] = useState<StudentMilestone | null>(null)
  const [addingMilestone, setAddingMilestone] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'milestones' | 'research'>('milestones')
  const supabase = createClient()

  const load = useCallback(async () => {
    const [milestonesRes, profileRes, researchRes] = await Promise.all([
      fetch(`/api/milestones?student_id=${studentId}`),
      supabase.from('profiles').select('full_name, email, title').eq('id', studentId).single(),
      fetch(`/api/supervisor/students/${studentId}/research`),
    ])
    if (milestonesRes.ok) setMilestones(await milestonesRes.json())
    if (profileRes.data) setStudentProfile(profileRes.data)
    if (researchRes.ok) setProjects(await researchRes.json())
    setLoading(false)
  }, [studentId, supabase])

  useEffect(() => { load() }, [load])

  const pendingReview = milestones.filter(m => ['submitted', 'under_review'].includes(m.status)).length
  const approved = milestones.filter(m => m.status === 'approved').length

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Loading…</div>
  )

  return (
    <div className="px-8 py-6 max-w-5xl mx-auto">
      <Link
        href="/supervisor/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to cohort
      </Link>

      {/* Student header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            {studentProfile?.full_name ?? 'Student'}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">{studentProfile?.email}</p>
          {studentProfile?.title && (
            <p className="text-xs text-slate-400 mt-0.5">{studentProfile.title}</p>
          )}
        </div>
        <button
          onClick={() => setAddingMilestone(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0052CC] text-white text-sm font-semibold hover:bg-blue-700 transition-colors flex-shrink-0"
        >
          <Plus className="h-4 w-4" />
          Add Milestone
        </button>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { icon: CheckCircle2, label: 'Approved', value: approved, color: 'text-emerald-500', bg: 'bg-emerald-50' },
          { icon: Clock, label: 'Awaiting review', value: pendingReview, color: 'text-amber-500', bg: 'bg-amber-50' },
          { icon: FolderOpen, label: 'Projects', value: projects.length, color: 'text-indigo-500', bg: 'bg-indigo-50' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3 flex items-center gap-3">
            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', s.bg)}>
              <s.icon className={cn('h-4 w-4', s.color)} />
            </div>
            <div>
              <p className="text-xl font-extrabold text-slate-900 tabular-nums leading-none">{s.value}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-5 border-b border-slate-100">
        {(['milestones', 'research'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2.5 text-sm font-semibold capitalize transition-colors relative',
              activeTab === tab
                ? 'text-indigo-600'
                : 'text-slate-500 hover:text-slate-700'
            )}
          >
            {tab}
            {tab === 'milestones' && pendingReview > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center h-4 w-4 rounded-full bg-amber-500 text-white text-[9px] font-bold">
                {pendingReview}
              </span>
            )}
            {activeTab === tab && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'milestones' && (
        <MilestoneRoadmap
          milestones={milestones}
          role="supervisor"
          onReview={(m) => setReviewing(m)}
        />
      )}

      {activeTab === 'research' && (
        <ResearchPanel studentId={studentId} projects={projects} />
      )}

      {reviewing && (
        <MilestoneReviewModal
          milestone={reviewing}
          onClose={() => setReviewing(null)}
          onSuccess={() => { setReviewing(null); load() }}
        />
      )}

      {addingMilestone && (
        <AddMilestoneModal
          studentId={studentId}
          onClose={() => setAddingMilestone(false)}
          onSuccess={() => { setAddingMilestone(false); load() }}
        />
      )}
    </div>
  )
}
