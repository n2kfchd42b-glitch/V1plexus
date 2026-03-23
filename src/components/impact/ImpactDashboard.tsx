'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { MetricCard } from './MetricCard'
import { OutputTrendChart } from './OutputTrendChart'
import { ResearchAreaMap } from './ResearchAreaMap'
import { GeographicReachMap } from './GeographicReachMap'
import { DepartmentComparison } from './DepartmentComparison'
import { CollaborationGraph } from './CollaborationGraph'
import { AnnualReportExport } from './AnnualReportExport'
import type { ResearchMetricsBlob } from '@/types/database'

const MOCK_METRICS: ResearchMetricsBlob = {
  projects:    { total: 45, active: 28, completed: 12, archived: 5 },
  publications:{ total: 23, this_quarter: 4, in_review: 7 },
  datasets:    { total: 67, published_with_doi: 12, shared_on_network: 8 },
  analyses:    { total: 234, this_quarter: 45 },
  researchers: { total: 87, active_this_quarter: 62 },
  theses:      { active: 18, completed_this_year: 6, on_track: 12, behind: 4, at_risk: 2 },
  grants:      { active: 8, total_funding: 2450000, reports_due_soon: 2 },
  ethics:      { approved: 24, pending: 3, expired: 1 },
  collaboration:{ cross_dept_projects: 5, external_collaborators: 14 },
  top_disease_areas: [
    { name: 'Malaria', count: 12 }, { name: 'Tuberculosis', count: 8 },
    { name: 'Maternal Health', count: 7 }, { name: 'Nutrition', count: 6 },
    { name: 'HIV/AIDS', count: 5 }, { name: 'Child Health', count: 4 },
  ],
  top_methodologies: [
    { name: 'Cross-sectional', count: 15 }, { name: 'RCT', count: 4 },
    { name: 'Cohort', count: 8 }, { name: 'Case-control', count: 3 },
  ],
  geographic_reach: [
    { name: 'Northern Region', count: 18 }, { name: 'Greater Accra', count: 12 },
    { name: 'Ashanti', count: 10 }, { name: 'Eastern Region', count: 7 },
    { name: 'Western Region', count: 6 },
  ],
}

export function ImpactDashboard() {
  const { profile } = useAuth()
  const supabase = createClient()
  const [metrics, setMetrics] = useState<ResearchMetricsBlob>(MOCK_METRICS)
  const [loading, setLoading] = useState(true)

  const fetchMetrics = useCallback(async () => {
    if (!profile?.institution_id) { setLoading(false); return }
    const { data } = await supabase
      .from('research_metrics')
      .select('metrics')
      .eq('institution_id', profile.institution_id)
      .eq('period', 'all-time')
      .order('computed_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (data?.metrics) setMetrics(data.metrics as ResearchMetricsBlob)
    setLoading(false)
  }, [profile, supabase])

  useEffect(() => { fetchMetrics() }, [fetchMetrics])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)] animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  const institutionName = profile?.institution?.name ?? 'Your Institution'

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <MetricCard label="Projects" value={metrics.projects.total} sublabel={`${metrics.projects.active} active`} accent="blue" />
        <MetricCard label="Publications" value={metrics.publications.total} sublabel={`${metrics.publications.this_quarter} this quarter`} accent="green" />
        <MetricCard label="Datasets" value={metrics.datasets.total} sublabel={`${metrics.datasets.published_with_doi} with DOI`} accent="purple" />
        <MetricCard label="Researchers" value={metrics.researchers.total} sublabel={`${metrics.researchers.active_this_quarter} active`} accent="orange" />
        <MetricCard label="Active Grants" value={`$${(metrics.grants.total_funding / 1e6).toFixed(1)}M`} sublabel={`${metrics.grants.active} grants`} accent="blue" />
      </div>

      {/* Output Trends */}
      <section className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
        <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Output Trends</h2>
        <OutputTrendChart />
      </section>

      {/* Research Areas + Geographic Reach */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Research Areas</h2>
          <ResearchAreaMap data={metrics.top_disease_areas} />
        </section>
        <section className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Geographic Reach</h2>
          <GeographicReachMap data={metrics.geographic_reach} />
        </section>
      </div>

      {/* Department Comparison */}
      <section className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
        <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Department Comparison</h2>
        <DepartmentComparison />
      </section>

      {/* Collaboration Network */}
      <section className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
        <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Collaboration Network</h2>
        <CollaborationGraph />
      </section>

      {/* Export */}
      <div className="flex justify-end">
        <AnnualReportExport metrics={metrics} institutionName={institutionName} />
      </div>
    </div>
  )
}
