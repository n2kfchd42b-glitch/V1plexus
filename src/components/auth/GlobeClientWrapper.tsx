"use client"

import dynamic from 'next/dynamic'

const ResearcherGlobe = dynamic(
  () => import('./ResearcherGlobe').then(m => m.ResearcherGlobe),
  { ssr: false }
)

export function GlobeClientWrapper() {
  return <ResearcherGlobe />
}
