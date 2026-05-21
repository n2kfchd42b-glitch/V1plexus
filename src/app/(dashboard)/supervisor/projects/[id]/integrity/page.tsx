'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, AlertTriangle, Eye, RotateCcw, Clock,
  FileText, BarChart2, BookOpen, Link2, Shield, CheckCircle2,
} from 'lucide-react'
import { VerifyBadge } from '@/components/ui/verify-badge'

const AFFECTED_FILE = {
  name: 'dataset_cleaned.csv',
  rows: '1,189 rows',
  size: '47 KB',
  recordedHash: '38c9 0a44 b1c8 2f01 …e221',
  currentHash:  '77a1 0044 dd33 8b9c …801f',
  lastAccess: '2 hours ago',
}

const DOWNSTREAM = [
  { name: 'mixed_effects_v2',  type: 'analysis',  meta: 'derived from this dataset',      icon: BarChart2 },
  { name: 'Figure 2',          type: 'figure',    meta: 'generated from mixed_effects_v2', icon: FileText },
  { name: '§Results',          type: 'manuscript', meta: 'cites Figure 2',                 icon: BookOpen },
]

const CONTEXT = [
  { k: 'Original commit',  v: 'Recorded by student', sub: 'via Plexus upload' },
  { k: 'Verified copy',    v: 'On this project',      sub: 'supervisor + student' },
  { k: 'Local edits',      v: 'Outside Plexus',       sub: 'no in-app changes recorded' },
  { k: 'Notification',     v: 'Sent',                 sub: 'supervisor notified' },
]

export default function IntegrityAlertPage() {
  const { id: projectId } = useParams<{ id: string }>()

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

        {/* Alert hero */}
        <div className="rounded-lg border-2 border-red-300 border-l-4 border-l-status-error bg-gradient-to-b from-red-50 to-white p-5 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-700" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-[24px] font-serif italic font-normal leading-tight text-red-800 mb-2">
                Chain integrity broken
              </h1>
              <p className="text-sm text-text-primary leading-relaxed max-w-2xl">
                A file in this project no longer matches its recorded hash on the ledger. This is usually local file
                corruption — but it could indicate the file was edited outside Plexus.{' '}
                <strong>Your verified copy is safe</strong>; it can be restored in one click.
              </p>
              <div className="flex gap-2.5 mt-4 flex-wrap">
                <button className="flex items-center gap-1.5 h-9 px-4 rounded-md bg-accent-primary text-white text-sm font-semibold hover:opacity-90 transition-opacity">
                  <CheckCircle2 className="h-4 w-4" /> Restore from ledger
                </button>
                <button className="flex items-center gap-1.5 h-9 px-4 rounded-md bg-bg-surface border border-border-default text-sm font-semibold text-text-secondary hover:bg-bg-surface-hover transition-colors">
                  <Eye className="h-4 w-4" /> Investigate
                </button>
                <button className="flex items-center gap-1.5 h-9 px-4 rounded-md text-sm font-medium text-text-secondary hover:bg-bg-surface-hover transition-colors">
                  <RotateCcw className="h-3.5 w-3.5" /> Re-commit current version
                </button>
              </div>
            </div>
            <div className="flex-shrink-0 text-right">
              <div className="text-[10px] text-text-tertiary font-medium uppercase tracking-wide">Detected</div>
              <div className="text-sm font-mono text-text-primary mt-0.5">just now</div>
              <div className="text-xs text-text-tertiary mt-1.5">auto-check · every 60s</div>
            </div>
          </div>
        </div>

        {/* Two-column: affected file + downstream */}
        <div className="grid grid-cols-[1.2fr_1fr] gap-4 mb-4">

          {/* Affected file */}
          <div className="bg-bg-surface border border-border-default rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3.5 border-b border-border-default">
              <FileText className="h-3.5 w-3.5 text-text-tertiary" />
              <span className="text-sm font-semibold text-text-primary">The affected file</span>
              <VerifyBadge variant="broken" />
            </div>
            <div className="p-4">
              {/* File header */}
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-md bg-bg-inset flex items-center justify-center font-mono text-[10px] text-text-tertiary font-semibold">
                  csv
                </div>
                <div>
                  <div className="text-sm font-semibold font-mono text-text-primary">{AFFECTED_FILE.name}</div>
                  <div className="text-[11px] text-text-tertiary mt-0.5">
                    {AFFECTED_FILE.rows} · {AFFECTED_FILE.size} · last verified 6 days ago
                  </div>
                </div>
              </div>

              {/* Hash diff */}
              <div className="rounded-md overflow-hidden border border-border-default">
                <div className="grid grid-cols-[84px_1fr] items-center px-3.5 py-2.5 bg-green-50 border-b border-border-default">
                  <span className="text-[10px] text-green-700 font-semibold uppercase tracking-wide">RECORDED</span>
                  <span className="font-mono text-xs text-text-primary">sha-256: {AFFECTED_FILE.recordedHash}</span>
                </div>
                <div className="grid grid-cols-[84px_1fr] items-center px-3.5 py-2.5 bg-red-50">
                  <span className="text-[10px] text-red-700 font-semibold uppercase tracking-wide">NOW READS</span>
                  <span className="font-mono text-xs text-red-700">{AFFECTED_FILE.currentHash} ≠</span>
                </div>
              </div>

              <p className="mt-3.5 text-xs text-text-secondary leading-relaxed">
                <strong>What changed:</strong> some rows have different values. File size may have changed.
              </p>

              <div className="mt-3.5 flex items-center gap-1.5 text-xs text-text-tertiary">
                <Clock className="h-3.5 w-3.5" />
                Last local access:{' '}
                <span className="font-mono text-text-primary">{AFFECTED_FILE.lastAccess}</span>
              </div>
            </div>
          </div>

          {/* Downstream impact */}
          <div className="bg-bg-surface border border-border-default rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3.5 border-b border-border-default">
              <Link2 className="h-3.5 w-3.5 text-text-tertiary" />
              <span className="text-sm font-semibold text-text-primary">Downstream impact</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200">
                {DOWNSTREAM.length} artifacts
              </span>
            </div>
            <div>
              {DOWNSTREAM.map((d, i) => (
                <div key={i} className="flex items-center gap-2.5 px-4 py-3.5 border-t first:border-t-0 border-border-subtle">
                  <span className="text-red-500 text-xs w-3 flex-shrink-0">↳</span>
                  <d.icon className="h-3.5 w-3.5 text-text-tertiary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-red-700 font-mono truncate">{d.name}</div>
                    <div className="text-[11px] text-text-tertiary mt-0.5">{d.meta}</div>
                  </div>
                  <VerifyBadge variant="broken" />
                </div>
              ))}
            </div>
            <div className="px-4 py-3 border-t border-border-default bg-bg-inset flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
              <span className="text-[11px] text-text-secondary">
                These will need re-validation after the source file is restored.
              </span>
            </div>
          </div>
        </div>

        {/* Context block */}
        <div className="bg-bg-surface border border-border-default rounded-lg overflow-hidden mb-4">
          <div className="flex items-center gap-2 px-4 py-3.5 border-b border-border-default">
            <Shield className="h-3.5 w-3.5 text-text-tertiary" />
            <span className="text-sm font-semibold text-text-primary">Context · what the ledger knows</span>
          </div>
          <div className="px-5 py-5 grid grid-cols-2 sm:grid-cols-4 gap-5">
            {CONTEXT.map((s, i) => (
              <div key={i}>
                <div className="text-[10px] text-text-tertiary font-medium uppercase tracking-wide">{s.k}</div>
                <div className="text-sm font-semibold text-text-primary mt-1">{s.v}</div>
                <div className="text-[11px] text-text-secondary mt-0.5">{s.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Reassurance footer */}
        <div className="flex items-center gap-2.5 px-4 py-3 bg-bg-inset rounded-lg text-xs text-text-secondary">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
          The ledger itself is intact. Only the local copy of this file has diverged. Restoring it puts everything back in sync.
        </div>

      </div>
    </div>
  )
}
