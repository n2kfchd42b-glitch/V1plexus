"use client"

import { useState } from 'react'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { logAudit } from '@/lib/audit'

interface Props {
  runId: string
  projectId: string
  onDismiss: () => void
}

const MAX_CHARS = 400

export function ReasoningPrompt({ runId, projectId, onDismiss }: Props) {
  const [text, setText]     = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!text.trim()) return
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('analysis_runs')
      .update({ user_reasoning: text.trim() })
      .eq('id', runId)
    if (!error) {
      logAudit('analysis.reasoning_added', 'analysis_run', runId, { length: text.trim().length }, projectId)
    }
    setSaving(false)
    onDismiss()
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
          Skip
        </button>
        <button
          onClick={handleSave}
          disabled={!text.trim() || saving}
          className="px-3 py-1.5 text-xs font-medium rounded bg-[var(--accent-blue)] text-white hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save note'}
        </button>
      </div>
    </motion.div>
  )
}
