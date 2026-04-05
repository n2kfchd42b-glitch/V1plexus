"use client"

import { useState } from 'react'
import { Clock, FileText, Quote, Focus, CheckCircle2, Circle, ChevronUp, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ChecklistItem {
  id: string
  label: string
  done: boolean
}

interface ComplianceStatusBarProps {
  wordCount: number
  citationCount: number
  saving: boolean
  lastSaved: Date | null
  focusMode: boolean
  onToggleFocus: () => void
  documentType?: string
}

const CONSORT_CHECKLIST: ChecklistItem[] = [
  { id: 'title', label: 'Title identifies RCT', done: false },
  { id: 'abstract', label: 'Structured abstract', done: false },
  { id: 'background', label: 'Background & rationale', done: false },
  { id: 'objectives', label: 'Objectives stated', done: false },
  { id: 'design', label: 'Trial design described', done: false },
  { id: 'participants', label: 'Participants & settings', done: false },
  { id: 'interventions', label: 'Interventions described', done: false },
  { id: 'outcomes', label: 'Primary/secondary outcomes', done: false },
  { id: 'sample', label: 'Sample size calculation', done: false },
  { id: 'randomisation', label: 'Randomisation method', done: false },
  { id: 'blinding', label: 'Blinding described', done: false },
  { id: 'statistical', label: 'Statistical methods', done: false },
  { id: 'results', label: 'Flow of participants', done: false },
  { id: 'baseline', label: 'Baseline characteristics', done: false },
  { id: 'harms', label: 'Harms reported', done: false },
  { id: 'limitations', label: 'Limitations discussed', done: false },
  { id: 'generalisability', label: 'Generalisability addressed', done: false },
  { id: 'registration', label: 'Trial registration number', done: false },
  { id: 'protocol', label: 'Protocol accessible', done: false },
  { id: 'funding', label: 'Funding sources disclosed', done: false },
]

const STROBE_CHECKLIST: ChecklistItem[] = [
  { id: 'title', label: 'Title/abstract: study design', done: false },
  { id: 'background', label: 'Background & rationale', done: false },
  { id: 'objectives', label: 'Objectives stated', done: false },
  { id: 'design', label: 'Study design reported', done: false },
  { id: 'setting', label: 'Setting & time periods', done: false },
  { id: 'participants', label: 'Participants defined', done: false },
  { id: 'variables', label: 'Variables described', done: false },
  { id: 'data_sources', label: 'Data sources detailed', done: false },
  { id: 'bias', label: 'Efforts to address bias', done: false },
  { id: 'sample_size', label: 'Sample size rationale', done: false },
  { id: 'stats', label: 'Statistical methods', done: false },
  { id: 'results', label: 'Participants reported', done: false },
  { id: 'main_results', label: 'Main results reported', done: false },
  { id: 'limitations', label: 'Limitations discussed', done: false },
  { id: 'interpretation', label: 'Cautious interpretation', done: false },
  { id: 'generalisability', label: 'Generalisability assessed', done: false },
  { id: 'funding', label: 'Funding disclosed', done: false },
]

const CHECKLISTS: Record<string, { name: string; items: ChecklistItem[] }> = {
  protocol: { name: 'CONSORT', items: CONSORT_CHECKLIST },
  report: { name: 'STROBE', items: STROBE_CHECKLIST },
  general: { name: 'STROBE', items: STROBE_CHECKLIST },
}

function readingTime(words: number): string {
  const mins = Math.max(1, Math.round(words / 200))
  return `${mins} min read`
}

export function ComplianceStatusBar({
  wordCount,
  citationCount,
  saving,
  lastSaved,
  focusMode,
  onToggleFocus,
  documentType = 'general',
}: ComplianceStatusBarProps) {
  const [checklistOpen, setChecklistOpen] = useState(false)
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set())

  const checklistDef = CHECKLISTS[documentType] ?? CHECKLISTS.general
  const total = checklistDef.items.length
  const done = checkedItems.size
  const pct = Math.round((done / total) * 100)

  const toggleItem = (id: string) => {
    setCheckedItems(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const saveLabel = saving
    ? 'Saving…'
    : lastSaved
      ? `Saved ${lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      : 'Not saved'

  return (
    <div className="relative shrink-0">
      {/* Checklist popover */}
      {checklistOpen && (
        <div className="absolute bottom-full right-0 mb-1 w-72 bg-white border border-[var(--border-default)] rounded-xl shadow-xl overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-default)] bg-[var(--bg-app)]">
            <div>
              <p className="text-xs font-semibold text-[var(--text-primary)]">{checklistDef.name} Checklist</p>
              <p className="text-[11px] text-[var(--text-tertiary)]">{done}/{total} items — {pct}% complete</p>
            </div>
            <div
              className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
              style={{
                background: `conic-gradient(#0052CC ${pct * 3.6}deg, #E4E4E7 0deg)`,
              }}
            >
              <div className="h-7 w-7 rounded-full bg-white flex items-center justify-center">
                <span className="text-[10px] font-bold text-[var(--color-clinical-blue)]">{pct}%</span>
              </div>
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto divide-y divide-[var(--border-default)]">
            {checklistDef.items.map(item => (
              <button
                key={item.id}
                onClick={() => toggleItem(item.id)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--bg-app)] transition-colors text-left"
              >
                {checkedItems.has(item.id)
                  ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  : <Circle className="h-4 w-4 text-[var(--text-tertiary)] shrink-0" />}
                <span className={cn(
                  'text-xs',
                  checkedItems.has(item.id) ? 'text-[var(--text-tertiary)] line-through' : 'text-[var(--text-primary)]'
                )}>
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Status bar */}
      <div className="flex items-center gap-6 px-8 py-3 bg-white text-slate-500 text-[10px] border-t border-slate-200 font-bold uppercase tracking-widest">
        {/* Left: doc stats */}
        <div className="flex items-center gap-6">
          <span className="flex items-center gap-1.5 text-slate-600">
            <FileText className="h-3.5 w-3.5 text-slate-400" />
            {wordCount.toLocaleString()} words
          </span>
          <span className="flex items-center gap-1.5 text-slate-500">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            {readingTime(wordCount)}
          </span>
          <span className="flex items-center gap-1.5 text-slate-500">
            <Quote className="h-3.5 w-3.5 text-slate-400" />
            {citationCount} {citationCount === 1 ? 'citation' : 'citations'}
          </span>
        </div>

        {/* Center: save status */}
        <div className="flex-1 flex justify-center">
          <span className={cn('flex items-center gap-1', saving ? 'text-amber-600' : lastSaved ? 'text-green-600' : 'text-slate-400')}>
            {saving && <Loader2 className="h-3 w-3 animate-spin" />}
            {saveLabel}
          </span>
        </div>

        {/* Right: compliance + focus */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setChecklistOpen(o => !o)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1 rounded border transition-colors',
              checklistOpen ? 'bg-[#E6F0FF] text-[#0052CC] border-blue-200' : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900'
            )}
            title={`${checklistDef.name} compliance checklist`}
          >
            <span className={cn(
              'h-2 w-2 rounded-full',
              pct >= 80 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500'
            )} />
            {checklistDef.name} {pct}%
            <ChevronUp className={cn('h-3 w-3 transition-transform', !checklistOpen && 'rotate-180')} />
          </button>

          <button
            onClick={onToggleFocus}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1 rounded border transition-colors',
              focusMode ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900'
            )}
            title="Focus mode (hide panels)"
          >
            <Focus className="h-3.5 w-3.5" />
            {focusMode ? 'Exit Focus' : 'Focus'}
          </button>
        </div>
      </div>
    </div>
  )
}
