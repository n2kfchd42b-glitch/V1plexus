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
      className="rounded-2xl bg-white relative overflow-hidden"
      style={{ boxShadow: '0 20px 50px rgba(0,24,72,0.04), 0 4px 12px rgba(0,24,72,0.03)' }}
    >
      {/* 3px left accent bar — the one justified vertical line in the system */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ background: 'linear-gradient(180deg, #003d9b, #0052cc)' }}
      />

      <div className="px-5 py-4 pl-6">

        {/* Section tag */}
        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#0040a2] font-manrope mb-3">
          Key Finding
        </p>

        {/* LAYER 1 — one-sentence headline */}
        <p className="font-manrope font-semibold text-[0.9375rem] leading-snug text-[#18181B] mb-2">
          {output.headline}
        </p>

        {/* LAYER 2 — interpretation paragraph */}
        <p className="text-[0.8125rem] leading-[1.7] text-[#52525B] mb-3">
          {output.paragraph}
        </p>

        {/* LAYER 3 — limitation flag (conditional) */}
        {output.limitationFlag && (
          <div
            className="mb-3 px-3 py-2 rounded-lg"
            style={{ background: 'rgba(180,83,9,0.08)' }}
          >
            <p className="text-[11px] text-[#92400E] leading-snug">
              {output.limitationFlag}
            </p>
          </div>
        )}

        {/* Action row */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleCopy}
            className="text-[11px] font-semibold text-[#0052cc] hover:text-[#003d9b] transition-colors"
          >
            {copied ? '✓ Copied' : 'Copy for Report'}
          </button>
          <button
            onClick={() => setMethodsOpen(v => !v)}
            className="text-[11px] font-semibold text-[#A1A1AA] hover:text-[#52525B] transition-colors"
          >
            {methodsOpen ? 'Hide Methods' : 'Expand to Methods'}
          </button>
        </div>

        {/* Inline methods expand */}
        {methodsOpen && (
          <div className="mt-3 pt-3 border-t border-[#f2f4f6]">
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#A1A1AA] font-manrope mb-2">
              Statistical Methods
            </p>
            <p className="text-[0.75rem] leading-[1.7] text-[#52525B]">
              {output.methodsParagraph}
            </p>
          </div>
        )}

      </div>
    </div>
  )
}
