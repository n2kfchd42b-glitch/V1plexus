import { ProjectCard } from '@/components/project/ProjectCard'
import type { Project } from '@/types/app'

interface RecentProjectsProps {
  projects: Project[]
}

export function RecentProjects({ projects }: RecentProjectsProps) {
  const recent = projects.slice(0, 6)
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {recent.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  )
}
