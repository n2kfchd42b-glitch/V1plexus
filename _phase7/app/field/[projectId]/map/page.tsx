'use client'

import { useParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { FieldBottomNav } from '@/components/field/FieldBottomNav'

// Dynamically import the map to avoid SSR issues
const CoverageMap = dynamic(() => import('@/components/field/CoverageMap').then(m => m.CoverageMap), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-gray-100">
      <div className="h-6 w-6 rounded-full border-2 border-gray-300 border-t-blue-500 animate-spin" />
    </div>
  ),
})

export default function FieldMapPage() {
  const params = useParams()
  const projectId = params.projectId as string

  return (
    <div className="flex flex-col min-h-screen pb-16">
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <Link href={`/field/${projectId}`}><ArrowLeft className="h-5 w-5 text-gray-500" /></Link>
        <div>
          <p className="text-sm font-semibold text-gray-800">Coverage Map</p>
          <p className="text-xs text-gray-400">Submission locations</p>
        </div>
      </header>

      <main className="flex-1 relative" style={{ height: 'calc(100vh - 120px)' }}>
        <CoverageMap projectId={projectId} />
      </main>

      <FieldBottomNav projectId={projectId} />
    </div>
  )
}
