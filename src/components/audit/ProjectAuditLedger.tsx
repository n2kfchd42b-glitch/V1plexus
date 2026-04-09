"use client"

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AuditLogViewer } from './AuditLogViewer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ShieldCheck, Loader2, Clock, Hash, User,
  BookOpen, FolderOpen, CheckCircle2, AlertTriangle,
} from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import type { AuditLog } from '@/types/database'

interface GenesisBlock {
  id: string
  timestamp: string
  actor_id: string | null
  actor: { full_name: string | null } | null
  project_chain_entry_hash: string | null
  details: Record<string, unknown>
}

interface LedgerStats {
  total: number
  genesis: GenesisBlock | null
  latest_hash: string | null
  latest_timestamp: string | null
}

interface ProjectAuditLedgerProps {
  projectId: string
  projectTitle: string
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export function ProjectAuditLedger({ projectId, projectTitle }: ProjectAuditLedgerProps) {
  const supabase = createClient()
  const [stats, setStats] = useState<LedgerStats | null>(null)
  const [loadingStats, setLoadingStats] = useState(true)
  const [verifyStatus, setVerifyStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle')
  const [verifyDetail, setVerifyDetail] = useState<{ total: number; violations: number } | null>(null)

  const loadStats = useCallback(async () => {
    setLoadingStats(true)
    const [
      { count },
      { data: genesis },
      { data: latest },
    ] = await Promise.all([
      supabase
        .from('audit_logs')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId),
      supabase
        .from('audit_logs')
        .select('id, timestamp, actor_id, actor:profiles(full_name), project_chain_entry_hash, details')
        .eq('project_id', projectId)
        .order('timestamp', { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('audit_logs')
        .select('project_chain_entry_hash, timestamp')
        .eq('project_id', projectId)
        .not('project_chain_entry_hash', 'is', null)
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    setStats({
      total: count ?? 0,
      genesis: genesis as GenesisBlock | null,
      latest_hash: latest?.project_chain_entry_hash ?? null,
      latest_timestamp: latest?.timestamp ?? null,
    })
    setLoadingStats(false)
  }, [supabase, projectId])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  const verifyChain = async () => {
    setVerifyStatus('checking')
    setVerifyDetail(null)
    try {
      // Fetch all project entries in chronological order
      const { data: entries } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('project_id', projectId)
        .not('project_chain_entry_hash', 'is', null)
        .order('timestamp', { ascending: true })

      if (!entries || entries.length === 0) {
        setVerifyStatus('valid')
        setVerifyDetail({ total: 0, violations: 0 })
        return
      }

      let violations = 0
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i] as AuditLog & {
          project_chain_prev_hash: string | null
          project_chain_entry_hash: string | null
        }
        const details = (entry.details ?? {}) as Record<string, unknown>
        const detailsJson = JSON.stringify(details, Object.keys(details).sort())
        const expectedPrev = i === 0 ? null : (entries[i - 1] as typeof entry).project_chain_entry_hash
        // Normalise timestamp: Postgres TIMESTAMPTZ returns "...+00:00" with
        // microseconds, but the hash was computed from new Date().toISOString()
        // which produces "...Z". Re-parse to align the format.
        const normalizedTimestamp = new Date(entry.timestamp).toISOString()

        const canonical = [
          'PROJECT',
          normalizedTimestamp,
          entry.actor_id ?? '',
          entry.action,
          entry.resource_type,
          entry.resource_id,
          detailsJson,
          expectedPrev ?? 'PROJECT_GENESIS',
        ].join('|')

        const computed = await sha256(canonical)

        if (computed !== entry.project_chain_entry_hash) { violations++; continue }
        if (entry.project_chain_prev_hash !== expectedPrev) { violations++ }
      }

      setVerifyDetail({ total: entries.length, violations })
      setVerifyStatus(violations === 0 ? 'valid' : 'invalid')
    } catch {
      setVerifyStatus('invalid')
    }
  }

  return (
    <div className="space-y-6">

      {/* ── Ledger Header ── */}
      <div className="bg-gradient-to-br from-[#001a4d] to-[#003d9b] rounded-xl p-6 text-white shadow-xl shadow-[#003d9b]/20">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-blue-200/70 text-xs font-bold uppercase tracking-widest mb-2">
              <BookOpen className="h-3.5 w-3.5" />
              Immutable Audit Ledger
            </div>
            <h2 className="text-2xl font-bold font-manrope">{projectTitle}</h2>
            <p className="text-blue-200/60 text-sm">
              Every action in this project is cryptographically chained — entries cannot be altered or deleted.
            </p>
          </div>

          {/* Chain verification button */}
          <div className="shrink-0">
            {verifyStatus === 'idle' && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 bg-white/10 border-white/20 text-white hover:bg-white/20"
                onClick={verifyChain}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Verify Chain
              </Button>
            )}
            {verifyStatus === 'checking' && (
              <Badge className="gap-1.5 text-xs bg-white/10 border-white/20 text-white border">
                <Loader2 className="h-3 w-3 animate-spin" />
                Verifying…
              </Badge>
            )}
            {verifyStatus === 'valid' && (
              <div className="flex flex-col items-end gap-1">
                <Badge className="gap-1.5 text-xs text-green-300 bg-green-900/30 border-green-400/30 border">
                  <CheckCircle2 className="h-3 w-3" />
                  Chain Intact
                </Badge>
                {verifyDetail && (
                  <span className="text-[10px] text-blue-200/50">
                    {verifyDetail.total} entries verified
                  </span>
                )}
              </div>
            )}
            {verifyStatus === 'invalid' && (
              <div className="flex flex-col items-end gap-1">
                <Badge className="gap-1.5 text-xs text-red-300 bg-red-900/30 border-red-400/30 border">
                  <AlertTriangle className="h-3 w-3" />
                  {verifyDetail?.violations ?? '?'} Violation{(verifyDetail?.violations ?? 0) !== 1 ? 's' : ''}
                </Badge>
                <span className="text-[10px] text-blue-200/50">
                  Chain integrity compromised
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mt-6 border-t border-white/10 pt-5">
          <div className="space-y-0.5">
            <p className="text-[10px] font-bold text-blue-200/50 uppercase tracking-widest">Total Entries</p>
            <p className="text-3xl font-bold font-manrope">
              {loadingStats ? '—' : (stats?.total ?? 0)}
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] font-bold text-blue-200/50 uppercase tracking-widest">Ledger Opened</p>
            <p className="text-sm font-medium text-blue-100">
              {loadingStats ? '—' : stats?.genesis ? formatDateTime(stats.genesis.timestamp) : 'No entries yet'}
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] font-bold text-blue-200/50 uppercase tracking-widest">Chain Head</p>
            <p className="text-[11px] font-mono text-blue-200/60 truncate">
              {loadingStats ? '—' : stats?.latest_hash ? `#${stats.latest_hash.slice(0, 20)}…` : 'No chained entries'}
            </p>
          </div>
        </div>
      </div>

      {/* ── Genesis Block ── */}
      {!loadingStats && stats?.genesis && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 bg-slate-50 border-b border-slate-100">
            <FolderOpen className="h-4 w-4 text-[#003d9b]" />
            <span className="text-sm font-bold text-slate-700">Genesis Block</span>
            <Badge className="ml-auto text-[10px] text-[#003d9b] bg-blue-50 border-blue-200 border">
              Block #0 · PROJECT_GENESIS
            </Badge>
          </div>
          <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-full bg-[#003d9b]/10 flex items-center justify-center shrink-0">
                <Clock className="h-4 w-4 text-[#003d9b]" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Created</p>
                <p className="text-sm font-medium text-slate-700">{formatDateTime(stats.genesis.timestamp)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-full bg-[#003d9b]/10 flex items-center justify-center shrink-0">
                <User className="h-4 w-4 text-[#003d9b]" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Created By</p>
                <p className="text-sm font-medium text-slate-700">
                  {stats.genesis.actor?.full_name ?? stats.genesis.actor_id?.slice(0, 8) ?? 'Unknown'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-full bg-[#003d9b]/10 flex items-center justify-center shrink-0">
                <Hash className="h-4 w-4 text-[#003d9b]" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Genesis Hash</p>
                <p className="text-[11px] font-mono text-slate-500 truncate">
                  {stats.genesis.project_chain_entry_hash
                    ? `#${stats.genesis.project_chain_entry_hash.slice(0, 32)}…`
                    : 'Pre-chain entry'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Full Project Log ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-base font-bold text-slate-800">Project Audit Trail</h3>
          <Badge variant="outline" className="text-[10px] text-slate-500 border-slate-200">
            All operations · Chronological
          </Badge>
        </div>
        <AuditLogViewer projectId={projectId} />
      </div>

    </div>
  )
}
