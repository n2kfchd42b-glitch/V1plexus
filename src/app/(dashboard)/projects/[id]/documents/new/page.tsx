"use client";

import { useEffect, useState, useRef } from "react";
import { ChevronDown, UploadCloud, FileText, X, Loader2 } from "lucide-react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
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

// ── TipTap node types ─────────────────────────────────────────────────────────
type TipTapMark = { type: string; attrs?: Record<string, unknown> }
type TipTapNode = {
  type: string
  attrs?: Record<string, unknown>
  content?: TipTapNode[]
  marks?: TipTapMark[]
  text?: string
}

/** Walk inline children (text, bold, italic, underline, links, br) */
function parseInline(el: Element, activeMarks: TipTapMark[] = []): TipTapNode[] {
  const nodes: TipTapNode[] = []
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? ""
      if (text) {
        const n: TipTapNode = { type: "text", text }
        if (activeMarks.length > 0) n.marks = [...activeMarks]
        nodes.push(n)
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const child = node as Element
      const tag   = child.tagName.toLowerCase()
      if (tag === "br") { nodes.push({ type: "hardBreak" }); continue }
      const marks = [...activeMarks]
      if (tag === "strong" || tag === "b")  marks.push({ type: "bold" })
      if (tag === "em"     || tag === "i")  marks.push({ type: "italic" })
      if (tag === "u")                       marks.push({ type: "underline" })
      if (tag === "a") {
        const href = child.getAttribute("href")
        if (href) marks.push({ type: "link", attrs: { href } })
      }
      nodes.push(...parseInline(child, marks))
    }
  }
  return nodes
}

/** Parse a single block-level HTML node into TipTap node(s) */
function parseBlock(node: Node): TipTapNode | null {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent?.trim() ?? ""
    if (!text) return null
    return { type: "paragraph", content: [{ type: "text", text }] }
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return null
  const el  = node as Element
  const tag = el.tagName.toLowerCase()

  if (/^h[1-6]$/.test(tag)) {
    const inline = parseInline(el)
    return { type: "heading", attrs: { level: parseInt(tag[1]) }, content: inline.length ? inline : undefined }
  }
  if (tag === "p") {
    const inline = parseInline(el)
    return { type: "paragraph", content: inline.length ? inline : undefined }
  }
  if (tag === "ul" || tag === "ol") {
    const items = Array.from(el.children)
      .filter(c => c.tagName.toLowerCase() === "li")
      .map(li => {
        // A list item may contain nested lists — split inline vs block children
        const inlineContent = parseInline(li)
        return { type: "listItem", content: [{ type: "paragraph", content: inlineContent }] }
      })
    return {
      type:    tag === "ul" ? "bulletList" : "orderedList",
      attrs:   tag === "ol" ? { start: 1 } : undefined,
      content: items,
    }
  }
  if (tag === "table") {
    const rows = Array.from(el.querySelectorAll("tr")).map(row => ({
      type:    "tableRow",
      content: Array.from(row.children).map(cell => ({
        type:    cell.tagName.toLowerCase() === "th" ? "tableHeader" : "tableCell",
        attrs:   { colspan: 1, rowspan: 1 },
        content: [{ type: "paragraph", content: parseInline(cell) }],
      })),
    }))
    return { type: "table", content: rows }
  }
  // Fallback: treat as paragraph
  const inline = parseInline(el)
  return inline.length ? { type: "paragraph", content: inline } : null
}

/** Convert mammoth HTML to a full TipTap JSON document, preserving formatting */
function htmlToTipTap(html: string): Record<string, unknown> {
  const doc     = new DOMParser().parseFromString(html, "text/html")
  const content = Array.from(doc.body.childNodes)
    .map(parseBlock)
    .filter((n): n is TipTapNode => n !== null)
  return { type: "doc", content: content.length ? content : [{ type: "paragraph" }] }
}

/** Fallback for PDFs: split plain text into paragraphs */
function textToTipTap(text: string): Record<string, unknown> {
  const paragraphs = text.split(/\n{2,}/).map(b => b.trim()).filter(Boolean)
  return {
    type:    "doc",
    content: paragraphs.length
      ? paragraphs.map(p => ({ type: "paragraph", content: [{ type: "text", text: p }] }))
      : [{ type: "paragraph" }],
  }
}

/** Extract and convert a DOCX file — returns TipTap JSON + word count */
async function extractDocx(file: File): Promise<{ content: Record<string, unknown>; wordCount: number }> {
  const mammoth    = await import("mammoth")
  const arrayBuffer = await file.arrayBuffer()
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer })
  const content   = htmlToTipTap(html)
  const wordCount = html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length
  return { content, wordCount }
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
  const router       = useRouter();
  const params       = useParams();
  const searchParams = useSearchParams();
  const projectId    = params.id as string;

  const [mode, setMode] = useState<Mode>(
    searchParams.get("mode") === "upload" ? "upload" : "write"
  );
  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState("general");
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Upload state
  const [uploadFile,       setUploadFile]       = useState<File | null>(null);
  const [extracting,       setExtracting]       = useState(false);
  const [extractedText,    setExtractedText]    = useState<string>("");          // PDF raw text
  const [extractedTipTap,  setExtractedTipTap]  = useState<Record<string, unknown> | null>(null); // DOCX rich content
  const [extractedWordCount, setExtractedWordCount] = useState(0);
  const [extractError,     setExtractError]     = useState<string | null>(null);
  const dropRef  = useRef<HTMLDivElement>(null);
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
    setExtractedText("");
    setExtractedTipTap(null);
    setExtractedWordCount(0);
    try {
      if (file.type === "application/pdf") {
        const text = await extractPdf(file);
        setExtractedText(text);
        setExtractedWordCount(text.split(/\s+/).filter(Boolean).length);
      } else {
        const { content, wordCount } = await extractDocx(file);
        setExtractedTipTap(content);
        setExtractedWordCount(wordCount);
      }
      if (!title) setTitle(file.name.replace(/\.[^/.]+$/, ""));
    } catch {
      setExtractError("Could not extract content from this file. Try a different file.");
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
    setExtractedTipTap(null);
    setExtractedWordCount(0);
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

    if (mode === "upload") {
      // DOCX: rich TipTap JSON already parsed; PDF: convert plain text
      content   = extractedTipTap ?? textToTipTap(extractedText);
      wordCount = extractedWordCount || extractedText.split(/\s+/).filter(Boolean).length;
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

  const hasExtractedContent = extractedTipTap !== null || extractedText.length > 0;
  const canSubmit =
    title.trim().length > 0 &&
    (mode === "write" || (mode === "upload" && hasExtractedContent));

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

                {!extracting && hasExtractedContent && (
                  <div className="mt-3 ml-11">
                    <p className="text-xs text-green-700 font-medium">
                      {extractedWordCount.toLocaleString()} words extracted
                      {extractedTipTap && " · formatting preserved"}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {extractedTipTap
                        ? "Headings, bold, lists, and tables will be imported"
                        : "Content will be imported into the editor"}
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
