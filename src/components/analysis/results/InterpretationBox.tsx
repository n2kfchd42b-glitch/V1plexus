"use client"

import { useState } from 'react'
import { Lightbulb, ChevronDown, ChevronUp, FlaskConical } from 'lucide-react'

interface Props {
  plainLanguage?: string
  text: string  // technical statistical summary
}

export function InterpretationBox({ plainLanguage, text }: Props) {
  const [showTechnical, setShowTechnical] = useState(false)

  return (
    <div className="space-y-2">
      {/* Plain language summary — always shown */}
      {plainLanguage && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30 p-3">
          <div className="flex items-start gap-2">
            <Lightbulb className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-blue-800 dark:text-blue-300 mb-1">Plain Language Summary</p>
              <p className="text-xs text-blue-900 dark:text-blue-200 leading-relaxed">{plainLanguage}</p>
            </div>
          </div>
        </div>
      )}

      {/* Technical statistical summary — collapsible */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
        <button
          onClick={() => setShowTechnical(v => !v)}
          className="w-full flex items-center justify-between p-3 text-left"
        >
          <div className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">
              Statistical Summary
            </span>
          </div>
          {showTechnical
            ? <ChevronUp className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            : <ChevronDown className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />}
        </button>
        {showTechnical && (
          <div className="px-3 pb-3">
            <p className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">{text}</p>
          </div>
        )}
      </div>
    </div>
  )
}
