"use client"

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Activity } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AuditLogViewer } from '@/components/audit/AuditLogViewer'
import { createClient } from '@/lib/supabase/client'
import { getProject } from '@/lib/data'
import type { Project } from '@/types/database'

export default function ProjectActivityPage() {
  const params = useParams()
  const projectId = params.id as string
  const [project, setProject] = useState<Project | null>(null)
  const supabase = createClient()

  useEffect(() => {
    getProject(supabase, projectId).then(result => {
      if (result.data) setProject(result.data)
    })
  }, [projectId, supabase])

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <Link href={`/projects/${projectId}`}>
          <Button variant="ghost" size="sm" className="mb-3 h-7 text-xs -ml-2">
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            Back to Project
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">Activity Log</h1>
        </div>
        {project && (
          <p className="text-sm text-muted-foreground mt-1">{project.title}</p>
        )}
      </div>

      <AuditLogViewer projectId={projectId} />
    </div>
  )
}
