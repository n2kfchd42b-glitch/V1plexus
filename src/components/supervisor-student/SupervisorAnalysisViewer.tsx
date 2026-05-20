'use client'

import { useEffect, useState } from 'react'
import type { AnalysisResult, ResultTable } from '@/lib/analysis/types'
import type { AnalysisType } from '@/types/database'
import { AnnotationThread, type Annotation } from './AnnotationThread'
import { AnalysisCharts } from '@/components/analysis/results/AnalysisCharts'
import { cn } from '@/lib/utils'
import { MessageSquare, ChevronDown, ChevronUp } from 'lucide-react'

interface Props {
  runId: string
  projectId: string
  studentId: string
  analysisType: AnalysisType
  result: AnalysisResult
}


function StatTable({ table }: { table: ResultTable }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b-2 border-slate-200">
            {table.headers.map(h => (
              <th key={h} className="px-3 py-2 text-left font-semibold text-slate-700 bg-slate-50">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, i) => (
            <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2 text-slate-700">
                  {cell == null ? <span className="text-slate-300">—</span> : String(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {table.footnotes?.map((fn, i) => (
        <p key={i} className="text-[10px] text-slate-400 italic px-3 pt-1.5">{fn}</p>
      ))}
    </div>
  )
}

interface AnnotatableBlockProps {
  anchor: string
  anchorLabel: string
  annotations: Annotation[]
  runId: string
  projectId: string
  studentId: string
  onAnnotationAdded: (a: Annotation) => void
  onAnnotationDeleted: (id: string) => void
  onAnnotationResolved: (id: string, resolved: boolean) => void
  children: React.ReactNode
}

function AnnotatableBlock({
  anchor,
  anchorLabel,
  annotations,
  runId,
  projectId,
  studentId,
  onAnnotationAdded,
  onAnnotationDeleted,
  onAnnotationResolved,
  children,
}: AnnotatableBlockProps) {
  const [open, setOpen] = useState(false)
  const count = annotations.filter(a => a.anchor === anchor && !a.is_resolved).length

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="p-3 sm:p-5">{children}</div>
      <div className="border-t border-slate-100">
        <button
          onClick={() => setOpen(v => !v)}
          className="w-full flex items-center justify-between px-3 sm:px-5 py-3 text-xs hover:bg-slate-50 transition-colors"
        >
          <span className="flex items-center gap-1.5 font-semibold text-slate-500">
            <MessageSquare className="h-3.5 w-3.5" />
            {count > 0
              ? `${count} open note${count !== 1 ? 's' : ''} on this section`
              : 'Add notes to this section'}
          </span>
          {open ? <ChevronUp className="h-3.5 w-3.5 text-slate-400" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />}
        </button>
        {open && (
          <div className="px-3 sm:px-5 pb-4 sm:pb-5">
            <AnnotationThread
              annotations={annotations}
              anchor={anchor}
              anchorLabel={anchorLabel}
              studentId={studentId}
              projectId={projectId}
              artifactType="analysis"
              artifactId={runId}
              isSupervisor={true}
              onAnnotationAdded={onAnnotationAdded}
              onAnnotationDeleted={onAnnotationDeleted}
              onAnnotationResolved={onAnnotationResolved}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export function SupervisorAnalysisViewer({
  runId,
  projectId,
  studentId,
  analysisType,
  result,
}: Props) {
  const [annotations, setAnnotations] = useState<Annotation[]>([])

  useEffect(() => {
    async function fetchAnnotations() {
      const res = await fetch(
        `/api/supervision/annotations?artifactId=${runId}&artifactType=analysis`
      )
      if (res.ok) setAnnotations(await res.json())
    }
    fetchAnnotations()
  }, [runId])

  function addAnnotation(a: Annotation) {
    setAnnotations(prev => [...prev, a])
  }

  function deleteAnnotation(id: string) {
    setAnnotations(prev => prev.filter(x => x.id !== id))
  }

  function resolveAnnotation(id: string, resolved: boolean) {
    setAnnotations(prev => prev.map(x => x.id === id ? { ...x, is_resolved: resolved } : x))
  }

  const blockProps = {
    annotations,
    runId,
    projectId,
    studentId,
    onAnnotationAdded: addAnnotation,
    onAnnotationDeleted: deleteAnnotation,
    onAnnotationResolved: resolveAnnotation,
  }

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-5 sm:py-8 space-y-4 sm:space-y-5">

      {/* Interpretation */}
      {result.interpretation && (
        <AnnotatableBlock anchor="interpretation" anchorLabel="Statistical Summary" {...blockProps}>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Statistical Summary</h3>
          <p className="text-sm text-slate-700 leading-relaxed">{result.interpretation}</p>
        </AnnotatableBlock>
      )}

      {/* Plain language summary */}
      {result.plainLanguage && (
        <AnnotatableBlock anchor="plain_language" anchorLabel="Plain Language Summary" {...blockProps}>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Plain Language Summary</h3>
          <p className="text-sm text-slate-700 leading-relaxed">{result.plainLanguage}</p>
        </AnnotatableBlock>
      )}

      {/* Tables */}
      {result.tables.filter(t => !t.advanced).map(table => (
        <AnnotatableBlock
          key={table.id}
          anchor={`table_${table.id}`}
          anchorLabel={table.title}
          {...blockProps}
        >
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">{table.title}</h3>
          <StatTable table={table} />
        </AnnotatableBlock>
      ))}

      {/* Charts */}
      {result.charts.length > 0 && (
        <AnnotatableBlock anchor="charts" anchorLabel="Charts & Visualisations" {...blockProps}>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Charts</h3>
          <AnalysisCharts charts={result.charts as Parameters<typeof AnalysisCharts>[0]['charts']} analysisType={analysisType} />
        </AnnotatableBlock>
      )}

      {/* Advanced tables (collapsed by default) */}
      {result.tables.filter(t => t.advanced).map(table => (
        <AnnotatableBlock
          key={table.id}
          anchor={`table_${table.id}`}
          anchorLabel={table.title}
          {...blockProps}
        >
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">{table.title}</h3>
            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-400">Advanced</span>
          </div>
          <StatTable table={table} />
        </AnnotatableBlock>
      ))}
    </div>
  )
}
