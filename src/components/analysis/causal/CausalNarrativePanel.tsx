'use client'

/**
 * CausalNarrativePanel — inline narrative preview + push to document editor.
 */

import { useState } from 'react'
import { FileText, Copy, CheckCheck, Loader2, Send } from 'lucide-react'
import type { NarrativeResult } from '@/types/causalEstimation'

interface CausalNarrativePanelProps {
  narrative: NarrativeResult
  projectId: string
  onPushToDocument: (narrativeId: string, documentId: string) => Promise<boolean>
}

export function CausalNarrativePanel({
  narrative,
  projectId,
  onPushToDocument,
}: CausalNarrativePanelProps) {
  const [copied, setCopied] = useState(false)
  const [showPush, setShowPush] = useState(false)
  const [documentId, setDocumentId] = useState('')
  const [pushing, setPushing] = useState(false)
  const [pushed, setPushed] = useState(false)
  const [pushError, setPushError] = useState<string | null>(null)

  const components = narrative.narrative_components

  const handleCopy = async () => {
    await navigator.clipboard.writeText(narrative.narrative_text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handlePush = async () => {
    if (!documentId || !narrative.narrative_id) return
    setPushing(true)
    setPushError(null)
    const ok = await onPushToDocument(narrative.narrative_id, documentId)
    setPushing(false)
    if (ok) {
      setPushed(true)
      setShowPush(false)
    } else {
      setPushError('Failed to push — check the document ID and try again.')
    }
  }

  return (
    <div className="space-y-4">
      {/* Meta row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-indigo-500" />
          <p className="text-xs font-semibold text-gray-700">Generated Results Paragraph</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            {copied ? <CheckCheck className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          {!pushed && narrative.narrative_id && (
            <button
              onClick={() => setShowPush((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 px-2.5 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors border border-indigo-200"
            >
              <Send className="w-3.5 h-3.5" />
              Push to document
            </button>
          )}
          {pushed && (
            <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
              <CheckCheck className="w-3.5 h-3.5" /> Pushed
            </span>
          )}
        </div>
      </div>

      {/* Narrative text */}
      <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 text-sm text-gray-800 leading-relaxed font-serif">
        {narrative.narrative_text}
      </div>

      {/* Push to document form */}
      {showPush && (
        <div className="bg-indigo-50 rounded-xl border border-indigo-100 p-4 space-y-3">
          <p className="text-xs font-semibold text-indigo-700">Push to document editor</p>
          <p className="text-xs text-indigo-600">
            Enter the document ID where this paragraph should be inserted.
          </p>
          <div className="flex gap-2">
            <input
              value={documentId}
              onChange={(e) => setDocumentId(e.target.value)}
              placeholder="Document ID (UUID)"
              className="flex-1 text-xs border border-indigo-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 font-mono"
            />
            <button
              onClick={handlePush}
              disabled={!documentId || pushing}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-xs font-medium rounded-lg transition-colors"
            >
              {pushing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Push
            </button>
          </div>
          {pushError && (
            <p className="text-xs text-red-600">{pushError}</p>
          )}
        </div>
      )}

      {/* Key components summary */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">Estimates used</p>
          <div className="space-y-1">
            <p><span className="text-gray-500">ATE:</span> <span className="font-mono font-semibold text-gray-800">{components.ate_formatted}</span></p>
            <p><span className="text-gray-500">CI:</span> <span className="font-mono text-gray-700">{components.ci_formatted}</span></p>
            <p><span className="text-gray-500">p-value:</span> <span className="font-mono text-gray-700">{components.p_formatted}</span></p>
            {components.evalue && (
              <p><span className="text-gray-500">E-value:</span> <span className="font-mono text-gray-700">{components.evalue}</span></p>
            )}
          </div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">Flags</p>
          <div className="space-y-1">
            <p className={components.is_significant ? 'text-emerald-600' : 'text-amber-600'}>
              {components.is_significant ? '✓ Statistically significant' : '⚠ Not significant'}
            </p>
            <p className={components.estimates_consistent ? 'text-emerald-600' : 'text-amber-600'}>
              {components.estimates_consistent ? '✓ Methods consistent' : '⚠ Methods inconsistent'}
            </p>
          </div>
          {components.warnings.length > 0 && (
            <div className="mt-2 space-y-0.5">
              {components.warnings.slice(0, 2).map((w, i) => (
                <p key={i} className="text-amber-600 text-[10px]">⚠ {w.slice(0, 60)}{w.length > 60 ? '…' : ''}</p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
