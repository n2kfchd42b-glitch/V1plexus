'use client'

import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Plus, Trash2, Loader2, ClipboardList } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  projectId: string
  studentId: string
  open: boolean
  onClose: () => void
  onCreated: (record: SupervisionRecord) => void
}

export interface SupervisionRecord {
  id: string
  supervisor_id: string
  student_id: string
  project_id: string
  title: string
  summary: string
  action_items: string[]
  created_at: string
}

export function SupervisionRecordModal({
  projectId,
  studentId,
  open,
  onClose,
  onCreated,
}: Props) {
  const [title, setTitle]             = useState('')
  const [summary, setSummary]         = useState('')
  const [actionItems, setActionItems] = useState<string[]>([''])
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState<string | null>(null)

  function addItem() {
    setActionItems(prev => [...prev, ''])
  }

  function updateItem(i: number, value: string) {
    setActionItems(prev => prev.map((v, idx) => idx === i ? value : v))
  }

  function removeItem(i: number) {
    setActionItems(prev => prev.filter((_, idx) => idx !== i))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (summary.trim().length < 10) {
      setError('Summary must be at least 10 characters.')
      return
    }
    setSaving(true)
    setError(null)

    const res = await fetch('/api/supervision/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id:   studentId,
        project_id:   projectId,
        title:        title.trim() || 'Supervision Session',
        summary:      summary.trim(),
        action_items: actionItems.filter(s => s.trim()),
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error?.toString() ?? 'Failed to save record')
      setSaving(false)
      return
    }

    const record = await res.json() as SupervisionRecord
    onCreated(record)
    // Reset form
    setTitle('')
    setSummary('')
    setActionItems([''])
    onClose()
    setSaving(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={v => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onEscapeKeyDown={onClose}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">

            {/* Header */}
            <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
              <div className="h-9 w-9 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                <ClipboardList className="h-4 w-4 text-indigo-600" />
              </div>
              <div>
                <Dialog.Title className="text-sm font-bold text-slate-800">
                  Supervision Record
                </Dialog.Title>
                <p className="text-xs text-slate-400">Document this supervision session</p>
              </div>
              <button
                onClick={onClose}
                className="ml-auto text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

                {/* Title */}
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                    Session title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="e.g. Chapter 3 review · Week 8"
                    className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>

                {/* Summary */}
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                    Session summary <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    required
                    rows={5}
                    value={summary}
                    onChange={e => setSummary(e.target.value)}
                    placeholder="Summarise what was discussed, reviewed, and decided in this session…"
                    className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>

                {/* Action items */}
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                    Action items for student
                  </label>
                  <div className="space-y-2">
                    {actionItems.map((item, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="h-5 w-5 rounded-full border-2 border-slate-200 flex-shrink-0" />
                        <input
                          type="text"
                          value={item}
                          onChange={e => updateItem(i, e.target.value)}
                          placeholder={`Action item ${i + 1}`}
                          className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        />
                        {actionItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItem(i)}
                            className="text-slate-300 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addItem}
                      className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-500 hover:text-indigo-700 transition-colors py-1"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add action item
                    </button>
                  </div>
                </div>

                {error && (
                  <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
                )}
              </div>

              {/* Footer */}
              <div className="flex gap-3 justify-end px-6 py-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || summary.trim().length < 10}
                  className="px-5 py-2 text-sm font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save record
                </button>
              </div>
            </form>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
