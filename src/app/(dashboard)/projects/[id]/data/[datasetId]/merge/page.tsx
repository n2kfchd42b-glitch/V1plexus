'use client'

import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MergeWizard } from '@/components/merge/MergeWizard'
import { AppendWizard } from '@/components/merge/AppendWizard'
import { useAuth } from '@/hooks/useAuth'
import { useEffect } from 'react'

export default function MergePage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string
  const datasetId = params.datasetId as string
  const { user, loading: authLoading } = useAuth()

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [authLoading, user, router])

  const handleComplete = (newDatasetId: string) => {
    router.push(`/projects/${projectId}/data/${newDatasetId}`)
  }

  const handleCancel = () => {
    router.push(`/projects/${projectId}/data/${datasetId}`)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-3 border-b bg-white shrink-0">
        <Link href={`/projects/${projectId}/data/${datasetId}`}>
          <Button variant="ghost" size="sm" className="h-7 text-xs -ml-2">
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            Back to Dataset
          </Button>
        </Link>
      </div>
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-xl font-bold text-gray-900 mb-1">Combine Datasets</h1>
          <p className="text-sm text-gray-500 mb-6">
            Merge two datasets by matching rows on a key column, or append (stack) rows from another dataset.
          </p>
          <Tabs defaultValue="merge">
            <TabsList className="mb-6">
              <TabsTrigger value="merge">Merge (Join)</TabsTrigger>
              <TabsTrigger value="append">Append (Stack)</TabsTrigger>
            </TabsList>
            <TabsContent value="merge">
              <MergeWizard
                projectId={projectId}
                currentDatasetId={datasetId}
                onComplete={handleComplete}
                onCancel={handleCancel}
              />
            </TabsContent>
            <TabsContent value="append">
              <AppendWizard
                projectId={projectId}
                currentDatasetId={datasetId}
                onComplete={handleComplete}
                onCancel={handleCancel}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
