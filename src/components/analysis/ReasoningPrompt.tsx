"use client"

import { useState } from 'react'
import { motion } from 'framer-motion'

interface Props {
  onSaveNote: (text: string) => Promise<void> | void
  onDismiss: () => void
  requireReasoning?: boolean
  saveLabel?: string
  dismissLabel?: string
}

const MAX_CHARS = 400

export function ReasoningPrompt({
  onSaveNote,
  onDismiss,
  requireReasoning = true,
  saveLabel = 'Save note',
  dismissLabel = 'Skip',
}: Props) {
  const [text, setText]     = useState('')
  const [saving, setSaving] = useState(false)

  const canSave = requireReasoning ? !!text.trim() : true

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    await onSaveNote(text.trim())
    setSaving(false)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="mx-6 mt-5 border border-[var(--border-row)] rounded overflow-hidden flex-shrink-0"
    >
      {/* Label strip */}
      <div className="px-4 py-2.5 border-b border-[var(--border-row)] flex items-center justify-between">
        <p className="text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
          Why did you run this analysis?
        </p>
        <span className="data-mono-xs text-[var(--text-tertiary)]">
          {text.length}/{MAX_CHARS}
        </span>
      </div>

      {/* Textarea */}
      <textarea
        value={text}
        onChange={e => setText(e.target.value.slice(0, MAX_CHARS))}
        placeholder="e.g. Testing whether group differences in outcome persist after controlling for age and sex…"
        rows={3}
        className="w-full px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] bg-white resize-none outline-none leading-relaxed"
      />

      {/* Actions */}
      <div className="px-4 py-2.5 border-t border-[var(--border-row)] flex items-center justify-end gap-2 bg-[var(--bg-row-hover)]">
        <button
          onClick={onDismiss}
          className="px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          {dismissLabel}
        </button>
        <button
          onClick={handleSave}
          disabled={!canSave || saving}
          className="px-3 py-1.5 text-xs font-medium rounded text-white disabled:opacity-40 btn-primary"
        >
          {saving ? 'Saving…' : saveLabel}
        </button>
      </div>
    </motion.div>
  )
}
