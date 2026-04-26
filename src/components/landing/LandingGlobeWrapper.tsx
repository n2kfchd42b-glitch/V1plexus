"use client"

import dynamic from 'next/dynamic'

const LandingGlobe = dynamic(
  () => import('./LandingGlobe').then(m => ({ default: m.LandingGlobe })),
  {
    ssr: false,
    loading: () => <div className="h-full w-full bg-[#060d1c] rounded-2xl" />,
  }
)

export function LandingGlobeWrapper() {
  return <LandingGlobe />
}
