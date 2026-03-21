"use client"

import type { Project, EthicsApplication } from '@/types/database'
import { ComplianceCard } from './ComplianceCard'

interface EthicsStatusGridProps {
  projects: Project[]
  ethicsMap: Record<string, EthicsApplication | null>
}

export function EthicsStatusGrid({ projects, ethicsMap }: EthicsStatusGridProps) {
  if (projects.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No projects found.</p>
  }

  return (
    <div className="space-y-2">
      {projects.map(p => (
        <ComplianceCard key={p.id} project={p} ethics={ethicsMap[p.id] ?? null} />
      ))}
    </div>
  )
}
