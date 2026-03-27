"use client"

import { useState } from 'react'
import { Lightbulb, ChevronDown, ChevronUp, FlaskConical } from 'lucide-react'

interface Props {
  plainLanguage?: string
  text: string
}

export function InterpretationBox({ plainLanguage, text }: Props) {
  const [showTechnical, setShowTechnical] = useState(false)

  return (
    <div className="space-y-3">
      {/* Plain language — always visible */}
      {plainLanguage && (
        <div className="bg-white border border-[#E4E4E7] rounded-lg p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-[#EFF6FF] p-2 shrink-0">
              <Lightbulb className="h-4 w-4 text-[#3B82F6]" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#A1A1AA] mb-1.5">
                Plain Language Summary
              </p>
              <p className="text-sm text-[#52525B] leading-relaxed">{plainLanguage}</p>
            </div>
          </div>
        </div>
      )}

      {/* Technical summary — collapsible */}
      {text && (
        <div className="bg-white border border-[#E4E4E7] rounded-lg overflow-hidden">
          <button
            onClick={() => setShowTechnical(v => !v)}
            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-[#F5F5F5] transition-colors duration-150"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-[#FFFBEB] p-2">
                <FlaskConical className="h-4 w-4 text-[#F59E0B]" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#A1A1AA]">
                  Statistical Summary
                </span>
                <p className="text-xs text-[#A1A1AA] mt-0.5">
                  {showTechnical ? 'Click to collapse' : 'Technical details and methodology'}
                </p>
              </div>
            </div>
            {showTechnical
              ? <ChevronUp className="h-4 w-4 text-[#A1A1AA] shrink-0" />
              : <ChevronDown className="h-4 w-4 text-[#A1A1AA] shrink-0" />}
          </button>
          {showTechnical && (
            <div className="px-5 pb-5 border-t border-[#F0F0F0]">
              <p className="text-sm text-[#52525B] leading-relaxed pt-4">{text}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
