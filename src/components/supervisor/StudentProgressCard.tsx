"use client"

import { useState, useEffect } from 'react'
import { AlertTriangle, CheckCircle, GraduationCap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import type { SupervisorAssignment, Project } from '@/types/database'

interface StudentProgressCardProps {
  assignment: SupervisorAssignment
}

export function StudentProgressCard({ assignment }: StudentProgressCardProps) {
  const [projects, setProjects] = useState<Project[]>([])
  const [pendingReviews, setPendingReviews] = useState(0)
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: projs } = await supabase
        .from('projects')
        .select('*')
        .eq('owner_id', assignment.student_id)
        .limit(3)
      setProjects(projs ?? [])

      const { count } = await supabase
        .from('review_requests')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_to', assignment.supervisor_id)
        .in('status', ['pending', 'in_review'])
      setPendingReviews(count ?? 0)
    }
    load()
  }, [assignment, supabase])

  const student = assignment.student
  const mainProject = projects[0]

  // Determine status badge
  const getStatus = () => {
    if (!mainProject) return { label: 'No projects', color: 'text-gray-500', bg: 'bg-gray-100', icon: null }
    if (pendingReviews > 0) return {
      label: 'Needs review',
      color: 'text-amber-700',
      bg: 'bg-amber-50',
      icon: <AlertTriangle className="h-3.5 w-3.5" />
    }
    return {
      label: 'On Track',
      color: 'text-green-700',
      bg: 'bg-green-50',
      icon: <CheckCircle className="h-3.5 w-3.5" />
    }
  }

  const status = getStatus()

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-[#1B3A5C] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {student?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) ?? '??'}
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              {student?.full_name ?? 'Unknown'}
            </p>
            {assignment.department && (
              <p className="text-xs text-[var(--text-tertiary)]">
                {assignment.department.name}
              </p>
            )}
          </div>
        </div>
        <span className={cn(
          'flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium flex-shrink-0',
          status.bg, status.color
        )}>
          {status.icon}
          {status.label}
        </span>
      </div>

      {mainProject && (
        <div className="mt-4">
          <p className="text-xs text-[var(--text-tertiary)] mb-1">Current Project</p>
          <p className="text-sm font-medium text-[var(--text-primary)] truncate">
            {mainProject.title}
          </p>
          <p className="text-xs text-[var(--text-tertiary)] mt-0.5 capitalize">
            Phase: {mainProject.phase?.replace('_', ' ') ?? 'Not set'}
          </p>
        </div>
      )}

      {pendingReviews > 0 && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-amber-600">
          <AlertTriangle className="h-3.5 w-3.5" />
          {pendingReviews} pending review{pendingReviews > 1 ? 's' : ''}
        </div>
      )}

      <div className="mt-4 flex gap-2 pt-3 border-t border-[var(--border-default)]">
        <Button size="sm" variant="outline" className="h-7 text-xs flex-1">
          View Projects
        </Button>
        {pendingReviews > 0 && (
          <Button size="sm" className="h-7 text-xs flex-1">
            Review Queue
          </Button>
        )}
      </div>
    </div>
  )
}
