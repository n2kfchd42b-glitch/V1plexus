"use client"

import { useState } from 'react'
import { Lightbulb, ChevronDown, ChevronUp, FlaskConical, Sparkles } from 'lucide-react'

interface Props {
  plainLanguage?: string
  text: string  // technical statistical summary
}

export function InterpretationBox({ plainLanguage, text }: Props) {
  const [showTechnical, setShowTechnical] = useState(false)

  return (
    <div className="space-y-3">
      {/* Plain language summary — always shown prominently */}
      {plainLanguage && (
        <div className="relative overflow-hidden rounded-2xl border border-blue-200/60 bg-gradient-to-br from-blue-50 via-white to-indigo-50/30 dark:border-blue-900 dark:bg-blue-950/30 p-6">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-blue-100/40 to-transparent rounded-bl-full" />
          <div className="relative flex items-start gap-3">
            <div className="rounded-xl bg-blue-100 p-2.5 shrink-0">
              <Lightbulb className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <p className="text-xs font-bold uppercase tracking-widest text-blue-700 dark:text-blue-300">
                  Plain Language Summary
                </p>
                <Sparkles className="h-3 w-3 text-blue-400" />
              </div>
              <p className="text-sm text-blue-900 dark:text-blue-200 leading-relaxed">{plainLanguage}</p>
            </div>
          </div>
        </div>
      )}

      {/* Technical statistical summary — collapsible */}
      {text && (
        <div className="rounded-2xl border border-amber-200/60 bg-gradient-to-br from-amber-50 via-white to-orange-50/20 dark:border-amber-900 dark:bg-amber-950/30 overflow-hidden">
          <button
            onClick={() => setShowTechnical(v => !v)}
            className="w-full flex items-center justify-between p-5 text-left hover:bg-amber-50/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-amber-100 p-2.5">
                <FlaskConical className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-amber-700 dark:text-amber-300">
                  Statistical Summary
                </span>
                <p className="text-[11px] text-amber-600/80 mt-0.5">
                  {showTechnical ? 'Click to collapse' : 'Technical details and methodology'}
                </p>
              </div>
            </div>
            {showTechnical
              ? <ChevronUp className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
              : <ChevronDown className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />}
          </button>
          {showTechnical && (
            <div className="px-5 pb-5 border-t border-amber-100">
              <p className="text-sm text-amber-900 dark:text-amber-200 leading-relaxed pt-4">{text}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
