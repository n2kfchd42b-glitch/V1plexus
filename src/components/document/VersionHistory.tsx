"use client";

import { X, History } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { DocumentVersion } from "@/lib/types/database";

export function VersionHistory({
  versions,
  currentVersion,
  onClose,
  onRestore,
}: {
  versions: DocumentVersion[];
  currentVersion: number;
  onClose: () => void;
  onRestore: (version: DocumentVersion) => void;
}) {
  return (
    <div className="w-72 border-l border-gray-200 bg-white flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-gray-500" />
          <h3 className="font-medium text-sm text-gray-900">Version history</h3>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {versions.length === 0 ? (
          <p className="text-sm text-gray-400 p-4 text-center">
            No saved versions yet
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {versions
              .slice()
              .sort((a, b) => b.version_number - a.version_number)
              .map((v) => (
                <li key={v.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        Version {v.version_number}
                        {v.version_number === currentVersion && (
                          <span className="ml-1.5 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
                            current
                          </span>
                        )}
                      </p>
                      {v.change_summary && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {v.change_summary}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        {formatDate(v.created_at)}
                      </p>
                      {v.word_count > 0 && (
                        <p className="text-xs text-gray-400">
                          {v.word_count.toLocaleString()} words
                        </p>
                      )}
                    </div>
                    {v.version_number !== currentVersion && (
                      <button
                        onClick={() => onRestore(v)}
                        className="text-xs text-blue-600 hover:underline ml-2 shrink-0"
                      >
                        Restore
                      </button>
                    )}
                  </div>
                </li>
              ))}
          </ul>
        )}
      </div>
    </div>
  );
}
