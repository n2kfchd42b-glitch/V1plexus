"use client";

import { X, FileText } from "lucide-react";
import type { DocumentTemplate } from "@/lib/types/database";

export function TemplatePicker({
  templates,
  onSelect,
  onClose,
}: {
  templates: DocumentTemplate[];
  onSelect: (template: DocumentTemplate) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Choose a template</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-2 max-h-96 overflow-y-auto">
          <button
            onClick={() => onClose()}
            className="w-full text-left p-4 border border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50/50 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="bg-gray-100 rounded-lg p-2">
                <FileText className="h-4 w-4 text-gray-500" />
              </div>
              <div>
                <p className="font-medium text-sm text-gray-900">Blank document</p>
                <p className="text-xs text-gray-500">Start with an empty document</p>
              </div>
            </div>
          </button>

          {templates.map((tpl) => (
            <button
              key={tpl.id}
              onClick={() => onSelect(tpl)}
              className="w-full text-left p-4 border border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50/50 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="bg-blue-50 rounded-lg p-2">
                  <FileText className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm text-gray-900">{tpl.name}</p>
                    {tpl.standard && (
                      <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">
                        {tpl.standard}
                      </span>
                    )}
                  </div>
                  {tpl.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{tpl.description}</p>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
