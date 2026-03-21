'use client'

import Link from 'next/link'
import { FolderOpen } from 'lucide-react'
import { useUser } from '@/hooks/useUser'
import { useProjects } from '@/hooks/useProjects'
import { RecentProjects } from '@/components/dashboard/RecentProjects'
import { QuickActions } from '@/components/dashboard/QuickActions'
import { ActionItems } from '@/components/dashboard/ActionItems'
import { EmptyState } from '@/components/shared/EmptyState'
import { DashboardSkeleton } from '@/components/shared/SkeletonLoader'
import { useRouter } from 'next/navigation'

export default function DashboardPage() {
  const { profile, loading: profileLoading } = useUser()
  const { projects, loading: projectsLoading } = useProjects()
  const router = useRouter()

  if (profileLoading || projectsLoading) {
    return <DashboardSkeleton />
  }

  const firstName = profile?.full_name.split(' ')[0] ?? 'Researcher'

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-[#1A202C]">Welcome back, {firstName}</h1>
        <p className="text-[#718096] mt-1">Here&apos;s what&apos;s happening with your research</p>
      </div>

      {/* Action items */}
      <ActionItems projects={projects} />

      {/* Quick actions */}
      <div>
        <h2 className="text-sm font-semibold text-[#A0AEC0] uppercase tracking-wide mb-3">
          Quick actions
        </h2>
        <QuickActions />
      </div>

      {/* Recent projects */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[#1A202C]">My projects</h2>
          {projects.length > 6 && (
            <Link href="/projects" className="text-sm text-[#2E75B6] hover:underline">
              View all ({projects.length})
            </Link>
          )}
        </div>

        {projects.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title="No projects yet"
            description="Create your first research project to get started tracking your work."
            action={{
              label: 'Create your first project',
              onClick: () => router.push('/projects/new'),
            }}
          />
        ) : (
          <RecentProjects projects={projects} />
        )}
      </div>
    </div>
  )
}
