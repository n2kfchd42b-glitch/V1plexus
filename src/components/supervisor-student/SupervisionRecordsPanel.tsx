'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { ClipboardList, Plus, ChevronDown, ChevronUp } from 'lucide-react'
import { SupervisionRecordModal, type SupervisionRecord } from './SupervisionRecordModal'
import { cn } from '@/lib/utils'

interface Props {
  projectId: string
  studentId: string
  initialRecords: SupervisionRecord[]
}

export function SupervisionRecordsPanel({ projectId, studentId, initialRecords }: Props) {
  const [records, setRecords]   = useState<SupervisionRecord[]>(initialRecords)
  const [modalOpen, setModalOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">
          Supervision Records <span className="ml-1 text-slate-300">({records.length})</span>
        </h2>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg"
        >
          <Plus className="h-3.5 w-3.5" />
          Write session record
        </button>
      </div>

      {records.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-8 text-center">
          <ClipboardList className="h-6 w-6 text-slate-200 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-500 mb-0.5">No supervision records yet</p>
          <p className="text-xs text-slate-400">Document your supervision sessions to build an audit trail</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          {records.map((r, i) => {
            const isExpanded = expandedId === r.id
            return (
              <div key={r.id} className={cn('border-b border-slate-50 last:border-b-0')}>
                <button
                  onClick={() => setExpandedId(isExpanded ? null : r.id)}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-slate-50/50 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                    <ClipboardList className="h-4 w-4 text-indigo-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{r.title}</p>
                    <p className="text-[10px] text-slate-400">
                      {format(new Date(r.created_at), 'dd MMM yyyy · HH:mm')}
                      {r.action_items.length > 0 && ` · ${r.action_items.length} action item${r.action_items.length !== 1 ? 's' : ''}`}
                    </p>
                  </div>
                  {isExpanded
                    ? <ChevronUp className="h-4 w-4 text-slate-400 flex-shrink-0" />
                    : <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" />
                  }
                </button>

                {isExpanded && (
                  <div className="px-5 pb-5 pt-1 space-y-4 bg-slate-50/30">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Session Summary</p>
                      <p className="text-sm text-slate-700 leading-relaxed">{r.summary}</p>
                    </div>

                    {r.action_items.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Action Items</p>
                        <ul className="space-y-1.5">
                          {r.action_items.map((item, j) => (
                            <li key={j} className="flex items-start gap-2 text-sm text-slate-700">
                              <div className="h-4 w-4 rounded-full border-2 border-slate-300 flex-shrink-0 mt-0.5" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <SupervisionRecordModal
        projectId={projectId}
        studentId={studentId}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={record => setRecords(prev => [record, ...prev])}
      />
    </section>
  )
}
