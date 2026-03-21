"use client"

import { useState } from 'react'
import { type Editor } from '@tiptap/react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Check, X, SpellCheck, ChevronRight } from 'lucide-react'
import { AILoadingIndicator } from './AILoadingIndicator'
import { createClient } from '@/lib/supabase/client'
import type { GrammarSuggestion } from '@/types/database'
import { cn } from '@/lib/utils'

interface GrammarCheckPanelProps {
  editor: Editor
  documentId: string
  onClose: () => void
}

const typeColor: Record<string, string> = {
  grammar: 'text-red-700 bg-red-50 border-red-200',
  clarity: 'text-blue-700 bg-blue-50 border-blue-200',
  style: 'text-purple-700 bg-purple-50 border-purple-200',
}

export function GrammarCheckPanel({ editor, documentId, onClose }: GrammarCheckPanelProps) {
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<GrammarSuggestion[]>([])
  const [dismissed, setDismissed] = useState<Set<number>>(new Set())
  const [ran, setRan] = useState(false)
  const supabase = createClient()

  const runCheck = async () => {
    const text = editor.getText()
    if (!text.trim()) return
    setLoading(true)
    setDismissed(new Set())
    setSuggestions([])

    try {
      const { data, error } = await supabase.functions.invoke('ai-assist', {
        body: {
          action: 'grammar_check',
          selection: text.slice(0, 8000), // limit context
          document_id: documentId,
        },
      })

      if (error) throw error
      setSuggestions(Array.isArray(data?.result) ? (data.result as GrammarSuggestion[]) : [])
      setRan(true)
    } catch (err) {
      console.error('Grammar check error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAccept = (idx: number, suggestion: GrammarSuggestion) => {
    // Find and replace in editor
    const content = editor.getHTML()
    if (content.includes(suggestion.original)) {
      editor.commands.setContent(content.replace(suggestion.original, suggestion.suggestion))
    }
    setDismissed(prev => new Set([...prev, idx]))
  }

  const activeSuggestions = suggestions.filter((_, i) => !dismissed.has(i))

  return (
    <div className="w-80 border-l bg-card flex flex-col h-full">
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SpellCheck className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Grammar & Style</span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="px-4 py-3">
        <Button
          size="sm"
          className="w-full gap-1.5"
          onClick={runCheck}
          disabled={loading}
        >
          <SpellCheck className="h-3.5 w-3.5" />
          {loading ? 'Checking...' : ran ? 'Re-check' : 'Check Writing'}
        </Button>
        {loading && <div className="mt-2"><AILoadingIndicator /></div>}
      </div>

      {ran && !loading && (
        <div className="px-4 pb-2">
          <p className="text-xs text-muted-foreground">
            {activeSuggestions.length === 0
              ? 'No issues found.'
              : `${activeSuggestions.length} suggestion${activeSuggestions.length !== 1 ? 's' : ''}`}
          </p>
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="px-3 pb-3 space-y-2">
          {suggestions.map((s, i) => {
            if (dismissed.has(i)) return null
            return (
              <div key={i} className="rounded-lg border bg-background p-3 text-xs space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <Badge className={cn('text-[10px] border capitalize', typeColor[s.type] ?? typeColor.grammar)}>
                    {s.type}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground line-through truncate">&ldquo;{s.original}&rdquo;</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <ChevronRight className="h-3 w-3 text-green-600 shrink-0" />
                    <p className="text-foreground truncate">&ldquo;{s.suggestion}&rdquo;</p>
                  </div>
                </div>
                <p className="text-muted-foreground text-[11px]">{s.explanation}</p>
                <div className="flex gap-1.5 pt-0.5">
                  <Button
                    size="sm"
                    className="h-6 text-[11px] gap-1 px-2"
                    onClick={() => handleAccept(i, s)}
                  >
                    <Check className="h-3 w-3" />
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-[11px] gap-1 px-2"
                    onClick={() => setDismissed(prev => new Set([...prev, i]))}
                  >
                    <X className="h-3 w-3" />
                    Dismiss
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}
