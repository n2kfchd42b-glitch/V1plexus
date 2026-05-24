'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import {
  ArrowLeft, AlertTriangle, RefreshCw, Clock,
  Shield, CheckCircle2, FileDown, ExternalLink,
  Hash, GitBranch, Activity, Lock,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { buildResearchLogHtml } from '@/lib/audit/exportLedger'
import { cn, formatRelative } from '@/lib/utils'
import type { ChainVerificationResult, ChainViolation, AuditEntry } from '@/types/audit'

interface ProjectInfo {
  id: string
  title: string
  owner_id: string
  owner_name: string | null
}

const VIOLATION_LABELS: Record<ChainViolation['issue'], { label: string; icon: typeof Hash; tone: string }> = {
  hash_mismatch:     { label: 'Hash mismatch',          icon: Hash,       tone: 'red' },
  chain_broken:      { label: 'Chain broken',           icon: GitBranch,  tone: 'red' },
  missing_prev_hash: { label: 'Missing previous hash',  icon: AlertTriangle, tone: 'amber' },
}

export default function IntegrityPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const supabase = createClient()

  const [project, setProject]           = useState<ProjectInfo | null>(null)
  const [result, setResult]             = useState<ChainVerificationResult | null>(null)
  const [recentEntries, setRecentEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading]           = useState(true)
  const [verifying, setVerifying]       = useState(false)
  const [exporting, setExporting]       = useState(false)
  const [verifiedAt, setVerifiedAt]     = useState<Date | null>(null)
  const [error, setError]               = useState<string | null>(null)

  const verify = useCallback(async () => {
    setVerifying(true)
    setError(null)
    try {
      const res = await fetch(`/api/audit/verify?project_id=${encodeURIComponent(projectId)}`)
      if (!res.ok) throw new Error('Verification failed')
      const data = await res.json() as ChainVerificationResult
      setResult(data)
      setVerifiedAt(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification failed')
    } finally {
      setVerifying(false)
    }
  }, [projectId])

  useEffect(() => {
    const load = async () => {
      const [projRes, recentRes] = await Promise.all([
        supabase
          .from('projects')
          .select('id, title, owner_id, owner:profiles!owner_id(full_name)')
          .eq('id', projectId)
          .single(),
        fetch(`/api/audit?project_id=${encodeURIComponent(projectId)}&limit=10`),
      ])

      if (projRes.data) {
        const ownerRel = projRes.data.owner as unknown as { full_name: string | null } | { full_name: string | null }[] | null
        const owner = Array.isArray(ownerRel) ? ownerRel[0] ?? null : ownerRel
        setProject({
          id: projRes.data.id,
          title: projRes.data.title,
          owner_id: projRes.data.owner_id,
          owner_name: owner?.full_name ?? null,
        })
      }
      if (recentRes.ok) {
        const { entries } = await recentRes.json() as { entries: AuditEntry[] }
        setRecentEntries(entries)
      }
      await verify()
      setLoading(false)
    }
    load()
  }, [projectId, supabase, verify])

  const handleExport = async () => {
    if (!project) return
    setExporting(true)
    try {
      const { data } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('project_id', projectId)
        .order('timestamp', { ascending: false })
        .limit(1000)
      const html = buildResearchLogHtml(data ?? [], {
        projectId,
        subjectLabel: project.title,
        exportedAt: new Date().toISOString(),
      })
      const blob = new Blob([html], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-text-tertiary text-sm font-mono">
        Verifying integrity chain…
      </div>
    )
  }

  const verified = result?.verified ?? false
  const violations = result?.violations ?? []
  const totalEntries = result?.total_entries ?? 0
  const validEntries = result?.valid_entries ?? 0
  const firstEntry = result?.first_entry
  const lastEntry = result?.last_entry

  return (
    <div className="h-full overflow-y-auto px-8 py-6">
      <div className="max-w-5xl mx-auto">

        {/* Breadcrumb */}
        <Link
          href={`/supervisor/projects/${projectId}`}
          className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary mb-5 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to project
        </Link>

        {/* ── Hero ───────────────────────────────────────────────────────── */}
        {error ? (
          <div className="rounded-lg border border-red-300 bg-red-50 p-5 mb-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-700" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-800">Could not verify chain</p>
                <p className="text-xs text-red-700 mt-0.5">{error}</p>
              </div>
              <button
                onClick={verify}
                disabled={verifying}
                className="flex items-center gap-1.5 px-3 h-8 rounded-md bg-bg-surface border border-border-default text-xs font-semibold text-text-secondary hover:bg-bg-surface-hover transition-colors disabled:opacity-50"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', verifying && 'animate-spin')} />
                Retry
              </button>
            </div>
          </div>
        ) : verified ? (
          <div className="rounded-lg border border-green-300 border-l-4 border-l-green-600 bg-gradient-to-b from-green-50 to-white p-5 mb-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                <Shield className="h-5 w-5 text-green-700" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <h1 className="text-[22px] font-serif italic font-normal leading-tight text-green-800">
                    Chain intact
                  </h1>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-green-100 text-green-800 border border-green-200">
                    <CheckCircle2 className="h-3 w-3" /> Verified
                  </span>
                </div>
                <p className="text-sm text-text-primary leading-relaxed max-w-2xl">
                  All <strong>{totalEntries}</strong> ledger entries match their recorded hashes and the chain links are
                  contiguous. Every action {project?.owner_name ? `by ${project.owner_name}` : 'on this project'} can be
                  cryptographically traced back to its origin.
                </p>
              </div>
              <div className="flex-shrink-0 text-right">
                <div className="text-[10px] text-text-tertiary font-medium uppercase tracking-wide">Verified</div>
                <div className="text-sm font-mono text-text-primary mt-0.5">{verifiedAt ? formatRelative(verifiedAt.toISOString()) : '—'}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border-2 border-red-300 border-l-4 border-l-red-600 bg-gradient-to-b from-red-50 to-white p-5 mb-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-700" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-[22px] font-serif italic font-normal leading-tight text-red-800 mb-1.5">
                  Chain {result?.chain_intact ? 'has hash mismatches' : 'broken'}
                </h1>
                <p className="text-sm text-text-primary leading-relaxed max-w-2xl">
                  Found <strong>{violations.length}</strong> violation{violations.length === 1 ? '' : 's'} across
                  {' '}<strong>{totalEntries}</strong> ledger entries. {validEntries} entries verify cleanly; the
                  rest are listed below. This usually means audit rows were tampered with directly in the database.
                </p>
              </div>
              <div className="flex-shrink-0 text-right">
                <div className="text-[10px] text-text-tertiary font-medium uppercase tracking-wide">Detected</div>
                <div className="text-sm font-mono text-red-700 mt-0.5">{verifiedAt ? formatRelative(verifiedAt.toISOString()) : '—'}</div>
              </div>
            </div>
          </div>
        )}

        {/* ── Stat grid ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <Stat icon={Activity}  label="Entries"   value={totalEntries.toString()} />
          <Stat icon={CheckCircle2} label="Verified" value={`${validEntries} / ${totalEntries}`} tone={verified ? 'success' : 'warning'} />
          <Stat icon={Clock}     label="First entry" value={firstEntry ? format(new Date(firstEntry.timestamp), 'dd MMM yyyy') : '—'} />
          <Stat icon={Lock}      label="Last entry"  value={lastEntry  ? format(new Date(lastEntry.timestamp),  'dd MMM yyyy') : '—'} />
        </div>

        {/* ── Violations (when present) ──────────────────────────────────── */}
        {violations.length > 0 && (
          <section className="bg-bg-surface border border-red-200 rounded-lg overflow-hidden mb-6">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border-default bg-red-50/40">
              <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
              <span className="text-sm font-semibold text-text-primary">Violations</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-700">
                {violations.length}
              </span>
            </div>
            <div className="divide-y divide-border-subtle">
              {violations.map((v, i) => {
                const cfg = VIOLATION_LABELS[v.issue] ?? VIOLATION_LABELS.hash_mismatch
                const Icon = cfg.icon
                return (
                  <div key={`${v.entry_id}-${i}`} className="flex items-start gap-3 px-4 py-3.5">
                    <div className={cn(
                      'w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0',
                      cfg.tone === 'red' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                    )}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-text-primary">{cfg.label}</span>
                        <span className="font-mono text-[10px] text-text-tertiary">
                          {format(new Date(v.timestamp), 'dd MMM yyyy · HH:mm:ss')}
                        </span>
                      </div>
                      <p className="text-xs text-text-secondary mt-0.5 break-all">{v.detail}</p>
                      <p className="text-[10px] text-text-tertiary font-mono mt-1">entry {v.entry_id.slice(0, 8)}…</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ── Recent activity ────────────────────────────────────────────── */}
        {recentEntries.length > 0 && (
          <section className="bg-bg-surface border border-border-default rounded-lg overflow-hidden mb-6">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border-default">
              <Activity className="h-3.5 w-3.5 text-text-tertiary" />
              <span className="text-sm font-semibold text-text-primary">Recent activity</span>
              <span className="text-[11px] text-text-tertiary ml-auto">{recentEntries.length} of {totalEntries}</span>
            </div>
            <div className="divide-y divide-border-subtle max-h-80 overflow-y-auto">
              {recentEntries.map(e => {
                const violated = violations.some(v => v.entry_id === e.id)
                return (
                  <div key={e.id} className={cn(
                    'flex items-start gap-3 px-4 py-2.5',
                    violated && 'bg-red-50/40'
                  )}>
                    <div className={cn(
                      'w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0',
                      violated ? 'bg-red-500' : 'bg-green-500'
                    )} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-xs font-semibold text-text-primary truncate">{e.actor_name ?? 'Unknown'}</span>
                        <span className="text-xs text-text-secondary truncate">
                          {(e.details as { summary?: string })?.summary ?? e.action}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-[10px] text-text-tertiary">{formatRelative(e.timestamp)}</span>
                        <span className="font-mono text-[9px] text-text-tertiary/60">hash {e.entry_hash.slice(0, 10)}…</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ── Empty audit log ────────────────────────────────────────────── */}
        {totalEntries === 0 && !error && (
          <div className="rounded-lg border border-border-default bg-bg-surface p-8 text-center mb-6">
            <Activity className="h-8 w-8 text-text-tertiary mx-auto mb-2 opacity-40" />
            <p className="text-sm font-medium text-text-primary">No ledger entries yet</p>
            <p className="text-xs text-text-secondary mt-1 max-w-md mx-auto">
              The integrity chain becomes meaningful once {project?.owner_name ?? 'the student'} starts working —
              uploading data, running analyses, drafting documents.
            </p>
          </div>
        )}

        {/* ── Actions ────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={verify}
            disabled={verifying}
            className="flex items-center gap-1.5 h-9 px-4 rounded-md bg-bg-surface border border-border-default text-sm font-semibold text-text-secondary hover:bg-bg-surface-hover transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', verifying && 'animate-spin')} />
            {verifying ? 'Verifying…' : 'Re-verify chain'}
          </button>
          <button
            onClick={handleExport}
            disabled={exporting || totalEntries === 0}
            className="flex items-center gap-1.5 h-9 px-4 rounded-md bg-bg-surface border border-border-default text-sm font-semibold text-text-secondary hover:bg-bg-surface-hover transition-colors disabled:opacity-50"
          >
            <FileDown className="h-4 w-4" />
            {exporting ? 'Exporting…' : 'Export proof (HTML)'}
          </button>
          <Link
            href={`/supervisor/projects/${projectId}`}
            className="flex items-center gap-1.5 h-9 px-4 rounded-md text-sm font-medium text-text-secondary hover:bg-bg-surface-hover transition-colors ml-auto"
          >
            Open project artifacts
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* ── Footer reassurance ─────────────────────────────────────────── */}
        <div className="flex items-center gap-2.5 px-4 py-3 mt-4 bg-bg-inset rounded-lg text-xs text-text-secondary">
          <Shield className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
          Each entry's SHA-256 hash incorporates the previous entry's hash, so any tampering with a single row breaks
          the chain at that point and everything after it.
        </div>

      </div>
    </div>
  )
}

function Stat({ icon: Icon, label, value, tone = 'default' }: {
  icon: typeof Hash
  label: string
  value: string
  tone?: 'default' | 'success' | 'warning'
}) {
  const toneCls = tone === 'success' ? 'text-green-700'
                : tone === 'warning' ? 'text-amber-700'
                : 'text-text-primary'
  return (
    <div className="bg-bg-surface border border-border-default rounded-lg p-3.5">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-text-tertiary mb-1.5">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className={cn('text-lg font-bold font-mono tabular-nums', toneCls)}>{value}</div>
    </div>
  )
}
