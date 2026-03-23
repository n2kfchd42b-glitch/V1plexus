'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { ArrowLeft, Database } from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { FieldBottomNav } from '@/components/field/FieldBottomNav'
import type { Dataset } from '@/types/database'

export default function FieldDataPage() {
  const params = useParams()
  const projectId = params.projectId as string
  const supabase = createClient()
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('datasets')
      .select('*')
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .then(({ data }) => {
        setDatasets((data ?? []) as Dataset[])
        setLoading(false)
      })
  }, [projectId, supabase])

  return (
    <div className="flex flex-col min-h-screen pb-20">
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <Link href={`/field/${projectId}`}><ArrowLeft className="h-5 w-5 text-gray-500" /></Link>
        <div>
          <p className="text-sm font-semibold text-gray-800">Datasets</p>
          <p className="text-xs text-gray-400">All project data</p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 rounded-full border-2 border-gray-300 border-t-blue-500 animate-spin" />
          </div>
        ) : datasets.length === 0 ? (
          <div className="text-center py-12 text-sm text-gray-400">No datasets yet.</div>
        ) : (
          datasets.map(ds => (
            <Link key={ds.id} href={`/projects/${projectId}/data/${ds.id}`}>
              <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3 hover:border-blue-300 transition-colors">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Database className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{ds.name}</p>
                  <p className="text-xs text-gray-400">
                    Updated {formatDistanceToNow(new Date(ds.updated_at), { addSuffix: true })}
                  </p>
                </div>
                <span className="text-xs text-gray-400">→</span>
              </div>
            </Link>
          ))
        )}
      </main>

      <FieldBottomNav projectId={projectId} />
    </div>
  )
}
