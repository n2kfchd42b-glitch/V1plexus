"use client"

import { useState } from 'react'
import { X, Wand2, Copy, Check, RefreshCw, FileEdit } from 'lucide-react'

interface CoverLetterGeneratorProps {
  manuscriptTitle: string
  abstract: string
  journalName: string
  authorName: string
  authorAffiliation: string
  authorEmail: string
  onSave?: (letter: string) => void
  onClose: () => void
}

export function CoverLetterGenerator({
  manuscriptTitle,
  abstract,
  journalName,
  authorName,
  authorAffiliation,
  authorEmail,
  onSave,
  onClose,
}: CoverLetterGeneratorProps) {
  const [letter, setLetter] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    journalName,
    authorName,
    authorAffiliation,
    authorEmail,
    additionalContext: '',
  })

  async function generate() {
    setLoading(true)
    try {
      const res = await fetch('/api/publication/cover-letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manuscriptTitle,
          abstract,
          journalName: form.journalName,
          authorName: form.authorName,
          authorAffiliation: form.authorAffiliation,
          additionalContext: form.additionalContext,
        }),
      })
      if (!res.ok) throw new Error('Generation failed')
      const data = await res.json()
      setLetter(data.letter)
      setEditing(true)
    } catch {
      // Fallback to template
      setLetter(generateTemplate())
      setEditing(true)
    } finally {
      setLoading(false)
    }
  }

  function generateTemplate(): string {
    const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    return `${today}

Dear Editor,

We are pleased to submit our manuscript entitled "${manuscriptTitle}" for consideration in ${form.journalName || journalName}.

[DESCRIBE KEY FINDINGS AND NOVELTY — 2-3 sentences summarizing the main results and why they are significant]

[EXPLAIN RELEVANCE TO THIS JOURNAL — why this paper fits the journal's scope and readership]

This research contributes to the evidence base for global health by [DESCRIBE CONTRIBUTION]. The study was conducted with ethical approval from [INSERT ETHICS COMMITTEE] (reference: [INSERT REFERENCE]).

This manuscript has not been published elsewhere and is not under consideration by another journal. All authors have read and approved the final manuscript and have no conflicts of interest to declare.

We hope you will find this manuscript suitable for publication in ${form.journalName || journalName} and look forward to hearing from you.

Sincerely,

${form.authorName}
${form.authorAffiliation}
${form.authorEmail}`
  }

  function handleCopy() {
    navigator.clipboard.writeText(letter)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-purple-600" />
            <h2 className="font-semibold text-gray-900 text-sm">AI Cover Letter Generator</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left: Config */}
          <div className="w-72 border-r border-gray-100 p-4 space-y-3 overflow-y-auto flex-shrink-0">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Target Journal</p>
            <input type="text" value={form.journalName} onChange={e => setForm(f => ({ ...f, journalName: e.target.value }))}
              placeholder="Journal name"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />

            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider pt-1">Corresponding Author</p>
            <input type="text" value={form.authorName} onChange={e => setForm(f => ({ ...f, authorName: e.target.value }))}
              placeholder="Full name"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
            <input type="text" value={form.authorAffiliation} onChange={e => setForm(f => ({ ...f, authorAffiliation: e.target.value }))}
              placeholder="Institution"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
            <input type="email" value={form.authorEmail} onChange={e => setForm(f => ({ ...f, authorEmail: e.target.value }))}
              placeholder="Email"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />

            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider pt-1">Additional Context</p>
            <textarea rows={4} value={form.additionalContext} onChange={e => setForm(f => ({ ...f, additionalContext: e.target.value }))}
              placeholder="Ethics approval number, prior rejections, special considerations…"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none" />

            <button onClick={generate} disabled={loading}
              className="w-full flex items-center justify-center gap-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50">
              {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              {loading ? 'Generating…' : letter ? 'Regenerate' : 'Generate Letter'}
            </button>
          </div>

          {/* Right: Preview/Edit */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {!letter ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-gray-400">
                <Wand2 className="h-12 w-12 mb-3 opacity-30" />
                <p className="text-sm font-medium">AI-assisted cover letter</p>
                <p className="text-xs mt-1">Fill in the details and click Generate</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditing(!editing)}
                      className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-colors ${editing ? 'bg-blue-50 border-blue-200 text-blue-600' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                    >
                      <FileEdit className="h-3 w-3" />
                      {editing ? 'Editing' : 'Edit'}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={handleCopy}
                      className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 px-2.5 py-1 border border-gray-200 rounded-lg hover:bg-gray-50">
                      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                    {onSave && (
                      <button onClick={() => onSave(letter)}
                        className="flex items-center gap-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg">
                        Save to submission
                      </button>
                    )}
                  </div>
                </div>
                {editing ? (
                  <textarea
                    value={letter}
                    onChange={e => setLetter(e.target.value)}
                    className="flex-1 p-4 text-sm font-mono text-gray-800 resize-none focus:outline-none leading-relaxed"
                  />
                ) : (
                  <div className="flex-1 overflow-y-auto p-4">
                    <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm">
                      <pre className="text-sm text-gray-800 whitespace-pre-wrap font-sans leading-relaxed">{letter}</pre>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
