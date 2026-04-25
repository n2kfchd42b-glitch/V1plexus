"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  X, ChevronRight, ChevronLeft, FileText, BarChart2,
  Table2, Loader2, Sparkles, BookOpen, Check, Mail,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import type { Document } from "@/lib/types/database"

// ── Types ─────────────────────────────────────────────────────────────────────

interface Exploration {
  id: string
  title: string
  chart_type: string
  dataset_id: string
  config: Record<string, unknown>
}

interface Dataset {
  id: string
  name: string
}

interface Props {
  projectId: string
  onClose: () => void
}

// ── Constants ──────────────────────────────────────────────────────────────────

const SECTION_TYPES: Record<string, string[]> = {
  introduction: ["introduction", "literature_review", "general"],
  methodology: ["methodology", "protocol", "analysis_plan"],
  results: [],   // handled separately via datasets/charts
  discussion: ["discussion", "conclusion"],
}

const STEPS = [
  { id: "introduction", label: "Introduction", icon: BookOpen, description: "Select documents for the Introduction section" },
  { id: "methodology",  label: "Methodology",  icon: FileText, description: "Select documents for the Methodology section" },
  { id: "results",      label: "Results",      icon: Table2,   description: "Pick tables and charts from project analyses" },
  { id: "discussion",   label: "Discussion",   icon: FileText, description: "Select documents for the Discussion section" },
  { id: "generate",     label: "Generate",     icon: Sparkles, description: "Review selections and generate the manuscript" },
]

// ── Helpers ────────────────────────────────────────────────────────────────────

function extractPlainText(content: unknown): string {
  if (!content || typeof content !== "object") return ""
  const doc = content as { content?: unknown[] }
  if (!doc.content) return ""
  return doc.content
    .flatMap((node: unknown) => {
      const n = node as { content?: unknown[] }
      return (n.content ?? []).map((c: unknown) => {
        const leaf = c as { text?: string }
        return leaf.text ?? ""
      })
    })
    .join(" ")
    .slice(0, 800)
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function DocumentPicker({
  documents,
  selected,
  onToggle,
}: {
  documents: Document[]
  selected: string[]
  onToggle: (id: string) => void
}) {
  if (documents.length === 0)
    return <p className="text-sm text-gray-400 py-4 text-center">No matching documents in this project.</p>

  return (
    <div className="space-y-2">
      {documents.map((doc) => {
        const isSelected = selected.includes(doc.id)
        return (
          <button
            key={doc.id}
            type="button"
            onClick={() => onToggle(doc.id)}
            className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
              isSelected
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                  isSelected ? "bg-blue-600 border-blue-600" : "border-gray-300"
                }`}>
                  {isSelected && <Check className="h-2.5 w-2.5 text-white" />}
                </div>
                <span className="text-sm font-medium text-gray-900 line-clamp-1">{doc.title}</span>
              </div>
              <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 mt-0.5 font-medium uppercase tracking-wide">
                {doc.doc_type}
              </span>
            </div>
            {doc.word_count > 0 && (
              <p className="text-xs text-gray-400 mt-1 ml-6.5">{doc.word_count.toLocaleString()} words</p>
            )}
          </button>
        )
      })}
    </div>
  )
}

function ResultsPicker({
  explorations,
  datasets,
  selectedExplorations,
  selectedDatasets,
  onToggleExploration,
  onToggleDataset,
  loading,
}: {
  explorations: Exploration[]
  datasets: Dataset[]
  selectedExplorations: string[]
  selectedDatasets: string[]
  onToggleExploration: (id: string) => void
  onToggleDataset: (id: string) => void
  loading: boolean
}) {
  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-gray-300" /></div>

  return (
    <div className="space-y-5">
      {datasets.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Dataset tables</p>
          <div className="space-y-2">
            {datasets.map((ds) => {
              const sel = selectedDatasets.includes(ds.id)
              return (
                <button
                  key={ds.id}
                  type="button"
                  onClick={() => onToggleDataset(ds.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center gap-3 ${
                    sel ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-blue-300"
                  }`}
                >
                  <div className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center ${
                    sel ? "bg-blue-600 border-blue-600" : "border-gray-300"
                  }`}>
                    {sel && <Check className="h-2.5 w-2.5 text-white" />}
                  </div>
                  <Table2 className="h-4 w-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-900">{ds.name}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {explorations.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Saved charts</p>
          <div className="space-y-2">
            {explorations.map((exp) => {
              const sel = selectedExplorations.includes(exp.id)
              return (
                <button
                  key={exp.id}
                  type="button"
                  onClick={() => onToggleExploration(exp.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center gap-3 ${
                    sel ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-blue-300"
                  }`}
                >
                  <div className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center ${
                    sel ? "bg-blue-600 border-blue-600" : "border-gray-300"
                  }`}>
                    {sel && <Check className="h-2.5 w-2.5 text-white" />}
                  </div>
                  <BarChart2 className="h-4 w-4 text-gray-400" />
                  <div>
                    <span className="text-sm font-medium text-gray-900">{exp.title}</span>
                    <span className="ml-2 text-xs text-gray-400">{exp.chart_type}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {datasets.length === 0 && explorations.length === 0 && (
        <p className="text-sm text-gray-400 py-4 text-center">No datasets or saved charts in this project yet.</p>
      )}
    </div>
  )
}

// ── Main modal ─────────────────────────────────────────────────────────────────

export function GenerateManuscriptModal({ projectId, onClose }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState(0)

  // Selections per section
  const [introSelected, setIntroSelected] = useState<string[]>([])
  const [methodSelected, setMethodSelected] = useState<string[]>([])
  const [discussSelected, setDiscussSelected] = useState<string[]>([])
  const [explorationSelected, setExplorationSelected] = useState<string[]>([])
  const [datasetSelected, setDatasetSelected] = useState<string[]>([])

  // Cover letter option
  const [includeCoverLetter, setIncludeCoverLetter] = useState(false)
  const [journalName, setJournalName] = useState("")

  // Data
  const [documents, setDocuments] = useState<Document[]>([])
  const [explorations, setExplorations] = useState<Exploration[]>([])
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [resultsLoading, setResultsLoading] = useState(false)
  const [generating, setGenerating] = useState(false)

  // Load documents once
  useEffect(() => {
    supabase
      .from("documents")
      .select("*")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .then(({ data }) => setDocuments(data ?? []))
  }, [projectId])

  // Load analyses when reaching step 2 (results)
  useEffect(() => {
    if (step !== 2) return
    setResultsLoading(true)
    Promise.all([
      supabase.from("dataset_explorations").select("id, title, chart_type, dataset_id, config").eq("project_id", projectId),
      supabase.from("datasets").select("id, name").eq("project_id", projectId),
    ]).then(([expRes, dsRes]) => {
      setExplorations((expRes.data ?? []) as Exploration[])
      setDatasets((dsRes.data ?? []) as Dataset[])
      setResultsLoading(false)
    })
  }, [step, projectId])

  function toggle(arr: string[], id: string): string[] {
    return arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]
  }

  function docsForSection(types: string[]) {
    return documents.filter((d) => types.includes(d.doc_type))
  }

  // ── Generate ─────────────────────────────────────────────────────────────────
  async function handleGenerate() {
    setGenerating(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      // Build context for the AI
      const sectionTexts: Record<string, string> = {}

      const allSelected = [
        { key: "introduction", ids: introSelected },
        { key: "methodology",  ids: methodSelected },
        { key: "discussion",   ids: discussSelected },
      ]

      for (const { key, ids } of allSelected) {
        const docs = documents.filter((d) => ids.includes(d.id))
        sectionTexts[key] = docs.map((d) => extractPlainText(d.content)).join("\n\n")
      }

      const datasetNames = datasets.filter((d) => datasetSelected.includes(d.id)).map((d) => d.name)
      const chartTitles = explorations.filter((e) => explorationSelected.includes(e.id)).map((e) => `${e.title} (${e.chart_type})`)

      // Call ai-assist edge function
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ai-assist`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          action: "compile_manuscript",
          context: {
            introduction: sectionTexts.introduction,
            methodology: sectionTexts.methodology,
            discussion: sectionTexts.discussion,
            datasets: datasetNames,
            charts: chartTitles,
            journal: journalName || undefined,
          },
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? "AI generation failed")
      }

      const { text } = await res.json()

      // Create the manuscript document
      const paragraphs = (text as string).split(/\n{2,}/).map((p: string) => ({
        type: "paragraph",
        content: [{ type: "text", text: p.trim() }],
      }))

      const { data: doc, error } = await supabase
        .from("documents")
        .insert({
          project_id: projectId,
          title: "Generated Manuscript",
          doc_type: "manuscript",
          content: { type: "doc", content: paragraphs },
          word_count: text.split(/\s+/).filter(Boolean).length,
          created_by: user.id,
        })
        .select()
        .single()

      if (error) throw error

      toast.success("Manuscript generated!")
      onClose()
      router.push(`/projects/${projectId}/documents/${doc.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed")
    } finally {
      setGenerating(false)
    }
  }

  // ── Step content ──────────────────────────────────────────────────────────────
  function renderStep() {
    switch (step) {
      case 0:
        return (
          <DocumentPicker
            documents={docsForSection(SECTION_TYPES.introduction)}
            selected={introSelected}
            onToggle={(id) => setIntroSelected(toggle(introSelected, id))}
          />
        )
      case 1:
        return (
          <DocumentPicker
            documents={docsForSection(SECTION_TYPES.methodology)}
            selected={methodSelected}
            onToggle={(id) => setMethodSelected(toggle(methodSelected, id))}
          />
        )
      case 2:
        return (
          <ResultsPicker
            explorations={explorations}
            datasets={datasets}
            selectedExplorations={explorationSelected}
            selectedDatasets={datasetSelected}
            onToggleExploration={(id) => setExplorationSelected(toggle(explorationSelected, id))}
            onToggleDataset={(id) => setDatasetSelected(toggle(datasetSelected, id))}
            loading={resultsLoading}
          />
        )
      case 3:
        return (
          <DocumentPicker
            documents={docsForSection(SECTION_TYPES.discussion)}
            selected={discussSelected}
            onToggle={(id) => setDiscussSelected(toggle(discussSelected, id))}
          />
        )
      case 4:
        return (
          <div className="space-y-5">
            {/* Summary */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
              {[
                { label: "Introduction", ids: introSelected },
                { label: "Methodology", ids: methodSelected },
                { label: "Discussion",  ids: discussSelected },
              ].map(({ label, ids }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-gray-500">{label}</span>
                  <span className="font-medium text-gray-900">
                    {ids.length === 0 ? <span className="text-gray-400 font-normal">None selected</span> : `${ids.length} doc${ids.length !== 1 ? "s" : ""}`}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Tables / Charts</span>
                <span className="font-medium text-gray-900">
                  {datasetSelected.length + explorationSelected.length === 0
                    ? <span className="text-gray-400 font-normal">None</span>
                    : `${datasetSelected.length} table${datasetSelected.length !== 1 ? "s" : ""}, ${explorationSelected.length} chart${explorationSelected.length !== 1 ? "s" : ""}`}
                </span>
              </div>
            </div>

            {/* Cover letter toggle */}
            <div className="border border-gray-200 rounded-xl p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 rounded"
                  checked={includeCoverLetter}
                  onChange={(e) => setIncludeCoverLetter(e.target.checked)}
                />
                <div>
                  <div className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
                    <Mail className="h-3.5 w-3.5 text-gray-400" />
                    Also draft a cover letter
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Uses the publication pipeline's cover letter generator
                  </p>
                </div>
              </label>

              {includeCoverLetter && (
                <input
                  type="text"
                  value={journalName}
                  onChange={(e) => setJournalName(e.target.value)}
                  placeholder="Target journal name (optional)"
                  className="mt-3 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
            </div>

            <p className="text-xs text-gray-400">
              Selected sections will be synthesised into a structured manuscript draft with abstract and linking prose.
            </p>
          </div>
        )
    }
  }

  const currentStep = STEPS[step]
  const Icon = currentStep.icon

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-600" />
            <span className="font-semibold text-gray-900 text-sm">Generate Manuscript</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-0 px-6 pt-4 pb-2">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center">
              <button
                type="button"
                onClick={() => i < step && setStep(i)}
                className={`flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold transition-all ${
                  i === step
                    ? "bg-blue-600 text-white"
                    : i < step
                    ? "bg-green-500 text-white cursor-pointer"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                {i < step ? <Check className="h-3 w-3" /> : i + 1}
              </button>
              {i < STEPS.length - 1 && (
                <div className={`h-0.5 w-8 mx-1 ${i < step ? "bg-green-400" : "bg-gray-100"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step title */}
        <div className="px-6 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-semibold text-gray-900">{currentStep.label}</span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{currentStep.description}</p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {renderStep()}
        </div>

        {/* Footer nav */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>

          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              className="flex items-center gap-1.5 bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-1.5 bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {generating ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</>
              ) : (
                <><Sparkles className="h-4 w-4" /> Generate manuscript</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
