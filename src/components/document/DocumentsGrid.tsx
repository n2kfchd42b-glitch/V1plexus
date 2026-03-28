"use client"

import { useState } from "react"
import Link from "next/link"
import { Plus, FileText, PenLine, FlaskConical, CheckCircle2 } from "lucide-react"
import { DocumentCard } from "./DocumentCard"
import type { Document } from "@/lib/types/database"

// ── Filters ───────────────────────────────────────────────────────────────────

const FILTERS = [
  { label: "All",      value: "all" },
  { label: "Draft",    value: "draft" },
  { label: "In Review",value: "in_review" },
  { label: "Revision", value: "revision_requested" },
  { label: "Approved", value: "approved" },
] as const

type FilterValue = (typeof FILTERS)[number]["value"]

// ── Stat helpers ──────────────────────────────────────────────────────────────

function fmtNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function totalWords(docs: Document[]): number {
  return docs.reduce((sum, d) => sum + (d.word_count ?? 0), 0)
}

function underReviewCount(docs: Document[]): number {
  return docs.filter(
    (d) => d.status === "in_review" || d.status === "revision_requested"
  ).length
}

function approvedCount(docs: Document[]): number {
  return docs.filter((d) => d.status === "approved" || d.status === "locked").length
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ElementType
  label: string
  value: string
  sub?: string
  accent: string
}) {
  return (
    <div className="bg-slate-900 rounded-2xl p-5 flex flex-col gap-3">
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${accent}`}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">
          {label}
        </p>
        <p className="text-3xl font-extrabold text-white leading-none">{value}</p>
        {sub && (
          <p className="text-[10px] text-slate-500 font-medium mt-1.5">{sub}</p>
        )}
      </div>
    </div>
  )
}

// ── Grid ──────────────────────────────────────────────────────────────────────

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

  const inReview   = underReviewCount(documents)
  const approved   = approvedCount(documents)
  const wordsTotal = totalWords(documents)
  const draftCount = documents.filter((d) => d.status === "draft").length

  return (
    <>
      {/* ── Stat strip ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <StatCard
          icon={FileText}
          label="Total Documents"
          value={String(documents.length)}
          sub={`${draftCount} still in draft`}
          accent="bg-blue-600"
        />
        <StatCard
          icon={PenLine}
          label="Words Written"
          value={fmtNumber(wordsTotal)}
          sub="across all documents"
          accent="bg-violet-600"
        />
        <StatCard
          icon={FlaskConical}
          label="Under Review"
          value={String(inReview)}
          sub={inReview === 0 ? "Nothing pending" : "Awaiting feedback"}
          accent="bg-amber-500"
        />
        <StatCard
          icon={CheckCircle2}
          label="Approved"
          value={String(approved)}
          sub={approved === documents.length && documents.length > 0 ? "All complete!" : `of ${documents.length} documents`}
          accent="bg-emerald-600"
        />
      </div>

      {/* ── Filter chips ──────────────────────────────────────────── */}
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
              <span className={`text-[10px] font-semibold ${isActive ? "text-blue-100" : "text-gray-400"}`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* ── Document grid ─────────────────────────────────────────── */}
      {filtered.length === 0 && active !== "all" ? (
        <p className="text-sm text-gray-400 text-center py-12">
          No documents with this status.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((doc) => (
            <DocumentCard key={doc.id} doc={doc} projectId={projectId} />
          ))}

          {/* Ghost new-document card — matches card height */}
          <Link
            href={`/projects/${projectId}/documents/new`}
            className="flex flex-col items-center justify-center gap-2.5 rounded-2xl border-2 border-dashed border-gray-200 text-gray-400 hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50/40 transition-all min-h-[220px] group"
          >
            <div className="w-9 h-9 rounded-full border-2 border-current flex items-center justify-center group-hover:scale-110 transition-transform">
              <Plus className="h-4 w-4" />
            </div>
            <div className="text-center">
              <p className="text-xs font-semibold">New document</p>
              <p className="text-[10px] mt-0.5 text-gray-300">Write or upload</p>
            </div>
          </Link>
        </div>
      )}
    </>
  )
}
