"use client"

import { useState } from 'react'
import { type Editor } from '@tiptap/react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { AILoadingIndicator } from './AILoadingIndicator'
import { createClient } from '@/lib/supabase/client'
import { Sparkles } from 'lucide-react'

interface GenerateSectionModalProps {
  open: boolean
  onClose: () => void
  editor: Editor
  documentId: string
}

const SECTION_TYPES = [
  { value: 'abstract', label: 'Abstract' },
  { value: 'introduction', label: 'Introduction' },
  { value: 'methods', label: 'Methods' },
  { value: 'results', label: 'Results' },
  { value: 'discussion', label: 'Discussion' },
]

export function GenerateSectionModal({ open, onClose, editor, documentId }: GenerateSectionModalProps) {
  const [sectionType, setSectionType] = useState('')
  const [analysisOutput, setAnalysisOutput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const handleGenerate = async () => {
    if (!sectionType) return
    setLoading(true)
    setError(null)

    try {
      let parsedOutput: unknown = analysisOutput
      try { parsedOutput = JSON.parse(analysisOutput) } catch { /* keep as string */ }

      const { data, error } = await supabase.functions.invoke('ai-assist', {
        body: {
          action: 'generate_section',
          section_type: sectionType,
          analysis_output: parsedOutput,
          context: { document_text: editor.getText() },
          document_id: documentId,
        },
      })

      if (error || !data?.result) throw error ?? new Error('No result')

      // Insert generated text at cursor or end of document
      editor.chain().focus().insertContent(
        `<p><strong>[Generated ${sectionType.charAt(0).toUpperCase() + sectionType.slice(1)}]</strong></p><p>${(data.result as string).replace(/\n/g, '</p><p>')}</p>`
      ).run()

      onClose()
    } catch (err) {
      console.error('[GenerateSectionModal]', err)
      setError('Generation failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Generate Section with AI
          </DialogTitle>
          <DialogDescription>
            Choose a section type and optionally provide analysis output data to guide the generation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Section Type</Label>
            <Select value={sectionType} onValueChange={setSectionType}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select section..." />
              </SelectTrigger>
              <SelectContent>
                {SECTION_TYPES.map(s => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Analysis Output (optional)</Label>
            <Textarea
              className="mt-1 font-mono text-xs"
              placeholder='Paste analysis results here, e.g. {"n": 450, "prevalence": 0.23, ...}'
              value={analysisOutput}
              onChange={e => setAnalysisOutput(e.target.value)}
              rows={5}
            />
            <p className="text-xs text-muted-foreground mt-1">Paste JSON or plain text from your analysis results.</p>
          </div>

          {loading && <AILoadingIndicator />}
          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleGenerate} disabled={loading || !sectionType} className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            {loading ? 'Generating...' : 'Generate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
