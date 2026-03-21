"use client";

import { useEffect, useState } from "react";
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
  { value: "thesis_chapter", label: "Thesis Chapter" },
  { value: "ethics_application", label: "Ethics Application" },
  { value: "analysis_plan", label: "Analysis Plan" },
];

export default function NewDocumentPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState("general");
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.from("document_templates").select("*").then(({ data }) => {
      setTemplates(data ?? []);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    const { data, error } = await supabase
      .from("documents")
      .insert({
        project_id: projectId,
        title,
        doc_type: docType as "general",
        content: selectedTemplate?.content ?? {},
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

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
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

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Document type
          </label>
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {DOC_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

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

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Creating…" : "Create document"}
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
