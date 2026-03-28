"use client";

import { useEffect, useState, useRef } from "react";
import { ChevronDown, UploadCloud, FileText, X, Loader2 } from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { TemplatePicker } from "@/components/document/TemplatePicker";
import type { DocumentTemplate } from "@/lib/types/database";
import { ArrowLeft, Layout } from "lucide-react";

const DOC_TYPES = [
  { value: "general", label: "General" },
  { value: "protocol", label: "Protocol" },
  { value: "manuscript", label: "Manuscript" },
  { value: "abstract", label: "Abstract" },
  { value: "introduction", label: "Introduction" },
  { value: "literature_review", label: "Literature Review" },
  { value: "methodology", label: "Methodology" },
  { value: "results", label: "Results" },
  { value: "discussion", label: "Discussion" },
  { value: "conclusion", label: "Conclusion" },
  { value: "thesis_chapter", label: "Thesis Chapter" },
  { value: "ethics_application", label: "Ethics Application" },
  { value: "analysis_plan", label: "Analysis Plan" },
];

type Mode = "write" | "upload";

/** Convert plain text into a minimal TipTap JSON document */
function textToTipTap(text: string) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  return {
    type: "doc",
    content: paragraphs.map((p) => ({
      type: "paragraph",
      content: [{ type: "text", text: p }],
    })),
  };
}

/** Extract text from a DOCX file using mammoth (dynamic import to keep bundle lean) */
async function extractDocx(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

/** Extract text from a PDF using the PDF.js CDN worker */
async function extractPdf(file: File): Promise<string> {
  // Dynamic load so we don't bundle pdf.js for everyone
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
  }
  return pages.join("\n\n");
}

export default function NewDocumentPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [mode, setMode] = useState<Mode>("write");
  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState("general");
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractedText, setExtractedText] = useState<string>("");
  const [extractError, setExtractError] = useState<string | null>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.from("document_templates").select("*").then(({ data }) => {
      setTemplates(data ?? []);
    });
  }, []);

  // ── File handling ──────────────────────────────────────────────
  async function processFile(file: File) {
    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
    ];
    if (!allowed.includes(file.type)) {
      setExtractError("Only PDF and Word (.docx) files are supported.");
      return;
    }
    setUploadFile(file);
    setExtractError(null);
    setExtracting(true);
    try {
      let text = "";
      if (file.type === "application/pdf") {
        text = await extractPdf(file);
      } else {
        text = await extractDocx(file);
      }
      setExtractedText(text);
      // Auto-fill title from filename if blank
      if (!title) setTitle(file.name.replace(/\.[^/.]+$/, ""));
    } catch {
      setExtractError("Could not extract text from this file. Try a different file.");
    } finally {
      setExtracting(false);
    }
  }

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  function clearFile() {
    setUploadFile(null);
    setExtractedText("");
    setExtractError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  // ── Submit ─────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let content: any = selectedTemplate?.content ?? {};
    let wordCount = 0;

    if (mode === "upload" && extractedText) {
      content = textToTipTap(extractedText);
      wordCount = extractedText.split(/\s+/).filter(Boolean).length;
    }

    const { data, error } = await supabase
      .from("documents")
      .insert({
        project_id: projectId,
        title,
        doc_type: docType as "general",
        content,
        word_count: wordCount,
        template_id: selectedTemplate?.id ?? null,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push(`/projects/${projectId}/documents/${data.id}`);
    }
  }

  const canSubmit =
    title.trim().length > 0 &&
    (mode === "write" || (mode === "upload" && extractedText.length > 0));

  return (
    <div className="p-8 max-w-xl mx-auto">
      <Link
        href={`/projects/${projectId}/documents`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to documents
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">New document</h1>

      {/* Mode tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-lg mb-6 w-fit">
        {(["write", "upload"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              mode === m
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {m === "write" ? "Write from scratch" : "Upload file"}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. Study Protocol v1"
          />
        </div>

        {/* Document type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Section / document type
          </label>
          <div className="relative">
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-8 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {DOC_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Write mode: template picker */}
        {mode === "write" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Template
            </label>
            <div className="flex items-center gap-3">
              <div className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-500">
                {selectedTemplate ? selectedTemplate.name : "No template selected"}
              </div>
              <button
                type="button"
                onClick={() => setShowTemplatePicker(true)}
                className="flex items-center gap-1.5 text-sm text-blue-600 border border-blue-200 rounded-lg px-3 py-2 hover:bg-blue-50 transition-colors"
              >
                <Layout className="h-4 w-4" />
                Browse
              </button>
            </div>
            {selectedTemplate && (
              <button
                type="button"
                onClick={() => setSelectedTemplate(null)}
                className="mt-1 text-xs text-gray-400 hover:text-gray-600"
              >
                Clear template
              </button>
            )}
          </div>
        )}

        {/* Upload mode: drop zone */}
        {mode === "upload" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              File <span className="text-red-500">*</span>
            </label>

            {!uploadFile ? (
              <div
                ref={dropRef}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleFileDrop}
                onClick={() => inputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-xl p-8 flex flex-col items-center gap-2 text-gray-400 cursor-pointer hover:border-blue-400 hover:bg-blue-50/40 transition-all"
              >
                <UploadCloud className="h-8 w-8" />
                <p className="text-sm font-medium text-gray-600">
                  Drop a PDF or Word file here
                </p>
                <p className="text-xs">or click to browse</p>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={handleFileInput}
                />
              </div>
            ) : (
              <div className="border border-gray-200 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-50 rounded-lg p-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {uploadFile.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {(uploadFile.size / 1024).toFixed(0)} KB
                    </p>
                  </div>
                  {extracting ? (
                    <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                  ) : (
                    <button type="button" onClick={clearFile}>
                      <X className="h-4 w-4 text-gray-400 hover:text-gray-700 transition-colors" />
                    </button>
                  )}
                </div>

                {extracting && (
                  <p className="text-xs text-blue-600 mt-2 ml-11">Extracting text…</p>
                )}

                {!extracting && extractedText && (
                  <div className="mt-3 ml-11">
                    <p className="text-xs text-green-700 font-medium">
                      {extractedText.split(/\s+/).filter(Boolean).length.toLocaleString()} words extracted
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Content will be imported into the editor
                    </p>
                  </div>
                )}
              </div>
            )}

            {extractError && (
              <p className="text-xs text-red-600 mt-1">{extractError}</p>
            )}
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading || !canSubmit}
            className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Creating…" : mode === "upload" ? "Import document" : "Create document"}
          </button>
          <Link
            href={`/projects/${projectId}/documents`}
            className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>

      {showTemplatePicker && (
        <TemplatePicker
          templates={templates}
          onSelect={(tpl) => {
            setSelectedTemplate(tpl);
            setShowTemplatePicker(false);
          }}
          onClose={() => setShowTemplatePicker(false)}
        />
      )}
    </div>
  );
}
