'use client'

import { useState } from 'react'
import { generatePlainLanguageSummary } from '@/lib/analysis/plainLanguage'
import type { AnalysisRun } from '@/types/database'
import type { AnalysisResult } from '@/lib/analysis/types'

interface Props {
  run: AnalysisRun
  result: AnalysisResult
}

export function KeyFindingCard({ run, result }: Props) {
  const [copied, setCopied]       = useState(false)
  const [methodsOpen, setMethodsOpen] = useState(false)

  const datasetName = (run as AnalysisRun & { dataset?: { name: string } | null })
    .dataset?.name ?? 'the dataset'

  const output = generatePlainLanguageSummary(result, run.analysis_type, datasetName)

  const handleCopy = () => {
    const typeLabel = run.analysis_type.replace(/_/g, ' ')
    const date      = new Date(run.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    const text      = `${typeLabel} (${date}): ${output.paragraph}`
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div
      className="rounded-2xl relative overflow-hidden"
      style={{
        background: 'linear-gradient(315deg, #001a5c 0%, #003d9b 60%, #0052cc 100%)',
        boxShadow: '0 20px 50px rgba(0,24,72,0.12)',
      }}
    >
      {/* Decorative ambient circles */}
      <div
        className="absolute -right-6 -top-6 w-28 h-28 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.07), transparent)' }}
      />
      <div
        className="absolute right-10 -bottom-8 w-20 h-20 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.04), transparent)' }}
      />

      <div className="px-5 py-5 relative z-10">

        {/* Section tag */}
        <p className="text-[9px] font-bold uppercase tracking-[0.16em] font-manrope mb-3"
          style={{ color: 'rgba(255,255,255,0.4)' }}>
          Key Finding
        </p>

        {/* LAYER 1 — one-sentence headline */}
        <p className="font-manrope font-bold text-[0.9375rem] leading-snug text-white mb-2">
          {output.headline}
        </p>

        {/* LAYER 2 — interpretation paragraph */}
        <p className="text-[0.8125rem] leading-[1.7] mb-3"
          style={{ color: 'rgba(255,255,255,0.72)' }}>
          {output.paragraph}
        </p>

        {/* LAYER 3 — limitation flag (conditional) */}
        {output.limitationFlag && (
          <div
            className="mb-3 px-3 py-2 rounded-lg"
            style={{ background: 'rgba(251,191,36,0.14)' }}
          >
            <p className="text-[11px] leading-snug" style={{ color: 'rgba(253,224,71,0.9)' }}>
              {output.limitationFlag}
            </p>
          </div>
        )}

        {/* Action row */}
        <div className="flex items-center gap-4 pt-1 border-t" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
          <button
            onClick={handleCopy}
            className="text-[11px] font-semibold transition-colors mt-3"
            style={{ color: copied ? 'rgba(134,239,172,0.9)' : 'rgba(255,255,255,0.55)' }}
            onMouseOver={e => { if (!copied) (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.9)' }}
            onMouseOut={e => { if (!copied) (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.55)' }}
          >
            {copied ? '✓ Copied' : 'Copy for Report'}
          </button>
          <button
            onClick={() => setMethodsOpen(v => !v)}
            className="text-[11px] font-semibold transition-colors mt-3"
            style={{ color: 'rgba(255,255,255,0.35)' }}
            onMouseOver={e => (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.7)'}
            onMouseOut={e => (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.35)'}
          >
            {methodsOpen ? 'Hide Methods' : 'Expand to Methods'}
          </button>
        </div>

        {/* Inline methods expand */}
        {methodsOpen && (
          <div className="mt-3 pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] font-manrope mb-2"
              style={{ color: 'rgba(255,255,255,0.3)' }}>
              Statistical Methods
            </p>
            <p className="text-[0.75rem] leading-[1.7]"
              style={{ color: 'rgba(255,255,255,0.55)' }}>
              {output.methodsParagraph}
            </p>
          </div>
        )}

      </div>
    </div>
  )
}
