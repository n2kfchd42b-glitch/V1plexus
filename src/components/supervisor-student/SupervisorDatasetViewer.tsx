'use client'

import { useEffect, useState } from 'react'
import { loadVersionData } from '@/lib/data/storage'
import type { DataRow, ColumnSchema } from '@/types/database'
import { AnnotationThread, type Annotation } from './AnnotationThread'
import { Loader2, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  datasetId: string
  projectId: string
  studentId: string
  filePath: string
}

export function SupervisorDatasetViewer({
  datasetId,
  projectId,
  studentId,
  filePath,
}: Props) {
  const [rows, setRows]         = useState<DataRow[]>([])
  const [columns, setColumns]   = useState<ColumnSchema[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [activeCol, setActiveCol]     = useState<string | null>(null)
  const [page, setPage]               = useState(0)

  const PAGE_SIZE = 50

  useEffect(() => {
    async function load() {
      try {
        const data = await loadVersionData(filePath)
        setRows(data.rows)
        setColumns(data.columns)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load dataset')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [filePath])

  useEffect(() => {
    async function fetchAnnotations() {
      const res = await fetch(
        `/api/supervision/annotations?artifactId=${datasetId}&artifactType=dataset`
      )
      if (res.ok) setAnnotations(await res.json())
    }
    fetchAnnotations()
  }, [datasetId])

  const totalPages = Math.ceil(rows.length / PAGE_SIZE)
  const visibleRows = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  function annotationCountFor(col: string) {
    return annotations.filter(a => a.anchor === col && !a.is_resolved).length
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-12 text-center text-sm text-red-500">
        {error}
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6 flex flex-col lg:flex-row gap-4 lg:gap-6">

      {/* ── Table area ──────────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50 w-10">
                    #
                  </th>
                  {columns.map(col => {
                    const count = annotationCountFor(col.name)
                    const isActive = activeCol === col.name
                    return (
                      <th
                        key={col.name}
                        className={cn(
                          'px-3 py-2.5 text-left font-semibold text-slate-700 bg-slate-50 border-l border-slate-100 cursor-pointer transition-colors hover:bg-indigo-50 whitespace-nowrap',
                          isActive && 'bg-indigo-50 text-indigo-700'
                        )}
                        onClick={() => setActiveCol(isActive ? null : col.name)}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>{col.name}</span>
                          <span className="text-[9px] font-normal text-slate-400">{col.type}</span>
                          {count > 0 && (
                            <span className="ml-auto h-4 min-w-4 px-1 rounded-full bg-indigo-600 text-white text-[9px] font-bold flex items-center justify-center">
                              {count}
                            </span>
                          )}
                          <MessageSquare className={cn(
                            'h-3 w-3 ml-0.5',
                            isActive ? 'text-indigo-500' : 'text-slate-300'
                          )} />
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, i) => (
                  <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-3 py-2 text-slate-400 bg-slate-50/50 text-right text-[10px]">
                      {page * PAGE_SIZE + i + 1}
                    </td>
                    {columns.map(col => (
                      <td
                        key={col.name}
                        className={cn(
                          'px-3 py-2 border-l border-slate-50 text-slate-700',
                          activeCol === col.name && 'bg-indigo-50/30'
                        )}
                      >
                        {row[col.name] == null ? (
                          <span className="text-slate-300 italic">null</span>
                        ) : String(row[col.name])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="border-t border-slate-100 px-4 py-2.5 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                Rows {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, rows.length)} of {rows.length.toLocaleString()}
              </span>
              <div className="flex gap-2">
                <button
                  disabled={page === 0}
                  onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1 rounded text-[11px] border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1 rounded text-[11px] border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Column stats summary */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {columns.map(col => {
            const count = annotationCountFor(col.name)
            return (
              <button
                key={col.name}
                onClick={() => setActiveCol(activeCol === col.name ? null : col.name)}
                className={cn(
                  'text-left rounded-xl border px-3.5 py-3 bg-white shadow-sm transition-colors',
                  activeCol === col.name
                    ? 'border-indigo-300 bg-indigo-50/30'
                    : 'border-slate-100 hover:border-indigo-200'
                )}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {col.type}
                  </span>
                  {count > 0 && (
                    <span className="text-[10px] font-bold text-indigo-600">{count} note{count !== 1 ? 's' : ''}</span>
                  )}
                </div>
                <p className="text-xs font-semibold text-slate-800 truncate">{col.name}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Annotation sidebar ───────────────────────────────────────────────── */}
      {activeCol && (
        <div className="w-full lg:w-72 lg:flex-shrink-0">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 lg:sticky lg:top-20">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Column</p>
                <h3 className="text-sm font-bold text-slate-800">{activeCol}</h3>
              </div>
              <button
                onClick={() => setActiveCol(null)}
                className="text-slate-400 hover:text-slate-600 text-xs"
              >
                Close
              </button>
            </div>

            <AnnotationThread
              annotations={annotations}
              anchor={activeCol}
              anchorLabel={activeCol}
              studentId={studentId}
              projectId={projectId}
              artifactType="dataset"
              artifactId={datasetId}
              isSupervisor={true}
              onAnnotationAdded={a => setAnnotations(prev => [...prev, a])}
              onAnnotationDeleted={id => setAnnotations(prev => prev.filter(x => x.id !== id))}
              onAnnotationResolved={(id, resolved) =>
                setAnnotations(prev =>
                  prev.map(x => x.id === id ? { ...x, is_resolved: resolved } : x)
                )
              }
            />
          </div>
        </div>
      )}
    </div>
  )
}
