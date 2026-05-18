'use client'

import { useEffect, useState } from 'react'
import { MessageSquare } from 'lucide-react'
import { AnnotationThread, type Annotation } from './AnnotationThread'

interface Props {
  documentId: string
  projectId: string
  studentId: string
}

export function AnnotationDocumentPanel({ documentId, projectId, studentId }: Props) {
  const [annotations, setAnnotations] = useState<Annotation[]>([])

  useEffect(() => {
    fetch(`/api/supervision/annotations?artifactId=${documentId}&artifactType=document`)
      .then(r => r.ok ? r.json() : [])
      .then(setAnnotations)
  }, [documentId])

  const openCount = annotations.filter(a => !a.is_resolved).length

  return (
    <div className="border-t border-slate-100 bg-white">
      <div className="max-w-4xl mx-auto px-6 py-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-6 w-6 rounded-md bg-indigo-50 flex items-center justify-center">
            <MessageSquare className="h-3.5 w-3.5 text-indigo-500" />
          </div>
          <span className="text-sm font-semibold text-slate-800">Document Feedback</span>
          {openCount > 0 && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-600">
              {openCount} open
            </span>
          )}
        </div>

        <AnnotationThread
          annotations={annotations}
          anchor="document"
          anchorLabel="Document feedback"
          studentId={studentId}
          projectId={projectId}
          artifactType="document"
          artifactId={documentId}
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
  )
}
