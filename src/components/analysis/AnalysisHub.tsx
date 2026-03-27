"use client"

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Plus, BarChart2, TrendingUp, CheckCircle2,
  Clock, AlertCircle, Search, LayoutGrid, List, Activity
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

  const stats = useMemo(() => {
    const completed = runs.filter(r => r.status === 'completed').length
    const running = runs.filter(r => r.status === 'running' || r.status === 'pending').length
    const failed = runs.filter(r => r.status === 'failed').length
    return { total: runs.length, completed, running, failed }
  }, [runs])

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

  const recentCompleted = useMemo(() =>
    runs.filter(r => r.status === 'completed').slice(0, 3),
    [runs]
  )

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 rounded-lg bg-white border border-[#E4E4E7] animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-44 rounded-lg bg-white border border-[#E4E4E7] animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<BarChart2 className="h-4 w-4" />} label="Total Analyses" value={stats.total} />
        <StatCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Completed"
          value={stats.completed}
          accent="success"
          subtitle={stats.total > 0 ? `${Math.round((stats.completed / stats.total) * 100)}% success rate` : undefined}
        />
        <StatCard icon={<Activity className="h-4 w-4" />} label="In Progress" value={stats.running} accent="info" />
        <StatCard icon={<AlertCircle className="h-4 w-4" />} label="Failed" value={stats.failed} accent="error" />
      </div>

      {/* Recent Completed */}
      {recentCompleted.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-[#0052CC]" />
            <h3 className="font-manrope font-bold text-sm text-[#18181B]">Recent Results</h3>
            <span className="text-xs text-[#A1A1AA]">Latest completed analyses</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recentCompleted.map(run => (
              <RecentHighlightCard key={run.id} run={run} projectId={projectId} />
            ))}
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#A1A1AA]" />
            <input
              type="text"
              placeholder="Search analyses..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-4 py-2 text-sm rounded-lg border border-[#E4E4E7] bg-white text-[#18181B] placeholder:text-[#A1A1AA] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/20 focus:border-[#3B82F6] transition-all duration-150"
            />
          </div>
          <div className="flex items-center gap-0.5 bg-white border border-[#E4E4E7] rounded-lg p-1">
            {(['all', 'completed', 'running', 'failed'] as FilterStatus[]).map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-150 ${
                  filterStatus === status
                    ? 'bg-[#0052CC] text-white'
                    : 'text-[#52525B] hover:text-[#18181B] hover:bg-[#F5F5F5]'
                }`}
              >
                {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center bg-white border border-[#E4E4E7] rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded transition-colors duration-150 ${viewMode === 'grid' ? 'bg-[#F0F0F0] text-[#18181B]' : 'text-[#A1A1AA] hover:text-[#18181B]'}`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded transition-colors duration-150 ${viewMode === 'list' ? 'bg-[#F0F0F0] text-[#18181B]' : 'text-[#A1A1AA] hover:text-[#18181B]'}`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Analysis Runs */}
      {filteredRuns.length === 0 ? (
        runs.length === 0 ? (
          <EmptyState projectId={projectId} />
        ) : (
          <div className="text-center py-12">
            <Search className="h-8 w-8 mx-auto text-[#A1A1AA] mb-3" />
            <p className="text-sm text-[#52525B]">No analyses match your filters</p>
            <button
              onClick={() => { setFilterStatus('all'); setSearchQuery('') }}
              className="text-[#0052CC] text-xs mt-2 hover:underline"
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
function StatCard({ icon, label, value, accent, subtitle }: {
  icon: React.ReactNode
  label: string
  value: number
  accent?: 'success' | 'error' | 'info'
  subtitle?: string
}) {
  const accentColorMap: Record<string, string> = {
    success: 'text-[#166534]',
    error:   'text-[#991B1B]',
    info:    'text-[#1E40AF]',
  }
  const accentColor = accent ? (accentColorMap[accent] ?? 'text-[#0052CC]') : 'text-[#0052CC]'

  const iconBgMap: Record<string, string> = {
    success: 'bg-[#F0FDF4] text-[#22C55E]',
    error:   'bg-[#FEF2F2] text-[#EF4444]',
    info:    'bg-[#EFF6FF] text-[#3B82F6]',
  }
  const iconBg = accent ? (iconBgMap[accent] ?? 'bg-[#EFF6FF] text-[#3B82F6]') : 'bg-[#EFF6FF] text-[#3B82F6]'

  return (
    <div className="bg-white border border-[#E4E4E7] rounded-lg p-4 transition-all duration-150 hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] cursor-default">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#A1A1AA] mb-1">{label}</p>
          <p className={`text-2xl font-manrope font-extrabold tracking-tight ${accentColor}`}>{value}</p>
          {subtitle && <p className="text-xs text-[#A1A1AA] mt-0.5">{subtitle}</p>}
        </div>
        <div className={`rounded-lg p-2 ${iconBg}`}>
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
    ? Object.entries(summary).filter(([k]) => k !== 'error').slice(0, 2)
    : []

  return (
    <Link href={`/projects/${projectId}/analysis/${run.id}`}>
      <div className="group bg-white border border-[#E4E4E7] rounded-lg p-4 transition-all duration-150 hover:shadow-[0_4px_16px_rgba(0,82,204,0.07)] cursor-pointer">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle2 className="h-3.5 w-3.5 text-[#22C55E]" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#166534]">Completed</span>
        </div>
        <h4 className="font-manrope font-bold text-sm text-[#18181B] truncate group-hover:text-[#0052CC] transition-colors duration-150">
          {run.title ?? run.analysis_type}
        </h4>
        {run.dataset && (
          <p className="text-xs text-[#A1A1AA] mt-0.5 truncate">
            {(run.dataset as { name: string }).name}
          </p>
        )}
        {keyPairs.length > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {keyPairs.map(([key, val]) => (
              <div key={key} className="bg-[#F0F0F0] rounded-md px-2.5 py-1.5">
                <p className="text-[9px] font-bold uppercase tracking-wider text-[#A1A1AA] truncate">{formatKey(key)}</p>
                <p className="text-sm font-manrope font-bold text-[#18181B] truncate">{String(val)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </Link>
  )
}

// ── Empty State ────────────────────────────────────────────
function EmptyState({ projectId }: { projectId: string }) {
  return (
    <div className="text-center py-16 bg-white border border-[#E4E4E7] rounded-lg">
      <div className="mx-auto w-12 h-12 rounded-lg bg-[#EFF6FF] flex items-center justify-center mb-4">
        <BarChart2 className="h-6 w-6 text-[#3B82F6]" />
      </div>
      <h3 className="font-manrope font-bold text-base text-[#18181B]">No analyses yet</h3>
      <p className="text-sm text-[#52525B] mt-1.5 max-w-sm mx-auto">
        Run your first statistical analysis to start seeing results, interactive visualizations, and AI-powered interpretations.
      </p>
      <Link href={`/projects/${projectId}/analysis/new`}>
        <Button className="mt-5 bg-[#0052CC] hover:bg-[#003D9B] text-white font-semibold transition-colors duration-150">
          <Plus className="h-4 w-4 mr-1.5" />
          Start Your First Analysis
        </Button>
      </Link>
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
