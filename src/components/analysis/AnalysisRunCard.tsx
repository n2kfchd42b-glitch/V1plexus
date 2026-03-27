"use client"

import { useState } from 'react'
import Link from 'next/link'
import {
  BarChart2, Clock, Database, Trash2, X, Check,
  CheckCircle2, Loader2, AlertCircle, ArrowRight
} from 'lucide-react'
import { formatRelative } from '@/lib/utils'
import type { AnalysisRun } from '@/types/database'
import { ANALYSIS_TYPES } from './AnalysisTypePicker'

interface Props {
  run: AnalysisRun
  projectId: string
  onDelete?: (id: string) => void
  viewMode?: 'grid' | 'list'
}

const statusConfig = {
  completed: {
    icon: CheckCircle2,
    label: 'Completed',
    dotColor: 'bg-emerald-500',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    iconClass: 'text-emerald-500',
  },
  failed: {
    icon: AlertCircle,
    label: 'Failed',
    dotColor: 'bg-red-500',
    badgeClass: 'bg-red-50 text-red-700 border-red-200',
    iconClass: 'text-red-500',
  },
  running: {
    icon: Loader2,
    label: 'Running',
    dotColor: 'bg-blue-500',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    iconClass: 'text-blue-500',
  },
  pending: {
    icon: Clock,
    label: 'Pending',
    dotColor: 'bg-gray-400',
    badgeClass: 'bg-gray-50 text-gray-600 border-gray-200',
    iconClass: 'text-gray-400',
  },
  cancelled: {
    icon: X,
    label: 'Cancelled',
    dotColor: 'bg-gray-400',
    badgeClass: 'bg-gray-50 text-gray-600 border-gray-200',
    iconClass: 'text-gray-400',
  },
}

export function AnalysisRunCard({ run, projectId, onDelete, viewMode = 'grid' }: Props) {
  const [confirming, setConfirming] = useState(false)
  const info = ANALYSIS_TYPES.find(t => t.type === run.analysis_type)
  const status = statusConfig[run.status as keyof typeof statusConfig] ?? statusConfig.pending
  const StatusIcon = status.icon

  const summary = run.results?.summary as Record<string, unknown> | undefined
  const keyPairs = summary
    ? Object.entries(summary).filter(([k]) => k !== 'error').slice(0, 4)
    : []

  if (viewMode === 'list') {
    return <ListCard run={run} projectId={projectId} info={info} status={status} StatusIcon={StatusIcon} keyPairs={keyPairs} onDelete={onDelete} confirming={confirming} setConfirming={setConfirming} />
  }

  return (
    <div className="group relative">
      <Link href={`/projects/${projectId}/analysis/${run.id}`}>
        <div className="relative overflow-hidden rounded-2xl border bg-white hover:shadow-lg hover:shadow-primary/5 transition-all cursor-pointer h-full">
          {/* Status stripe */}
          <div className={`absolute top-0 left-0 right-0 h-0.5 ${status.dotColor}`} />

          <div className="p-5">
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className={`rounded-xl p-2 border ${status.badgeClass}`}>
                <StatusIcon className={`h-4 w-4 ${status.iconClass} ${run.status === 'running' ? 'animate-spin' : ''}`} />
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-widest ${status.iconClass}`}>
                {status.label}
              </span>
            </div>

            {/* Title & Type */}
            <h4 className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">
              {run.title ?? info?.label ?? run.analysis_type}
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {info?.label ?? run.analysis_type.replace(/_/g, ' ')}
            </p>

            {/* Key Metrics */}
            {keyPairs.length > 0 && run.status === 'completed' && (
              <div className="mt-3 grid grid-cols-2 gap-1.5">
                {keyPairs.slice(0, 4).map(([key, val]) => (
                  <div key={key} className="bg-slate-50 rounded-lg px-2 py-1.5">
                    <p className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground truncate">
                      {formatKey(key)}
                    </p>
                    <p className="text-xs font-bold text-foreground truncate">{String(val)}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
              <div className="flex items-center gap-3 min-w-0">
                {run.dataset && (
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground truncate">
                    <Database className="h-3 w-3 shrink-0" />
                    <span className="truncate">{(run.dataset as { name: string }).name}</span>
                  </span>
                )}
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground shrink-0">
                  <Clock className="h-3 w-3" />
                  {formatRelative(run.created_at)}
                </span>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/0 group-hover:text-primary transition-all group-hover:translate-x-0 -translate-x-1" />
            </div>
          </div>
        </div>
      </Link>

      {/* Delete Button */}
      {onDelete && (
        <DeleteButton
          confirming={confirming}
          setConfirming={setConfirming}
          onDelete={() => onDelete(run.id)}
        />
      )}
    </div>
  )
}

// ── List View Card ─────────────────────────────────────────
function ListCard({ run, projectId, info, status, StatusIcon, keyPairs, onDelete, confirming, setConfirming }: {
  run: AnalysisRun
  projectId: string
  info: (typeof ANALYSIS_TYPES)[number] | undefined
  status: (typeof statusConfig)[keyof typeof statusConfig]
  StatusIcon: typeof CheckCircle2
  keyPairs: [string, unknown][]
  onDelete?: (id: string) => void
  confirming: boolean
  setConfirming: (v: boolean) => void
}) {
  return (
    <div className="group relative">
      <Link href={`/projects/${projectId}/analysis/${run.id}`}>
        <div className="relative overflow-hidden rounded-xl border bg-white hover:shadow-md hover:shadow-primary/5 transition-all cursor-pointer">
          <div className="flex items-center gap-4 p-4">
            {/* Status Icon */}
            <div className={`rounded-xl p-2.5 border shrink-0 ${status.badgeClass}`}>
              <StatusIcon className={`h-4 w-4 ${status.iconClass} ${run.status === 'running' ? 'animate-spin' : ''}`} />
            </div>

            {/* Main info */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
                  {run.title ?? info?.label ?? run.analysis_type}
                </p>
                <span className={`text-[10px] font-bold uppercase tracking-widest shrink-0 ${status.iconClass}`}>
                  {status.label}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs text-muted-foreground">{info?.label ?? run.analysis_type.replace(/_/g, ' ')}</span>
                {run.dataset && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Database className="h-3 w-3" />
                    {(run.dataset as { name: string }).name}
                  </span>
                )}
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {formatRelative(run.created_at)}
                </span>
              </div>
            </div>

            {/* Key metrics inline */}
            {keyPairs.length > 0 && run.status === 'completed' && (
              <div className="hidden md:flex items-center gap-4 shrink-0">
                {keyPairs.slice(0, 3).map(([key, val]) => (
                  <div key={key} className="text-right">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{formatKey(key)}</p>
                    <p className="text-sm font-bold text-foreground">{String(val)}</p>
                  </div>
                ))}
              </div>
            )}

            <ArrowRight className="h-4 w-4 text-muted-foreground/0 group-hover:text-primary shrink-0 transition-all" />
          </div>
        </div>
      </Link>

      {onDelete && (
        <DeleteButton
          confirming={confirming}
          setConfirming={setConfirming}
          onDelete={() => onDelete(run.id)}
          position="right-3 top-3"
        />
      )}
    </div>
  )
}

// ── Delete Button ──────────────────────────────────────────
function DeleteButton({ confirming, setConfirming, onDelete, position = 'right-2 top-2' }: {
  confirming: boolean; setConfirming: (v: boolean) => void; onDelete: () => void; position?: string
}) {
  return (
    <div className={`absolute ${position} flex items-center gap-1 z-10`}>
      {confirming ? (
        <>
          <span className="text-[11px] text-red-600 font-medium mr-1">Delete?</span>
          <button
            onClick={e => { e.preventDefault(); e.stopPropagation(); onDelete(); setConfirming(false) }}
            className="flex items-center justify-center h-6 w-6 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
            title="Confirm delete"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={e => { e.preventDefault(); e.stopPropagation(); setConfirming(false) }}
            className="flex items-center justify-center h-6 w-6 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
            title="Cancel"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </>
      ) : (
        <button
          onClick={e => { e.preventDefault(); e.stopPropagation(); setConfirming(true) }}
          className="flex items-center justify-center h-7 w-7 rounded-lg opacity-0 group-hover:opacity-100 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all"
          title="Delete analysis"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
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
