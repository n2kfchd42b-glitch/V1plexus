"use client"

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { AnalysisHub } from '@/components/analysis/AnalysisHub'

export default function AnalysisPage() {
  const params = useParams()
  const projectId = params.id as string

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <Link href={`/projects/${projectId}`}>
          <Button variant="ghost" size="sm" className="mb-3 h-7 text-xs -ml-2">
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            Back to Project
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Statistical Analysis</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Run guided analyses on your research data. No code required.
        </p>
      </div>
      <AnalysisHub projectId={projectId} />
    </div>
  )
}
