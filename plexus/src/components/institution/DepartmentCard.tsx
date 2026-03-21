import { Building2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import type { Department } from '@/types/app'

interface DepartmentCardProps {
  department: Department
  projectCount?: number
  memberCount?: number
}

export function DepartmentCard({ department, projectCount = 0, memberCount = 0 }: DepartmentCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-md bg-[#D5E8F0] flex items-center justify-center shrink-0">
            <Building2 className="h-5 w-5 text-[#2E75B6]" />
          </div>
          <div>
            <CardTitle className="text-base">{department.name}</CardTitle>
            {department.description && (
              <CardDescription className="mt-1 line-clamp-2">{department.description}</CardDescription>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 text-xs text-[#718096]">
          <span>{projectCount} {projectCount === 1 ? 'project' : 'projects'}</span>
          <span>{memberCount} {memberCount === 1 ? 'member' : 'members'}</span>
        </div>
      </CardContent>
    </Card>
  )
}
