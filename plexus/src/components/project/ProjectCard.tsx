'use client'

import Link from 'next/link'
import { Users, Calendar, ArrowRight } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { formatDate, formatRelativeDate } from '@/lib/utils'
import type { Project } from '@/types/app'

interface ProjectCardProps {
  project: Project
  memberCount?: number
}

export function ProjectCard({ project, memberCount }: ProjectCardProps) {
  return (
    <Link href={`/projects/${project.id}/overview`} className="block group">
      <Card className="h-full hover:shadow-md transition-shadow hover:border-[#2E75B6]">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-[#1A202C] line-clamp-2 group-hover:text-[#2E75B6] transition-colors">
              {project.title}
            </h3>
            <StatusBadge type="phase" value={project.phase} className="shrink-0" />
          </div>
          {project.description && (
            <p className="text-sm text-[#718096] line-clamp-2 mt-1">{project.description}</p>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-xs text-[#718096]">
              {memberCount !== undefined && (
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {memberCount} {memberCount === 1 ? 'member' : 'members'}
                </span>
              )}
              {project.target_end_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatDate(project.target_end_date)}
                </span>
              )}
              {!project.target_end_date && (
                <span className="text-[#A0AEC0]">Updated {formatRelativeDate(project.updated_at)}</span>
              )}
            </div>
            <StatusBadge type="status" value={project.status} />
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
