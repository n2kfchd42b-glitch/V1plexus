"use client"

import { useState } from 'react'
import { type Editor } from '@tiptap/react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Sparkles, Minimize2, Maximize2, BookOpen, Wand2 } from 'lucide-react'
import { AILoadingIndicator } from './AILoadingIndicator'
import { AISuggestionDisplay } from './AISuggestionDisplay'
import { createClient } from '@/lib/supabase/client'

interface AIAssistPopoverProps {
  editor: Editor
  documentId: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

const TONE_OPTIONS = [
  { key: 'improve', label: 'Improve this', icon: Wand2 },
  { key: 'concise', label: 'Make concise', icon: Minimize2 },
  { key: 'expand', label: 'Expand', icon: Maximize2 },
  { key: 'academic', label: 'Academic tone', icon: BookOpen },
] as const

export function AIAssistPopover({ editor, documentId, open: externalOpen, onOpenChange }: AIAssistPopoverProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = externalOpen ?? internalOpen
  const setOpen = (v: boolean) => {
    setInternalOpen(v)
    onOpenChange?.(v)
  }
  const [loading, setLoading] = useState(false)
  const [suggestion, setSuggestion] = useState<string | null>(null)
  const [pendingTone, setPendingTone] = useState<string | null>(null)
  const supabase = createClient()

  const getSelectedText = () => {
    const { from, to } = editor.state.selection
    return editor.state.doc.textBetween(from, to, ' ')
  }

  const handleTone = async (tone: string) => {
    const selected = getSelectedText()
    if (!selected.trim()) return

    setLoading(true)
    setSuggestion(null)
    setPendingTone(tone)

    try {
      const { data, error } = await supabase.functions.invoke('ai-assist', {
        body: {
          action: 'suggest',
          selection: selected,
          context: { tone },
          document_id: documentId,
        },
      })

      if (error || !data?.result) throw error ?? new Error('No result')
      setSuggestion(data.result as string)
    } catch (err) {
      console.error('AI assist error:', err)
      setSuggestion(null)
    } finally {
      setLoading(false)
    }
  }

  const handleAccept = () => {
    if (!suggestion) return
    editor.chain().focus().insertContentAt(editor.state.selection, suggestion).run()
    setSuggestion(null)
    setPendingTone(null)
    setOpen(false)
  }

  const handleDismiss = () => {
    setSuggestion(null)
    setPendingTone(null)
  }

  const selectedText = getSelectedText()

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setSuggestion(null); setPendingTone(null) } }}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1"
          title="AI Writing Assistant (Cmd+J)"
        >
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          AI Assist
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          AI Writing Assistant
        </p>

        {!selectedText.trim() && (
          <p className="text-xs text-muted-foreground">Select text in the editor to use AI suggestions.</p>
        )}

        {selectedText.trim() && (
          <>
            <p className="text-xs text-muted-foreground mb-2 truncate">
              Selected: &ldquo;{selectedText.slice(0, 60)}{selectedText.length > 60 ? '…' : ''}&rdquo;
            </p>
            <div className="grid grid-cols-2 gap-1.5 mb-2">
              {TONE_OPTIONS.map(({ key, label, icon: Icon }) => (
                <Button
                  key={key}
                  variant={pendingTone === key ? 'secondary' : 'outline'}
                  size="sm"
                  className="h-7 text-xs justify-start gap-1.5"
                  onClick={() => handleTone(key)}
                  disabled={loading}
                >
                  <Icon className="h-3 w-3" />
                  {label}
                </Button>
              ))}
            </div>
          </>
        )}

        {loading && <AILoadingIndicator />}

        {suggestion && (
          <AISuggestionDisplay
            suggestion={suggestion}
            onAccept={handleAccept}
            onDismiss={handleDismiss}
          />
        )}
      </PopoverContent>
    </Popover>
  )
}
