import { FileText, Download } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { EthicsDocument } from "@/lib/types/database";

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function EthicsDocumentList({
  documents,
  onDownload,
}: {
  documents: EthicsDocument[];
  onDownload: (doc: EthicsDocument) => void;
}) {
  if (documents.length === 0) {
    return (
      <p className="text-sm text-gray-400 py-2">No documents uploaded yet</p>
    );
  }

  return (
    <ul className="space-y-2">
      {documents.map((doc) => (
        <li
          key={doc.id}
          className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 group"
        >
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-4 w-4 text-gray-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {doc.file_name}
              </p>
              <p className="text-xs text-gray-400">
                {formatDate(doc.created_at)}
                {doc.file_size ? ` · ${formatBytes(doc.file_size)}` : ""}
              </p>
            </div>
          </div>
          <button
            onClick={() => onDownload(doc)}
            className="text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-all ml-2 shrink-0"
            title="Download"
          >
            <Download className="h-4 w-4" />
          </button>
        </li>
      ))}
    </ul>
  );
}
