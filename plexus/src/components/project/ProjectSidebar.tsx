'use client'

import Link from 'next/link'
import { Users, Calendar, Clock } from 'lucide-react'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { PhaseIndicator } from './PhaseIndicator'
import { Separator } from '@/components/ui/separator'
import { formatDate, formatDaysRemaining } from '@/lib/utils'
import type { Project } from '@/types/app'

interface ProjectSidebarProps {
  project: Project
  memberCount: number
}

export function ProjectSidebar({ project, memberCount }: ProjectSidebarProps) {
  return (
    <div className="w-60 shrink-0 border-r border-[#E2E8F0] bg-white overflow-y-auto">
      <div className="p-4 space-y-5">
        {/* Status */}
        <div>
          <p className="text-xs font-medium text-[#A0AEC0] uppercase tracking-wide mb-1.5">Status</p>
          <StatusBadge type="status" value={project.status} />
        </div>

        <Separator />

        {/* Stats */}
        <div className="space-y-3">
          <Link
            href={`/projects/${project.id}/team`}
            className="flex items-center gap-2 text-sm text-[#718096] hover:text-[#1A202C] transition-colors"
          >
            <Users className="h-4 w-4" />
            <span>{memberCount} {memberCount === 1 ? 'member' : 'members'}</span>
          </Link>

          {project.start_date && (
            <div className="flex items-center gap-2 text-sm text-[#718096]">
              <Calendar className="h-4 w-4" />
              <span>Started {formatDate(project.start_date)}</span>
            </div>
          )}

          {project.target_end_date && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-[#718096]" />
              <span className={
                (new Date(project.target_end_date) < new Date()) ? 'text-red-600' : 'text-[#718096]'
              }>
                {formatDaysRemaining(project.target_end_date)}
              </span>
            </div>
          )}
        </div>

        <Separator />

        {/* Phase progress */}
        <div>
          <p className="text-xs font-medium text-[#A0AEC0] uppercase tracking-wide mb-3">Phase</p>
          <PhaseIndicator currentPhase={project.phase} compact />
        </div>
      </div>
    </div>
  )
}
