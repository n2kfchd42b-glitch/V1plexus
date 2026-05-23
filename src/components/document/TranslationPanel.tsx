'use client'

import { useState } from 'react'
import { Languages, X, Loader2, Copy, CheckCircle, AlertTriangle, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

const SUPPORTED_LANGUAGES: Record<string, string> = {
  fr: 'French',
  es: 'Spanish',
  de: 'German',
  pt: 'Portuguese',
  it: 'Italian',
  zh: 'Simplified Chinese',
  ar: 'Arabic',
  hi: 'Hindi',
  ja: 'Japanese',
  ko: 'Korean',
  ru: 'Russian',
  nl: 'Dutch',
  sv: 'Swedish',
  pl: 'Polish',
  tr: 'Turkish',
}

interface TranslationPanelProps {
  documentId: string
  onClose: () => void
  /** Called with the translated text as HTML so the parent can insert it */
  onInsertTranslation: (html: string) => void
}

type State = 'idle' | 'loading' | 'done' | 'error'

export function TranslationPanel({ documentId, onClose, onInsertTranslation }: TranslationPanelProps) {
  const [targetLang, setTargetLang] = useState('fr')
  const [state, setState] = useState<State>('idle')
  const [result, setResult] = useState<{
    translatedText: string
    languageName: string
    wasTruncated: boolean
  } | null>(null)
  const [copied, setCopied] = useState(false)

  const handleTranslate = async () => {
    setState('loading')
    setResult(null)
    try {
      const res = await fetch(`/api/documents/${documentId}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetLanguage: targetLang }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Translation failed')
      setResult(json)
      setState('done')
    } catch (err) {
      console.error('[TranslationPanel]', err)
      toast.error('Translation failed. Check that ANTHROPIC_API_KEY is configured.')
      setState('error')
    }
  }

  const handleCopy = async () => {
    if (!result) return
    await navigator.clipboard.writeText(result.translatedText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('Copied to clipboard')
  }

  const handleInsert = () => {
    if (!result) return
    // Convert plain text to basic HTML paragraphs for insertion
    const html = result.translatedText
      .split(/\n{2,}/)
      .map(para => para.trim())
      .filter(Boolean)
      .map(para => {
        // Detect heading-like lines (short, no period at end)
        if (para.length < 80 && !para.endsWith('.') && !para.includes('\n')) {
          return `<h3>${para}</h3>`
        }
        // Multi-line within paragraph — preserve line breaks
        const inner = para.replace(/\n/g, '<br/>')
        return `<p>${inner}</p>`
      })
      .join('\n')
    onInsertTranslation(html)
    toast.success(`${result.languageName} translation inserted`)
    onClose()
  }

  return (
    <aside className="w-80 shrink-0 border-l border-[var(--border-default)] bg-white flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-default)] shrink-0">
        <div className="flex items-center gap-2">
          <Languages className="h-4 w-4 text-[var(--color-clinical-blue)]" />
          <span className="text-sm font-semibold text-[var(--text-primary)]">AI Translation</span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex flex-col flex-1 overflow-hidden p-4 gap-4">
        {/* Language selector */}
        <div>
          <label className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide block mb-1.5">
            Target Language
          </label>
          <select
            value={targetLang}
            onChange={e => setTargetLang(e.target.value)}
            className="w-full text-sm border border-[var(--border-default)] rounded-lg px-3 py-2 bg-white text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-clinical-blue)]"
            disabled={state === 'loading'}
          >
            {Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => (
              <option key={code} value={code}>{name}</option>
            ))}
          </select>
        </div>

        <Button
          onClick={handleTranslate}
          disabled={state === 'loading'}
          className="bg-[var(--color-clinical-blue)] hover:bg-[var(--color-clinical-deep)] h-8 text-sm gap-2"
        >
          {state === 'loading' ? (
            <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Translating…</>
          ) : (
            <><Wand2 className="h-3.5 w-3.5" /> Translate Document</>
          )}
        </Button>

        {state === 'loading' && (
          <p className="text-xs text-[var(--text-tertiary)] text-center">
            Translating via AI — this may take a moment for longer documents…
          </p>
        )}

        {state === 'error' && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
            <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs text-red-700">Translation failed. Please try again or contact support.</p>
          </div>
        )}

        {state === 'done' && result && (
          <div className="flex flex-col gap-3 flex-1 min-h-0">
            {result.wasTruncated && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  Document was truncated to first ~12,000 characters for translation preview.
                </p>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide">
                {result.languageName} Translation
              </span>
              <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 px-1.5" onClick={handleCopy}>
                {copied
                  ? <><CheckCircle className="h-3 w-3 text-green-600" /> Copied</>
                  : <><Copy className="h-3 w-3" /> Copy</>
                }
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto rounded-lg border border-[var(--border-default)] bg-[var(--surface-1)] p-3">
              <pre className="text-xs text-[var(--text-primary)] whitespace-pre-wrap font-sans leading-relaxed">
                {result.translatedText}
              </pre>
            </div>

            <Button
              onClick={handleInsert}
              className="h-8 text-sm gap-2 bg-[var(--color-clinical-blue)] hover:bg-[var(--color-clinical-deep)]"
            >
              <Languages className="h-3.5 w-3.5" />
              Insert into Document
            </Button>
          </div>
        )}
      </div>
    </aside>
  )
}
