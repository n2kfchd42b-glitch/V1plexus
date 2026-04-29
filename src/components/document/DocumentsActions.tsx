"use client"

import Link from "next/link"
import { Plus } from "lucide-react"

export function DocumentsActions({ projectId }: { projectId: string }) {
  return (
    <div className="flex items-center gap-2">
      <Link
        href={`/projects/${projectId}/documents/new`}
        className="flex items-center gap-1.5 bg-clinical-blue text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-clinical-deep transition-colors"
      >
        <Plus className="h-4 w-4" />
        New document
      </Link>
    </div>
  )
}
