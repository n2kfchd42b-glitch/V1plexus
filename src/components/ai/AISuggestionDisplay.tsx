"use client"

import { Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface AISuggestionDisplayProps {
  suggestion: string
  onAccept: () => void
  onDismiss: () => void
}

export function AISuggestionDisplay({ suggestion, onAccept, onDismiss }: AISuggestionDisplayProps) {
  return (
    <div className="mt-2 rounded-md border border-primary/20 bg-primary/5 p-3 text-sm">
      <p className="text-xs font-medium text-primary mb-1.5">AI Suggestion</p>
      <p className="text-foreground/90 whitespace-pre-wrap leading-relaxed">{suggestion}</p>
      <div className="flex items-center gap-2 mt-2.5">
        <Button size="sm" className="h-7 text-xs gap-1" onClick={onAccept}>
          <Check className="h-3.5 w-3.5" />
          Accept
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={onDismiss}>
          <X className="h-3.5 w-3.5" />
          Dismiss
        </Button>
      </div>
    </div>
  )
}
