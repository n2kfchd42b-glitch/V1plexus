"use client"

import { useState } from "react"
import Link from "next/link"
import { Plus } from "lucide-react"
import { DocumentCard } from "./DocumentCard"
import type { Document } from "@/lib/types/database"

const FILTERS = [
  { label: "All", value: "all" },
  { label: "Draft", value: "draft" },
  { label: "In Review", value: "in_review" },
  { label: "Revision", value: "revision_requested" },
  { label: "Approved", value: "approved" },
] as const

type FilterValue = (typeof FILTERS)[number]["value"]

export function DocumentsGrid({
  documents,
  projectId,
}: {
  documents: Document[]
  projectId: string
}) {
  const [active, setActive] = useState<FilterValue>("all")

  const filtered =
    active === "all" ? documents : documents.filter((d) => d.status === active)

  return (
    <>
      {/* Filter chips */}
      <div className="flex items-center gap-1.5 mb-5 flex-wrap">
        {FILTERS.map((f) => {
          const count =
            f.value === "all"
              ? documents.length
              : documents.filter((d) => d.status === f.value).length
          const isActive = active === f.value
          return (
            <button
              key={f.value}
              onClick={() => setActive(f.value)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                isActive
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-white border border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-600"
              }`}
            >
              {f.label}
              <span
                className={`text-[10px] font-semibold ${
                  isActive ? "text-blue-100" : "text-gray-400"
                }`}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Grid */}
      {filtered.length === 0 && active !== "all" ? (
        <div className="col-span-3 text-center py-12 text-sm text-gray-400">
          No documents with this status.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((doc) => (
            <DocumentCard key={doc.id} doc={doc} projectId={projectId} />
          ))}

          {/* Ghost new-document card */}
          <Link
            href={`/projects/${projectId}/documents/new`}
            className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50/40 transition-all min-h-[116px] group"
          >
            <div className="w-7 h-7 rounded-full border-2 border-current flex items-center justify-center group-hover:scale-110 transition-transform">
              <Plus className="h-3.5 w-3.5" />
            </div>
            <span className="text-xs font-medium">New document</span>
          </Link>
        </div>
      )}
    </>
  )
}
