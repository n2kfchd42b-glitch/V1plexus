import Link from "next/link";
import { FileText, Clock } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import { DocumentStatusBadge } from "./DocumentStatusBadge";
import type { Document } from "@/lib/types/database";

const DOC_TYPE_LABELS: Record<string, string> = {
  protocol: "Protocol",
  manuscript: "Manuscript",
  thesis_chapter: "Thesis Chapter",
  ethics_application: "Ethics Application",
  analysis_plan: "Analysis Plan",
  general: "General",
};

export function DocumentCard({
  doc,
  projectId,
}: {
  doc: Document;
  projectId: string;
}) {
  return (
    <Link
      href={`/projects/${projectId}/documents/${doc.id}`}
      className="block bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="bg-blue-50 rounded-lg p-1.5">
            <FileText className="h-4 w-4 text-blue-600" />
          </div>
          <h3 className="font-semibold text-gray-900 line-clamp-1">{doc.title}</h3>
        </div>
        <DocumentStatusBadge status={doc.status} />
      </div>

      <div className="flex items-center justify-between mt-3">
        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
          {DOC_TYPE_LABELS[doc.doc_type] ?? doc.doc_type}
        </span>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          {doc.word_count > 0 && (
            <span>{doc.word_count.toLocaleString()} words</span>
          )}
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatRelativeTime(doc.updated_at)}
          </div>
        </div>
      </div>
    </Link>
  );
}
