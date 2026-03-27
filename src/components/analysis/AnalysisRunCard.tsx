"use client"

import { useState } from 'react'
import Link from 'next/link'
import {
  Clock, Database, Trash2, X, Check,
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
    iconClass: 'text-[#22C55E]',
    labelClass: 'text-[#166534]',
    badgeClass: 'bg-[#F0FDF4] text-[#166534]',
  },
  failed: {
    icon: AlertCircle,
    label: 'Failed',
    iconClass: 'text-[#EF4444]',
    labelClass: 'text-[#991B1B]',
    badgeClass: 'bg-[#FEF2F2] text-[#991B1B]',
  },
  running: {
    icon: Loader2,
    label: 'Running',
    iconClass: 'text-[#3B82F6]',
    labelClass: 'text-[#1E40AF]',
    badgeClass: 'bg-[#EFF6FF] text-[#1E40AF]',
  },
  pending: {
    icon: Clock,
    label: 'Pending',
    iconClass: 'text-[#A1A1AA]',
    labelClass: 'text-[#52525B]',
    badgeClass: 'bg-[#F0F0F0] text-[#52525B]',
  },
  cancelled: {
    icon: X,
    label: 'Cancelled',
    iconClass: 'text-[#A1A1AA]',
    labelClass: 'text-[#52525B]',
    badgeClass: 'bg-[#F0F0F0] text-[#52525B]',
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
        <div className="bg-white border border-[#E4E4E7] rounded-lg transition-all duration-150 hover:shadow-[0_4px_16px_rgba(0,82,204,0.07)] cursor-pointer h-full">
          <div className="p-4">
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className={`rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${status.badgeClass}`}>
                {status.label}
              </div>
              <StatusIcon className={`h-4 w-4 shrink-0 ${status.iconClass} ${run.status === 'running' ? 'animate-spin' : ''}`} />
            </div>

            {/* Title */}
            <h4 className="font-manrope font-bold text-sm text-[#18181B] truncate group-hover:text-[#0052CC] transition-colors duration-150">
              {run.title ?? info?.label ?? run.analysis_type}
            </h4>
            <p className="text-xs text-[#A1A1AA] mt-0.5 truncate">
              {info?.label ?? run.analysis_type.replace(/_/g, ' ')}
            </p>

            {/* Key Metrics */}
            {keyPairs.length > 0 && run.status === 'completed' && (
              <div className="mt-3 grid grid-cols-2 gap-1.5">
                {keyPairs.map(([key, val]) => (
                  <div key={key} className="bg-[#F0F0F0] rounded-md px-2 py-1.5">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-[#A1A1AA] truncate">
                      {formatKey(key)}
                    </p>
                    <p className="text-xs font-manrope font-bold text-[#18181B] truncate">{String(val)}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#F0F0F0]">
              <div className="flex items-center gap-3 min-w-0">
                {run.dataset && (
                  <span className="flex items-center gap-1 text-xs text-[#A1A1AA] truncate">
                    <Database className="h-3 w-3 shrink-0" />
                    <span className="truncate">{(run.dataset as { name: string }).name}</span>
                  </span>
                )}
                <span className="flex items-center gap-1 text-xs text-[#A1A1AA] shrink-0">
                  <Clock className="h-3 w-3" />
                  {formatRelative(run.created_at)}
                </span>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-transparent group-hover:text-[#0052CC] transition-all duration-150" />
            </div>
          </div>
        </div>
      </Link>

      {onDelete && (
        <DeleteButton confirming={confirming} setConfirming={setConfirming} onDelete={() => onDelete(run.id)} />
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
        <div className="bg-white border border-[#E4E4E7] rounded-lg transition-all duration-150 hover:shadow-[0_4px_12px_rgba(0,82,204,0.06)] cursor-pointer">
          <div className="flex items-center gap-4 p-4">
            <StatusIcon className={`h-4 w-4 shrink-0 ${status.iconClass} ${run.status === 'running' ? 'animate-spin' : ''}`} />

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-manrope font-bold text-[#18181B] truncate group-hover:text-[#0052CC] transition-colors duration-150">
                  {run.title ?? info?.label ?? run.analysis_type}
                </p>
                <span className={`text-[10px] font-bold uppercase tracking-widest shrink-0 px-1.5 py-0.5 rounded ${status.badgeClass}`}>
                  {status.label}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-xs text-[#A1A1AA]">{info?.label ?? run.analysis_type.replace(/_/g, ' ')}</span>
                {run.dataset && (
                  <span className="flex items-center gap-1 text-xs text-[#A1A1AA]">
                    <Database className="h-3 w-3" />
                    {(run.dataset as { name: string }).name}
                  </span>
                )}
                <span className="flex items-center gap-1 text-xs text-[#A1A1AA]">
                  <Clock className="h-3 w-3" />
                  {formatRelative(run.created_at)}
                </span>
              </div>
            </div>

            {keyPairs.length > 0 && run.status === 'completed' && (
              <div className="hidden md:flex items-center gap-4 shrink-0">
                {keyPairs.slice(0, 3).map(([key, val]) => (
                  <div key={key} className="text-right">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-[#A1A1AA]">{formatKey(key)}</p>
                    <p className="text-sm font-manrope font-bold text-[#18181B]">{String(val)}</p>
                  </div>
                ))}
              </div>
            )}

            <ArrowRight className="h-4 w-4 text-transparent group-hover:text-[#0052CC] shrink-0 transition-all duration-150" />
          </div>
        </div>
      </Link>

      {onDelete && (
        <DeleteButton confirming={confirming} setConfirming={setConfirming} onDelete={() => onDelete(run.id)} position="right-3 top-3" />
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
          <span className="text-[11px] text-[#991B1B] font-medium mr-1">Delete?</span>
          <button
            onClick={e => { e.preventDefault(); e.stopPropagation(); onDelete(); setConfirming(false) }}
            className="flex items-center justify-center h-6 w-6 rounded-md bg-[#FEF2F2] text-[#EF4444] hover:bg-red-100 transition-colors duration-150"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={e => { e.preventDefault(); e.stopPropagation(); setConfirming(false) }}
            className="flex items-center justify-center h-6 w-6 rounded-md bg-[#F0F0F0] text-[#52525B] hover:bg-[#E4E4E7] transition-colors duration-150"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </>
      ) : (
        <button
          onClick={e => { e.preventDefault(); e.stopPropagation(); setConfirming(true) }}
          className="flex items-center justify-center h-7 w-7 rounded-md opacity-0 group-hover:opacity-100 text-[#A1A1AA] hover:bg-[#FEF2F2] hover:text-[#EF4444] transition-all duration-150"
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
