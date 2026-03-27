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
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50/50">
      {/* Hero Header */}
      <div className="relative overflow-hidden border-b bg-white/80 backdrop-blur-xl">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(59,130,246,0.05),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(99,102,241,0.04),transparent_50%)]" />
        <div className="relative max-w-7xl mx-auto px-6 pt-6 pb-8">
          <Link href={`/projects/${projectId}`}>
            <Button variant="ghost" size="sm" className="mb-4 h-7 text-xs -ml-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3.5 w-3.5 mr-1" />
              Back to Project
            </Button>
          </Link>
          <div className="flex items-end justify-between">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
                Analysis Engine
              </h1>
              <p className="text-muted-foreground mt-2 max-w-xl">
                Run guided statistical analyses on your research data. Explore results with interactive visualizations and AI-powered interpretations.
              </p>
            </div>
            <Link href={`/projects/${projectId}/analysis/new`}>
              <Button className="shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/25 transition-all font-semibold">
                New Analysis
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <AnalysisHub projectId={projectId} />
      </div>
    </div>
  )
}
