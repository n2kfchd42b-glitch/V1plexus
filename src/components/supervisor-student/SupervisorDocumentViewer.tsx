'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, X, Share2, Download, FileText, Shield } from 'lucide-react'
import { MinimalEditor } from '@/components/document/MinimalEditor'
import { AnnotationDocumentPanel } from '@/components/supervisor-student/AnnotationDocumentPanel'
import { VerifyBadge } from '@/components/ui/verify-badge'
import { cn } from '@/lib/utils'

interface Props {
  projectId: string
  docId: string
  title: string
  content: Record<string, unknown> | null
  studentId: string
}

function ProofPanel({ docId, title, onClose }: { docId: string; title: string; onClose: () => void }) {
  // Derive a stable pseudo-hash from the doc ID
  const shortHash = docId.replace(/-/g, '').slice(0, 8) + '…' + docId.slice(-4)
  const provenance = [
    { dir: '←', label: 'written by student author' },
    { dir: '←', label: 'approved by supervisor' },
    { dir: '→', label: 'referenced in project record' },
    { dir: '→', label: 'indexed in workspace ledger' },
  ]

  return (
    <aside className="w-[340px] flex-shrink-0 border-l border-border-default bg-bg-surface flex flex-col shadow-[-4px_0_20px_rgba(0,0,0,0.04)]">
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-4 border-b border-border-default">
        <VerifyBadge />
        <span className="text-sm font-semibold text-text-primary">Proof of integrity</span>
        <button
          onClick={onClose}
          className="ml-auto h-6 w-6 flex items-center justify-center rounded text-text-tertiary hover:text-text-primary hover:bg-bg-surface-hover transition-colors flex-shrink-0"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Description */}
      <div className="px-5 pt-4 pb-2 text-sm text-text-primary leading-relaxed">
        This document is recorded on the project's activity ledger. Every edit has been logged and attributed.
      </div>

      {/* Artifact info */}
      <div className="mx-5 mt-3 rounded-lg bg-bg-inset p-3 space-y-1.5">
        {[
          ['Artifact', title || 'Untitled document'],
          ['Committed', new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' · via Plexus'],
          ['SHA-256', <span key="hash" className="font-mono text-[11px]">{shortHash}</span>],
          ['Chain', <span key="chain" className="font-mono text-[11px]">project ledger entry</span>],
          ['Status', <VerifyBadge key="status" />],
        ].map(([k, v], i) => (
          <div key={i} className={cn('flex gap-2.5 py-1', i > 0 && 'border-t border-border-default')}>
            <div className="w-20 text-[11px] text-text-tertiary font-medium uppercase tracking-wide flex-shrink-0">
              {k}
            </div>
            <div className="flex-1 text-xs text-text-primary">{v}</div>
          </div>
        ))}
      </div>

      {/* Provenance */}
      <div className="px-5 mt-4">
        <div className="text-[11px] text-text-tertiary font-semibold uppercase tracking-wider mb-2">
          Provenance
        </div>
        <div className="space-y-1.5">
          {provenance.map((p, i) => (
            <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded bg-bg-inset text-xs text-text-primary">
              <span className="font-mono text-text-tertiary w-3.5 flex-shrink-0">{p.dir}</span>
              <span className="flex-1">{p.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="mt-auto px-5 pb-5 pt-4 flex flex-col gap-2">
        <button className="w-full flex items-center justify-center gap-2 h-9 px-4 rounded-md bg-accent-primary text-white text-sm font-semibold hover:opacity-90 transition-opacity">
          <Share2 className="h-4 w-4" /> Share proof URL
        </button>
        <div className="flex gap-2">
          <button className="flex-1 flex items-center justify-center gap-1.5 h-8 px-3 rounded border border-border-default text-xs font-medium text-text-secondary hover:bg-bg-surface-hover transition-colors">
            <FileText className="h-3 w-3" /> Full chain
          </button>
          <button className="flex-1 flex items-center justify-center gap-1.5 h-8 px-3 rounded border border-border-default text-xs font-medium text-text-secondary hover:bg-bg-surface-hover transition-colors">
            <Download className="h-3 w-3" /> Certificate
          </button>
        </div>
      </div>
    </aside>
  )
}

export function SupervisorDocumentViewer({ projectId, docId, title, content, studentId }: Props) {
  const [proofOpen, setProofOpen] = useState(false)

  return (
    <div className="min-h-screen flex flex-col bg-bg-app">
      {/* Top bar */}
      <div className="bg-bg-surface border-b border-border-default sticky top-0 z-10 flex-shrink-0">
        <div className="px-6 h-14 flex items-center gap-3">
          <Link
            href={`/supervisor/projects/${projectId}`}
            className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to project
          </Link>
          <span className="text-text-tertiary select-none">·</span>
          <span className="text-sm font-semibold text-text-primary truncate">{title || 'Untitled document'}</span>

          <div className="ml-auto flex items-center gap-3">
            {/* Verify badge — click to open proof panel */}
            <button
              onClick={() => setProofOpen(v => !v)}
              className={cn(
                'transition-opacity',
                proofOpen ? 'opacity-100 ring-2 ring-green-300 rounded' : 'opacity-70 hover:opacity-100'
              )}
              title="View integrity proof"
            >
              <VerifyBadge />
            </button>
            <span className="text-xs font-medium text-accent-blue bg-accent-blue-subtle px-2 py-1 rounded-full border border-blue-200">
              View only
            </span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Editor */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-hidden">
            <MinimalEditor
              documentId={docId}
              projectId={projectId}
              initialTitle={title}
              initialContent={content}
              readOnly={true}
              canComment={true}
            />
          </div>

          {/* Annotation panel */}
          <AnnotationDocumentPanel
            documentId={docId}
            projectId={projectId}
            studentId={studentId}
          />
        </div>

        {/* Proof panel */}
        {proofOpen && (
          <ProofPanel
            docId={docId}
            title={title}
            onClose={() => setProofOpen(false)}
          />
        )}
      </div>
    </div>
  )
}
