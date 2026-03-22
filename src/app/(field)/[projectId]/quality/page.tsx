'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { FieldBottomNav } from '@/components/field/FieldBottomNav'
import { QualityAlertCard } from '@/components/field/QualityAlertCard'
import { QualityScoreBadge } from '@/components/quality/QualityScoreBadge'
import type { DataQualityScore } from '@/types/database'

export default function FieldQualityPage() {
  const params = useParams()
  const projectId = params.projectId as string
  const supabase = createClient()
  const [scores, setScores] = useState<DataQualityScore[]>([])

  useEffect(() => {
    const load = async () => {
      const { data: datasets } = await supabase
        .from('datasets')
        .select('id, name')
        .eq('project_id', projectId)
        .is('deleted_at', null)

      const ids = (datasets ?? []).map((d: { id: string }) => d.id)
      if (!ids.length) return

      const { data } = await supabase
        .from('data_quality_scores')
        .select('*')
        .in('dataset_id', ids)
        .order('created_at', { ascending: false })
        .limit(ids.length)

      setScores((data ?? []) as DataQualityScore[])
    }
    load()
  }, [projectId, supabase])

  const avgScore = scores.length ? Math.round(scores.reduce((s, sc) => s + sc.overall_score, 0) / scores.length) : null

  return (
    <div className="flex flex-col min-h-screen pb-20">
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <Link href={`/field/${projectId}`}><ArrowLeft className="h-5 w-5 text-gray-500" /></Link>
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-800">Data Quality</p>
          <p className="text-xs text-gray-400">Live quality monitoring</p>
        </div>
        {avgScore !== null && <QualityScoreBadge score={avgScore} size="md" />}
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {scores.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-gray-800">{avgScore ?? '—'}</p>
              <p className="text-[10px] text-gray-400">Overall</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-red-600">{scores.reduce((s, sc) => s + sc.errors_count, 0)}</p>
              <p className="text-[10px] text-gray-400">Errors</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-amber-500">{scores.reduce((s, sc) => s + sc.warnings_count, 0)}</p>
              <p className="text-[10px] text-gray-400">Warnings</p>
            </div>
          </div>
        )}

        <QualityAlertCard projectId={projectId} />

        <Link href={`/projects/${projectId}/data`} className="block">
          <div className="border border-blue-200 rounded-xl p-4 bg-blue-50 text-center">
            <p className="text-sm font-medium text-blue-700">Open full quality dashboard →</p>
          </div>
        </Link>
      </main>

      <FieldBottomNav projectId={projectId} />
    </div>
  )
}
