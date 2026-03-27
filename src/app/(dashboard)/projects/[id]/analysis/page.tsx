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
    <div className="min-h-screen bg-[#f7f9fb]">
      {/* Page Header */}
      <div className="border-b bg-white">
        <div className="max-w-7xl mx-auto px-6 pt-5 pb-6">
          <Link href={`/projects/${projectId}`}>
            <Button variant="ghost" size="sm" className="mb-3 h-7 text-xs -ml-2 text-[#A1A1AA] hover:text-[#18181B]">
              <ArrowLeft className="h-3.5 w-3.5 mr-1" />
              Back to Project
            </Button>
          </Link>
          <div className="flex items-end justify-between">
            <div>
              <h1 className="text-2xl font-manrope font-extrabold tracking-tight text-[#003D9B]">
                Analysis Engine
              </h1>
              <p className="text-sm text-[#52525B] mt-1 max-w-xl">
                Run guided statistical analyses on your research data. Explore results with interactive visualizations and AI-powered interpretations.
              </p>
            </div>
            <Link href={`/projects/${projectId}/analysis/new`}>
              <Button className="bg-[#0052CC] hover:bg-[#003D9B] text-white font-semibold transition-colors duration-150">
                New Analysis
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <AnalysisHub projectId={projectId} />
      </div>
    </div>
  )
}
