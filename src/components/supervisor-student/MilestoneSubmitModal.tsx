'use client'

import { useState, useEffect } from 'react'
import { StudentMilestone } from '@/types/database'
import { X, Send, Database, BarChart2, FileText, Link2, ChevronDown, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Artifact {
  type: 'document' | 'dataset' | 'analysis_run'
  id: string
  label: string
  projectId: string
  projectTitle: string
}

interface ProjectArtifacts {
  id: string
  title: string
  datasets:      { id: string; name: string }[]
  analysis_runs: { id: string; analysis_type: string; status: string }[]
  documents:     { id: string; title: string }[]
}

const TYPE_CONFIG: Record<Artifact['type'], { icon: React.ElementType; label: string; color: string; bg: string }> = {
  document:     { icon: FileText,   label: 'Document',  color: 'text-indigo-500',  bg: 'bg-indigo-50'  },
  dataset:      { icon: Database,   label: 'Dataset',   color: 'text-violet-500',  bg: 'bg-violet-50'  },
  analysis_run: { icon: BarChart2,  label: 'Analysis',  color: 'text-emerald-500', bg: 'bg-emerald-50' },
}

function ArtifactRow({ a, isSelected, onSelect }: {
  a: Artifact
  isSelected: boolean
  onSelect: (a: Artifact) => void
}) {
  const cfg = TYPE_CONFIG[a.type]
  const Icon = cfg.icon
  return (
    <button
      onClick={() => onSelect(a)}
      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 transition-colors text-left"
    >
      <div className={cn('w-6 h-6 rounded flex items-center justify-center flex-shrink-0', cfg.bg)}>
        <Icon className={cn('h-3.5 w-3.5', cfg.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-700 truncate capitalize">{a.label}</p>
        <p className="text-[10px] text-slate-400">{cfg.label}</p>
      </div>
      {isSelected && <CheckCircle2 className="h-4 w-4 text-blue-500 flex-shrink-0" />}
    </button>
  )
}

interface Props {
  milestone: StudentMilestone
  onClose: () => void
  onSuccess: () => void
}

export function MilestoneSubmitModal({ milestone, onClose, onSuccess }: Props) {
  const [note, setNote]               = useState('')
  const [projects, setProjects]       = useState<ProjectArtifacts[]>([])
  const [linked, setLinked]           = useState<Artifact | null>(null)
  const [pickerOpen, setPickerOpen]   = useState(false)
  const [submitting, setSubmitting]   = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [loadingArtifacts, setLoadingArtifacts] = useState(true)

  useEffect(() => {
    fetch('/api/student/artifacts')
      .then(r => r.ok ? r.json() : [])
      .then(setProjects)
      .finally(() => setLoadingArtifacts(false))
  }, [])

  // Flatten all artifacts for the picker
  const allArtifacts: Artifact[] = projects.flatMap(p => [
    ...p.documents.map(d => ({
      type: 'document' as const,
      id: d.id,
      label: d.title || 'Untitled document',
      projectId: p.id,
      projectTitle: p.title,
    })),
    ...p.datasets.map(d => ({
      type: 'dataset' as const,
      id: d.id,
      label: d.name,
      projectId: p.id,
      projectTitle: p.title,
    })),
    ...p.analysis_runs.map(r => ({
      type: 'analysis_run' as const,
      id: r.id,
      label: r.analysis_type.replace(/_/g, ' '),
      projectId: p.id,
      projectTitle: p.title,
    })),
  ])

  const hasArtifacts = allArtifacts.length > 0
  const linkedId = (linked as { id?: string } | null)?.id ?? ''

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    const body: Record<string, string | undefined> = { note: note.trim() || undefined }
    if (linked?.type === 'document')     body.document_id     = linked.id
    if (linked?.type === 'dataset')      body.dataset_id      = linked.id
    if (linked?.type === 'analysis_run') body.analysis_run_id = linked.id

    const res = await fetch(`/api/milestones/${milestone.id}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      onSuccess()
    } else {
      const data = await res.json()
      setError(data.error ?? 'Submission failed')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">Submit Milestone</h2>
            <p className="text-xs text-slate-500 mt-0.5">{milestone.title}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Note */}
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1.5">
              Note to supervisor <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
              placeholder="Describe what you've completed, any challenges, or questions…"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Artifact picker */}
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1.5">
              <Link2 className="inline h-3.5 w-3.5 mr-1 text-slate-400" />
              Link your work <span className="text-slate-400 font-normal">(optional)</span>
            </label>

            {linked ? (
              <div className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg border',
                TYPE_CONFIG[linked.type].bg, 'border-slate-200'
              )}>
                {(() => { const Ic = TYPE_CONFIG[linked.type].icon; return <Ic className={cn('h-4 w-4 flex-shrink-0', TYPE_CONFIG[linked.type].color)} /> })()}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-800 truncate capitalize">{linked.label}</p>
                  <p className="text-[10px] text-slate-500 truncate">{linked.projectTitle} · {TYPE_CONFIG[linked.type].label}</p>
                </div>
                <button
                  onClick={() => setLinked(null)}
                  className="text-slate-400 hover:text-slate-700 flex-shrink-0"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : loadingArtifacts ? (
              <div className="h-10 bg-slate-50 rounded-lg animate-pulse" />
            ) : !hasArtifacts ? (
              <p className="text-xs text-slate-400 italic px-1">
                No work in Plexus yet. Create a dataset, run an analysis, or write a document first.
              </p>
            ) : (
              <div className="relative">
                <button
                  onClick={() => setPickerOpen(v => !v)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm text-slate-500 border border-slate-200 rounded-lg hover:border-blue-400 hover:bg-slate-50 transition-colors"
                >
                  <span>Select a document, dataset, or analysis…</span>
                  <ChevronDown className={cn('h-4 w-4 flex-shrink-0 transition-transform', pickerOpen && 'rotate-180')} />
                </button>

                {pickerOpen && (
                  <div className="absolute z-10 mt-1 w-full bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden max-h-60 overflow-y-auto">
                    {projects.map(p => {
                      const projectItems = allArtifacts.filter(a => a.projectId === p.id)
                      if (!projectItems.length) return null
                      return (
                        <div key={p.id}>
                          <p className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 sticky top-0">
                            {p.title}
                          </p>
                          {projectItems.map((a: Artifact) => (
                            <ArtifactRow
                              key={a.id}
                              a={a}
                              isSelected={linkedId === a.id}
                              onSelect={(picked) => { setLinked(picked); setPickerOpen(false) }}
                            />
                          ))}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-2 justify-end pt-1">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-[#0052CC] text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              <Send className="h-4 w-4" />
              {submitting ? 'Submitting…' : 'Submit for Review'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
