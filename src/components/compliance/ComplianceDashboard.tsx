"use client"

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Project, EthicsApplication } from '@/types/database'
import { EthicsStatusGrid } from './EthicsStatusGrid'
import { Card, CardContent } from '@/components/ui/card'
import { CheckCircle2, Clock, AlertTriangle, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ComplianceDashboardProps {
  institutionLabel?: string
}

interface Summary {
  total: number
  approved: number
  pending: number
  expired: number
  none: number
}

function computeSummary(projects: Project[], ethicsMap: Record<string, EthicsApplication | null>): Summary {
  const now = new Date()
  let approved = 0, pending = 0, expired = 0, none = 0

  for (const p of projects) {
    const e = ethicsMap[p.id] ?? null
    if (!e) { none++; continue }
    const isExpired = e.expiry_date && new Date(e.expiry_date) < now
    if (isExpired) { expired++; continue }
    if (e.status === 'approved') { approved++; continue }
    pending++
  }

  return { total: projects.length, approved, pending, expired, none }
}

const STAT_CARDS = [
  { key: 'approved', label: 'Approved', icon: CheckCircle2, color: 'text-green-700' },
  { key: 'pending', label: 'Pending', icon: Clock, color: 'text-yellow-700' },
  { key: 'expired', label: 'Expired', icon: AlertTriangle, color: 'text-red-700' },
  { key: 'none', label: 'No Application', icon: Minus, color: 'text-gray-500' },
] as const

export function ComplianceDashboard({ institutionLabel }: ComplianceDashboardProps) {
  const [projects, setProjects] = useState<Project[]>([])
  const [ethicsMap, setEthicsMap] = useState<Record<string, EthicsApplication | null>>({})
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: projs } = await supabase
        .from('projects')
        .select('*')
        .order('title')

      if (!projs?.length) { setLoading(false); return }

      const { data: ethicsData } = await supabase
        .from('ethics_applications')
        .select('*')
        .in('project_id', projs.map(p => p.id))

      const map: Record<string, EthicsApplication | null> = {}
      for (const p of projs) {
        map[p.id] = (ethicsData ?? []).find(e => e.project_id === p.id) ?? null
      }

      setProjects(projs)
      setEthicsMap(map)
      setLoading(false)
    }
    load()
  }, [supabase])

  const summary = computeSummary(projects, ethicsMap)

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading compliance data...</p>
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STAT_CARDS.map(({ key, label, icon: Icon, color }) => (
          <Card key={key}>
            <CardContent className="p-4 flex items-center gap-3">
              <Icon className={cn('h-6 w-6', color)} />
              <div>
                <p className="text-2xl font-bold">{summary[key]}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <p className="text-xs text-muted-foreground mb-3">
          {summary.total} project{summary.total !== 1 ? 's' : ''}
          {institutionLabel ? ` · ${institutionLabel}` : ''}
        </p>
        <EthicsStatusGrid projects={projects} ethicsMap={ethicsMap} />
      </div>
    </div>
  )
}
