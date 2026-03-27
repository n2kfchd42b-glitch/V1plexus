"use client"

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Plus, BarChart2, TrendingUp, CheckCircle2,
  Clock, AlertCircle, Filter, Search, LayoutGrid, List, Activity
} from 'lucide-react'
import { AnalysisRunCard } from './AnalysisRunCard'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { AnalysisRun } from '@/types/database'

interface Props {
  projectId: string
}

type ViewMode = 'grid' | 'list'
type FilterStatus = 'all' | 'completed' | 'running' | 'failed'

export function AnalysisHub({ projectId }: Props) {
  const [runs, setRuns] = useState<AnalysisRun[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const supabase = createClient()

  useEffect(() => {
    const fetchRuns = async () => {
      const { data } = await supabase
        .from('analysis_runs')
        .select('*, dataset:datasets(id, name)')
        .eq('project_id', projectId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(50)
      if (data) setRuns(data as AnalysisRun[])
      setLoading(false)
    }
    fetchRuns()
  }, [projectId, supabase])

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('analysis_runs')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      toast.error('Failed to delete analysis')
      return
    }
    setRuns(prev => prev.filter(r => r.id !== id))
    toast.success('Analysis deleted')
  }

  // Stats
  const stats = useMemo(() => {
    const completed = runs.filter(r => r.status === 'completed').length
    const running = runs.filter(r => r.status === 'running' || r.status === 'pending').length
    const failed = runs.filter(r => r.status === 'failed').length
    return { total: runs.length, completed, running, failed }
  }, [runs])

  // Filtered runs
  const filteredRuns = useMemo(() => {
    let result = runs
    if (filterStatus !== 'all') {
      result = result.filter(r =>
        filterStatus === 'running'
          ? r.status === 'running' || r.status === 'pending'
          : r.status === filterStatus
      )
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(r =>
        (r.title ?? '').toLowerCase().includes(q) ||
        r.analysis_type.toLowerCase().includes(q) ||
        (r.dataset as { name: string } | null)?.name?.toLowerCase().includes(q)
      )
    }
    return result
  }, [runs, filterStatus, searchQuery])

  // Recent completed for highlights
  const recentCompleted = useMemo(() =>
    runs.filter(r => r.status === 'completed').slice(0, 3),
    [runs]
  )

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Stats skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-white border animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-44 rounded-2xl bg-white border animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Stats Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<BarChart2 className="h-5 w-5" />}
          label="Total Analyses"
          value={stats.total}
          color="blue"
        />
        <StatCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          label="Completed"
          value={stats.completed}
          color="green"
          subtitle={stats.total > 0 ? `${Math.round((stats.completed / stats.total) * 100)}% success` : undefined}
        />
        <StatCard
          icon={<Activity className="h-5 w-5" />}
          label="In Progress"
          value={stats.running}
          color="amber"
        />
        <StatCard
          icon={<AlertCircle className="h-5 w-5" />}
          label="Failed"
          value={stats.failed}
          color="red"
        />
      </div>

      {/* Recent Highlights */}
      {recentCompleted.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm text-foreground">Recent Results</h3>
            <span className="text-xs text-muted-foreground">Latest completed analyses</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recentCompleted.map(run => (
              <RecentHighlightCard key={run.id} run={run} projectId={projectId} />
            ))}
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex items-center justify-between gap-4 pt-2">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search analyses..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
            />
          </div>
          <div className="flex items-center gap-1 bg-white border rounded-xl p-1">
            {(['all', 'completed', 'running', 'failed'] as FilterStatus[]).map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  filterStatus === status
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-white border rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded transition-colors ${viewMode === 'grid' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded transition-colors ${viewMode === 'list' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Analysis Runs */}
      {filteredRuns.length === 0 ? (
        runs.length === 0 ? (
          <EmptyState projectId={projectId} />
        ) : (
          <div className="text-center py-12">
            <Search className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground text-sm">No analyses match your filters</p>
            <button
              onClick={() => { setFilterStatus('all'); setSearchQuery('') }}
              className="text-primary text-xs mt-2 hover:underline"
            >
              Clear filters
            </button>
          </div>
        )
      ) : (
        <div className={
          viewMode === 'grid'
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
            : 'space-y-2'
        }>
          {filteredRuns.map(run => (
            <AnalysisRunCard
              key={run.id}
              run={run}
              projectId={projectId}
              onDelete={handleDelete}
              viewMode={viewMode}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Stat Card ──────────────────────────────────────────────
function StatCard({ icon, label, value, color, subtitle }: {
  icon: React.ReactNode; label: string; value: number; color: string; subtitle?: string
}) {
  const colorMap: Record<string, string> = {
    blue: 'from-blue-50 to-blue-50/30 border-blue-100 text-blue-600',
    green: 'from-emerald-50 to-emerald-50/30 border-emerald-100 text-emerald-600',
    amber: 'from-amber-50 to-amber-50/30 border-amber-100 text-amber-600',
    red: 'from-red-50 to-red-50/30 border-red-100 text-red-600',
  }
  const iconColorMap: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-emerald-100 text-emerald-600',
    amber: 'bg-amber-100 text-amber-600',
    red: 'bg-red-100 text-red-600',
  }

  return (
    <div className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${colorMap[color]} p-5 transition-all hover:shadow-md`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
          <p className="text-3xl font-extrabold tracking-tight text-foreground">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        <div className={`rounded-xl p-2.5 ${iconColorMap[color]}`}>
          {icon}
        </div>
      </div>
    </div>
  )
}

// ── Recent Highlight Card ──────────────────────────────────
function RecentHighlightCard({ run, projectId }: { run: AnalysisRun; projectId: string }) {
  const summary = run.results?.summary as Record<string, unknown> | undefined
  const keyPairs = summary
    ? Object.entries(summary).filter(([k]) => k !== 'error').slice(0, 3)
    : []

  return (
    <Link href={`/projects/${projectId}/analysis/${run.id}`}>
      <div className="group relative overflow-hidden rounded-2xl border bg-white p-5 hover:shadow-lg hover:shadow-primary/5 transition-all cursor-pointer">
        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-primary/5 to-transparent rounded-bl-full" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            <div className="rounded-lg bg-emerald-100 p-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">Completed</span>
          </div>
          <h4 className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">
            {run.title ?? run.analysis_type}
          </h4>
          {run.dataset && (
            <p className="text-xs text-muted-foreground mt-1 truncate">
              {(run.dataset as { name: string }).name}
            </p>
          )}
          {keyPairs.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {keyPairs.slice(0, 2).map(([key, val]) => (
                <div key={key} className="bg-slate-50 rounded-lg px-2.5 py-1.5">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground truncate">{formatKey(key)}</p>
                  <p className="text-sm font-bold text-foreground truncate">{String(val)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}

// ── Empty State ────────────────────────────────────────────
function EmptyState({ projectId }: { projectId: string }) {
  return (
    <div className="relative overflow-hidden text-center py-16 border rounded-2xl bg-white">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.04),transparent_70%)]" />
      <div className="relative">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center mb-4 shadow-sm">
          <BarChart2 className="h-8 w-8 text-primary/60" />
        </div>
        <h3 className="font-bold text-lg text-foreground">No analyses yet</h3>
        <p className="text-muted-foreground text-sm mt-2 max-w-md mx-auto">
          Run your first statistical analysis to start seeing results, interactive visualizations, and AI-powered interpretations.
        </p>
        <Link href={`/projects/${projectId}/analysis/new`}>
          <Button className="mt-6 shadow-lg shadow-primary/20">
            <Plus className="h-4 w-4 mr-1.5" />
            Start Your First Analysis
          </Button>
        </Link>
      </div>
    </div>
  )
}

function formatKey(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .trim()
    .replace(/^./, c => c.toUpperCase())
}
