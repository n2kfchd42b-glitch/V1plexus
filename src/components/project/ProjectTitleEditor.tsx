"use client"

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { updateProject } from '@/lib/data'
import { toast } from 'sonner'
import { Pencil, Check, X } from 'lucide-react'

interface Props {
  projectId: string
  initialTitle: string
  initialDescription: string | null
}

export function ProjectTitleEditor({ projectId, initialTitle, initialDescription }: Props) {
  const supabase = createClient()

  const [title, setTitle] = useState(initialTitle)
  const [description, setDescription] = useState(initialDescription ?? '')
  const [editingTitle, setEditingTitle] = useState(false)
  const [editingDesc, setEditingDesc] = useState(false)
  const [draftTitle, setDraftTitle] = useState(title)
  const [draftDesc, setDraftDesc] = useState(description)
  const [saving, setSaving] = useState(false)

  const titleInputRef = useRef<HTMLInputElement>(null)
  const descInputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { if (editingTitle) titleInputRef.current?.focus() }, [editingTitle])
  useEffect(() => { if (editingDesc) descInputRef.current?.focus() }, [editingDesc])

  const saveTitle = async () => {
    const trimmed = draftTitle.trim()
    if (!trimmed) { toast.error('Title cannot be empty'); return }
    if (trimmed === title) { setEditingTitle(false); return }
    setSaving(true)
    const result = await updateProject(supabase, projectId, { title: trimmed })
    if (result.status === 'error') {
      toast.error('Failed to save title')
    } else {
      setTitle(trimmed)
      setEditingTitle(false)
    }
    setSaving(false)
  }

  const saveDesc = async () => {
    const trimmed = draftDesc.trim()
    if (trimmed === description) { setEditingDesc(false); return }
    setSaving(true)
    const result = await updateProject(supabase, projectId, { description: trimmed || null })
    if (result.status === 'error') {
      toast.error('Failed to save description')
    } else {
      setDescription(trimmed)
      setEditingDesc(false)
    }
    setSaving(false)
  }

  const cancelTitle = () => { setDraftTitle(title); setEditingTitle(false) }
  const cancelDesc  = () => { setDraftDesc(description); setEditingDesc(false) }

  return (
    <div>
      {/* Title */}
      <div className="flex items-center gap-2 group">
        <div
          className="flex-shrink-0 rounded-full"
          style={{ width: 4, height: 32, background: 'var(--accent-blue)' }}
        />
        {editingTitle ? (
          <div className="flex items-center gap-2 flex-1">
            <input
              ref={titleInputRef}
              value={draftTitle}
              onChange={e => setDraftTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') cancelTitle() }}
              disabled={saving}
              className="flex-1 bg-transparent border-b-2 outline-none text-[var(--text-primary)] leading-none pb-0.5"
              style={{
                fontFamily: 'var(--font-manrope)',
                fontWeight: 800,
                fontSize: '1.75rem',
                borderColor: 'var(--accent-blue)',
                letterSpacing: '-0.02em',
              }}
            />
            <button
              onClick={saveTitle}
              disabled={saving}
              className="flex-shrink-0 p-1 rounded hover:bg-[var(--bg-surface-hover)] text-[var(--accent-blue)]"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              onClick={cancelTitle}
              className="flex-shrink-0 p-1 rounded hover:bg-[var(--bg-surface-hover)] text-[var(--text-tertiary)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <h1
              className="tracking-tight leading-none"
              style={{
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-manrope)',
                fontWeight: 800,
                fontSize: '1.75rem',
              }}
            >
              {title}
            </h1>
            <button
              onClick={() => { setDraftTitle(title); setEditingTitle(true) }}
              className="flex-shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[var(--bg-surface-hover)] text-[var(--text-tertiary)]"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Description */}
      <div className="mt-1.5 group/desc flex items-start gap-1.5" style={{ maxWidth: 560 }}>
        {editingDesc ? (
          <div className="flex-1 space-y-1.5">
            <textarea
              ref={descInputRef}
              value={draftDesc}
              onChange={e => setDraftDesc(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') cancelDesc() }}
              disabled={saving}
              rows={2}
              placeholder="Add a description…"
              className="w-full text-sm bg-transparent border-b-2 outline-none resize-none leading-relaxed pb-0.5"
              style={{
                color: 'var(--text-secondary)',
                borderColor: 'var(--accent-blue)',
              }}
            />
            <div className="flex gap-1.5">
              <button
                onClick={saveDesc}
                disabled={saving}
                className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded bg-[var(--accent-blue)] text-white hover:opacity-90"
              >
                <Check className="h-3 w-3" />
                Save
              </button>
              <button
                onClick={cancelDesc}
                className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]"
              >
                <X className="h-3 w-3" />
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            {description ? (
              <p className="text-sm leading-relaxed flex-1" style={{ color: 'var(--text-secondary)' }}>
                {description}
              </p>
            ) : (
              <p className="text-sm leading-relaxed flex-1 italic" style={{ color: 'var(--text-tertiary)' }}>
                No description
              </p>
            )}
            <button
              onClick={() => { setDraftDesc(description); setEditingDesc(true) }}
              className="flex-shrink-0 p-1 rounded mt-0.5 opacity-0 group-hover/desc:opacity-100 transition-opacity hover:bg-[var(--bg-surface-hover)] text-[var(--text-tertiary)]"
            >
              <Pencil className="h-3 w-3" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
