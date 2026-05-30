'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  ListChecks, Plus, Pencil, Trash2, ArrowUp, ArrowDown,
  FileText, Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface Template {
  id: string
  title: string
  description: string | null
  order_index: number
  requires_document: boolean
  created_at: string
}

type EditPayload = {
  title: string
  description: string
  requires_document: boolean
}

function EditModal({
  open, onClose, onSubmit, initial, mode, busy,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (p: EditPayload) => void
  initial: EditPayload
  mode: 'create' | 'edit'
  busy: boolean
}) {
  const [title, setTitle] = useState(initial.title)
  const [description, setDescription] = useState(initial.description)
  const [requiresDoc, setRequiresDoc] = useState(initial.requires_document)

  useEffect(() => {
    if (open) {
      setTitle(initial.title)
      setDescription(initial.description)
      setRequiresDoc(initial.requires_document)
    }
  }, [open, initial.title, initial.description, initial.requires_document])

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'New milestone stage' : 'Edit milestone stage'}</DialogTitle>
          <DialogDescription>
            Stages define the steps every student in this department works through.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!title.trim()) return
            onSubmit({ title: title.trim(), description: description.trim(), requires_document: requiresDoc })
          }}
          className="space-y-3"
        >
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Proposal defense"
              className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What students need to do at this stage."
              className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md resize-none focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200"
            />
          </div>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={requiresDoc}
              onChange={(e) => setRequiresDoc(e.target.checked)}
              className="rounded border-slate-300"
            />
            Requires a submitted document
          </label>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose} className="text-xs font-semibold text-slate-500 px-3 py-1.5 rounded hover:bg-slate-50">Cancel</button>
            <button
              type="submit"
              disabled={busy || !title.trim()}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-3 py-1.5 rounded-md"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {mode === 'create' ? 'Add stage' : 'Save'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function MilestonePlaybook({ deptId }: { deptId: string }) {
  const [templates, setTemplates] = useState<Template[] | null>(null)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Template | null>(null)
  const [busyTemplateId, setBusyTemplateId] = useState<string | null>(null)
  const [submitBusy, setSubmitBusy] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/department/${deptId}/milestone-templates`, { cache: 'no-store' })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      toast.error(body.error ?? 'Could not load playbook')
      return
    }
    const body = await res.json()
    setTemplates(body.templates ?? [])
  }, [deptId])

  useEffect(() => { void load() }, [load])

  async function createOne(p: EditPayload) {
    setSubmitBusy(true)
    const res = await fetch(`/api/department/${deptId}/milestone-templates`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(p),
    })
    setSubmitBusy(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      toast.error(body.error ?? 'Could not add stage')
      return
    }
    toast.success(`Added "${p.title}"`)
    setCreating(false)
    void load()
  }

  async function updateOne(t: Template, p: EditPayload) {
    setSubmitBusy(true)
    const res = await fetch(`/api/department/${deptId}/milestone-templates/${t.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(p),
    })
    setSubmitBusy(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      toast.error(body.error ?? 'Could not save')
      return
    }
    toast.success('Stage updated')
    setEditing(null)
    void load()
  }

  async function move(t: Template, direction: 'up' | 'down') {
    setBusyTemplateId(t.id)
    const res = await fetch(`/api/department/${deptId}/milestone-templates/${t.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ direction }),
    })
    setBusyTemplateId(null)
    if (!res.ok) {
      // 'Already at the edge' is expected when the user mashes the arrow.
      const body = await res.json().catch(() => ({}))
      if (res.status !== 409) toast.error(body.error ?? 'Could not move stage')
      return
    }
    void load()
  }

  async function remove(t: Template) {
    if (!confirm(`Delete "${t.title}"? Students who already have this milestone keep it but it'll no longer be linked to a template.`)) return
    setBusyTemplateId(t.id)
    const res = await fetch(`/api/department/${deptId}/milestone-templates/${t.id}`, { method: 'DELETE' })
    setBusyTemplateId(null)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      toast.error(body.error ?? 'Could not delete')
      return
    }
    toast.success(`Removed "${t.title}"`)
    void load()
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm mb-6">
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-100 gap-3">
          <div>
            <div className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-slate-400" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Suggested stages for supervisors</h2>
              {templates !== null && (
                <span className="text-[10px] text-slate-400">· {templates.length}</span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-xl">
              An optional playbook your supervisors can adopt for their students. Supervisors decide when and how to use it — admins don&apos;t see student progress.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 hover:text-indigo-800 px-2 py-1 rounded hover:bg-indigo-50 flex-shrink-0"
          >
            <Plus className="h-3.5 w-3.5" /> Add stage
          </button>
        </div>

        {templates === null ? (
          <p className="text-xs text-slate-400 px-5 py-4">Loading…</p>
        ) : templates.length === 0 ? (
          <p className="text-xs text-slate-400 px-5 py-6 italic text-center">
            No stages defined yet. Add the first one to start shaping the dept&apos;s research playbook.
          </p>
        ) : (
          <ol className="divide-y divide-slate-100">
            {templates.map((t, i) => (
              <li key={t.id} className="flex items-start gap-3 px-5 py-3">
                <span className="text-[10px] font-bold text-slate-400 bg-slate-50 rounded h-6 w-6 flex items-center justify-center flex-shrink-0 mt-0.5 tabular-nums">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-800 truncate">{t.title}</p>
                    {t.requires_document && (
                      <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.5">
                        <FileText className="h-2.5 w-2.5" /> doc required
                      </span>
                    )}
                  </div>
                  {t.description && (
                    <p className="text-xs text-slate-500 mt-1 whitespace-pre-line">{t.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => move(t, 'up')}
                    disabled={busyTemplateId === t.id || i === 0}
                    title="Move up"
                    className={cn(
                      'rounded p-1 disabled:opacity-30',
                      i === 0 ? '' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-50'
                    )}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(t, 'down')}
                    disabled={busyTemplateId === t.id || i === templates.length - 1}
                    title="Move down"
                    className={cn(
                      'rounded p-1 disabled:opacity-30',
                      i === templates.length - 1 ? '' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-50'
                    )}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(t)}
                    title="Edit"
                    className="rounded p-1 text-slate-400 hover:text-indigo-700 hover:bg-indigo-50"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(t)}
                    disabled={busyTemplateId === t.id}
                    title="Delete"
                    className="rounded p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    {busyTemplateId === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      <EditModal
        open={creating}
        onClose={() => setCreating(false)}
        onSubmit={createOne}
        initial={{ title: '', description: '', requires_document: false }}
        mode="create"
        busy={submitBusy}
      />

      <EditModal
        open={editing !== null}
        onClose={() => setEditing(null)}
        onSubmit={(p) => editing && updateOne(editing, p)}
        initial={editing
          ? { title: editing.title, description: editing.description ?? '', requires_document: editing.requires_document }
          : { title: '', description: '', requires_document: false }}
        mode="edit"
        busy={submitBusy}
      />
    </>
  )
}
