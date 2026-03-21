'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FolderOpen, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ProjectCard } from '@/components/project/ProjectCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { ProjectCardSkeletonGrid } from '@/components/shared/SkeletonLoader'
import { PageHeader } from '@/components/shared/PageHeader'
import { useProjects } from '@/hooks/useProjects'
import { useRouter } from 'next/navigation'
import type { ProjectStatus } from '@/types/app'

export default function ProjectsPage() {
  const { projects, loading } = useProjects()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all')
  const router = useRouter()

  const filtered = projects.filter((p) => {
    const matchesSearch = p.title.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="All your research projects"
        actions={
          <Button asChild>
            <Link href="/projects/new">New project</Link>
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[#A0AEC0]" />
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as ProjectStatus | 'all')}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <ProjectCardSkeletonGrid />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title={search || statusFilter !== 'all' ? 'No projects match your filters' : 'No projects yet'}
          description={
            search || statusFilter !== 'all'
              ? 'Try adjusting your search or filters.'
              : 'Create your first research project to get started.'
          }
          action={
            !search && statusFilter === 'all'
              ? { label: 'Create project', onClick: () => router.push('/projects/new') }
              : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  )
}
