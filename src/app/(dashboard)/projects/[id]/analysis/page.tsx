"use client"

import { useParams } from 'next/navigation'
import { AnalysisHub } from '@/components/analysis/AnalysisHub'

export default function AnalysisPage() {
  const params = useParams()
  return <AnalysisHub projectId={params.id as string} hideNav />
}
