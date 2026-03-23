'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface ReproduceAnalysisButtonProps {
  entryId: string
  resourceId: string
}

export function ReproduceAnalysisButton({ resourceId }: ReproduceAnalysisButtonProps) {
  const { profile } = useAuth()
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleReproduce = async () => {
    if (!profile) return
    setLoading(true)

    try {
      // Fetch source analysis run configuration
      const { data: sourceRun } = await supabase
        .from('analysis_runs')
        .select('*')
        .eq('id', resourceId)
        .single()

      if (!sourceRun) {
        toast.error('Analysis configuration not found.')
        setLoading(false)
        return
      }

      // Clone the run config — user will select their own dataset
      const { data: newRun, error } = await supabase
        .from('analysis_runs')
        .insert({
          project_id: sourceRun.project_id,
          analysis_type: sourceRun.analysis_type,
          config: sourceRun.config,
          engine: sourceRun.engine,
          status: 'pending',
          created_by: profile.id,
          name: `[Reproduced] ${sourceRun.name ?? 'Analysis'}`,
        })
        .select('id, project_id')
        .single()

      if (error || !newRun) {
        toast.error('Failed to create analysis reproduction.')
        setLoading(false)
        return
      }

      toast.success('Analysis configuration cloned. Select your dataset to run it.')
      router.push(`/projects/${newRun.project_id}/analysis/${newRun.id}`)
    } catch {
      toast.error('Unexpected error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleReproduce}
      disabled={loading}
      className="inline-flex items-center gap-1 text-xs font-medium text-orange-600 hover:text-orange-700 disabled:opacity-50"
    >
      <RefreshCw className="h-3 w-3" />
      {loading ? 'Cloning…' : 'Reproduce with New Data'}
    </button>
  )
}
