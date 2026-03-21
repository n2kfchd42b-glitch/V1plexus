"use client"

import { Lightbulb } from 'lucide-react'

interface Props {
  text: string
}

export function InterpretationBox({ text }: Props) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-3">
      <div className="flex items-start gap-2">
        <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">Interpretation</p>
          <p className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">{text}</p>
        </div>
      </div>
    </div>
  )
}
