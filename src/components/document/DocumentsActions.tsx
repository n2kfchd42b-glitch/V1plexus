"use client"

import { useState } from "react"
import Link from "next/link"
import { Plus, Sparkles } from "lucide-react"
import { GenerateManuscriptModal } from "./GenerateManuscriptModal"

export function DocumentsActions({ projectId }: { projectId: string }) {
  const [showModal, setShowModal] = useState(false)

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 border border-blue-200 text-blue-600 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors"
        >
          <Sparkles className="h-4 w-4" />
          Generate manuscript
        </button>
        <Link
          href={`/projects/${projectId}/documents/new`}
          className="flex items-center gap-1.5 bg-clinical-blue text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-clinical-deep transition-colors"
        >
          <Plus className="h-4 w-4" />
          New document
        </Link>
      </div>

      {showModal && (
        <GenerateManuscriptModal
          projectId={projectId}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  )
}
