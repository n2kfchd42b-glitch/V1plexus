'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Bell, Menu } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { FieldBottomNav } from '@/components/field/FieldBottomNav'
import { SubmissionCounter } from '@/components/field/SubmissionCounter'
import { EnumeratorList } from '@/components/field/EnumeratorList'

interface ProjectInfo {
  id: string
  title: string
}

export default function FieldDashboardPage() {
  const params = useParams()
  const projectId = params.projectId as string
  const supabase = createClient()
  const [project, setProject] = useState<ProjectInfo | null>(null)

  useEffect(() => {
    supabase
      .from('projects')
      .select('id, title')
      .eq('id', projectId)
      .single()
      .then(({ data }) => setProject(data))
  }, [projectId, supabase])

  return (
    <div className="flex flex-col min-h-screen pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">PLEXUS Field</p>
          <h1 className="text-sm font-medium text-gray-800 truncate max-w-[200px]">
            {project?.title ?? '…'}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/notifications">
            <Bell className="h-5 w-5 text-gray-500" />
          </Link>
          <Link href={`/projects/${projectId}/overview`}>
            <Menu className="h-5 w-5 text-gray-500" />
          </Link>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 space-y-4 overflow-y-auto">
        {/* Today's progress */}
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Today&apos;s Progress</h2>
          <SubmissionCounter projectId={projectId} />
        </section>

        {/* Enumerator list */}
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">By Enumerator</h2>
          <EnumeratorList projectId={projectId} />
        </section>

        {/* Coverage map link */}
        <Link href={`/field/${projectId}/map`}>
          <div className="border border-gray-200 rounded-xl p-4 bg-white flex items-center justify-between hover:border-blue-300 transition-colors">
            <div>
              <p className="text-sm font-medium text-gray-800">📍 Coverage Map</p>
              <p className="text-xs text-gray-500">View submission locations</p>
            </div>
            <span className="text-blue-600 text-sm">View →</span>
          </div>
        </Link>
      </main>

      <FieldBottomNav projectId={projectId} />
    </div>
  )
}
